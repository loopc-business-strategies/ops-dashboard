import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localTestTempDir = fileURLToPath(new URL('./node_modules/.cache/tmp', import.meta.url))
if (process.env.VITEST || process.env.npm_lifecycle_event === 'test') {
  mkdirSync(localTestTempDir, { recursive: true })
  process.env.TMPDIR = localTestTempDir
  process.env.TMP = localTestTempDir
  process.env.TEMP = localTestTempDir
}

const frontendPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
)

const resolveBuildSha = () => {
  if (process.env.VITE_BUILD_SHA) return String(process.env.VITE_BUILD_SHA).trim()
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const resolveBuildTime = () => {
  if (process.env.VITE_BUILD_TIME) return String(process.env.VITE_BUILD_TIME).trim()
  return new Date().toISOString()
}

const appBuildMeta = {
  version: String(frontendPackageJson.version || '0.0.0'),
  sha: resolveBuildSha(),
  builtAt: resolveBuildTime(),
}

const viteLogger = createLogger()
const viteWarn = viteLogger.warn
viteLogger.warn = (msg, options) => {
  if (typeof msg === 'string' && msg.includes('[PLUGIN_TIMINGS] Warning')) return
  viteWarn(msg, options)
}

export default defineConfig({
  plugins: [react()],
  customLogger: viteLogger,
  define: {
    __APP_BUILD_META__: JSON.stringify(appBuildMeta),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    fileParallelism: false,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
              return 'vendor-react'
            }
            if (id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
              return 'vendor-pdf'
            }
            if (id.includes('/exceljs/')) {
              return 'vendor-excel'
            }
            if (id.includes('/axios/')) {
              return 'vendor-http'
            }
            return 'vendor-misc'
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:5000', changeOrigin: true },
    },
  },
})
