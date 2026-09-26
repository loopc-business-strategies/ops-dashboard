import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const requireFromFrontend = createRequire(path.join(__dirname, 'package.json'))

/** Absolute package root so Vite always resolves Sentry from this app’s node_modules (avoids flaky resolution on Windows / OneDrive). */
let sentryReactRoot
try {
  sentryReactRoot = path.dirname(requireFromFrontend.resolve('@sentry/react/package.json'))
} catch {
  sentryReactRoot = null
}

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

/** Same-origin /api → upstream without forwarding browser Origin (prod CORS 500 on *.localhost). */
function createDevApiProxyPlugin() {
  const target = String(process.env.DEV_API_PROXY || process.env.VITE_API_URL || '').replace(/\/$/, '')
  if (!target) return null

  return {
    name: 'dev-api-proxy-no-cors-origin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()

        try {
          const upstreamUrl = new URL(req.url, `${target}/`)
          const headers = {}
          for (const [key, value] of Object.entries(req.headers || {})) {
            if (!value || key.startsWith(':')) continue
            const lower = key.toLowerCase()
            if (
              lower === 'host'
              || lower === 'origin'
              || lower === 'referer'
              || lower === 'connection'
              || lower === 'content-length'
              || lower === 'transfer-encoding'
              || lower === 'accept-encoding'
              || lower === 'expect'
            ) continue
            headers[key] = value
          }

          const method = String(req.method || 'GET').toUpperCase()
          const hasBody = method !== 'GET' && method !== 'HEAD'
          const body = hasBody
            ? await new Promise((resolve, reject) => {
                const chunks = []
                req.on('data', (c) => chunks.push(c))
                req.on('end', () => resolve(Buffer.concat(chunks)))
                req.on('error', reject)
              })
            : undefined

          const upstream = await fetch(upstreamUrl, {
            method,
            headers,
            body,
            redirect: 'manual',
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase()
            if (lower === 'transfer-encoding' || lower === 'content-encoding') return
            if (lower === 'set-cookie') {
              const cookies = typeof upstream.headers.getSetCookie === 'function'
                ? upstream.headers.getSetCookie()
                : [value]
              res.setHeader('set-cookie', cookies.map((cookie) => String(cookie)
                .replace(/;\s*Domain=[^;]*/gi, '')
                .replace(/;\s*Secure/gi, '')
                .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')))
              return
            }
            res.setHeader(key, value)
          })
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (err) {
          const detail = err?.cause?.message || err?.message || 'Dev API proxy failed'
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ success: false, message: detail }))
        }
      })
    },
  }
}

const devApiProxyPlugin = createDevApiProxyPlugin()

export default defineConfig({
  plugins: [react(), ...(devApiProxyPlugin ? [devApiProxyPlugin] : [])],
  customLogger: viteLogger,
  define: {
    __APP_BUILD_META__: JSON.stringify(appBuildMeta),
  },
  resolve: {
    ...(sentryReactRoot
      ? {
          alias: {
            '@sentry/react': sentryReactRoot,
          },
        }
      : {}),
  },
  optimizeDeps: {
    include: ['@sentry/react'],
  },
  test: {
    setupFiles: ['./src/test-setup.js'],
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    exclude: ['**/node_modules/**', '**/*.node.test.{js,ts}', '**/e2e/**'],
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
            if (id.includes('/html2pdf')) {
              return 'vendor-html2pdf'
            }
            if (id.includes('/socket.io-client/')) {
              return 'vendor-socket'
            }
            if (id.includes('/papaparse/')) {
              return 'vendor-csv'
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
    // Built-in proxy only when DEV_API_PROXY is unset (local backend on :5000).
    // When DEV_API_PROXY is set, createDevApiProxyPlugin handles /api without CORS Origin.
    ...(process.env.DEV_API_PROXY
      ? {}
      : {
          proxy: {
            '/api': {
              target: process.env.VITE_API_URL || 'http://localhost:5000',
              changeOrigin: true,
            },
          },
        }),
  },
})

