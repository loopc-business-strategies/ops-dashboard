import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const assetsDir = path.join(repoRoot, 'frontend', 'dist', 'assets')

const MAX_JS_KB = Number(process.env.FRONTEND_MAX_JS_CHUNK_KB || 1400)
const MAX_CSS_KB = Number(process.env.FRONTEND_MAX_CSS_CHUNK_KB || 120)

if (!fs.existsSync(assetsDir)) {
  console.error('frontend/dist/assets was not found. Run the frontend build first.')
  process.exit(1)
}

const files = fs.readdirSync(assetsDir)
  .filter((name) => /\.(js|css)$/.test(name))
  .map((name) => {
    const sizeKb = fs.statSync(path.join(assetsDir, name)).size / 1024
    return { name, sizeKb, ext: path.extname(name) }
  })

const violations = files.filter((file) => {
  if (file.ext === '.js') return file.sizeKb > MAX_JS_KB
  if (file.ext === '.css') return file.sizeKb > MAX_CSS_KB
  return false
})

if (violations.length) {
  console.error('Frontend bundle budget exceeded:')
  for (const file of violations) {
    const limit = file.ext === '.js' ? MAX_JS_KB : MAX_CSS_KB
    console.error(`- ${file.name}: ${file.sizeKb.toFixed(1)} KiB > ${limit} KiB`)
  }
  process.exit(1)
}

console.log(`Frontend bundle budget passed (${files.length} assets checked).`)
