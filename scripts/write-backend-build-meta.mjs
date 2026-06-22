import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'backend', 'build-meta.json')

const readGitHead = (fallback = '') => {
  try {
    const gitDir = join(root, '.git')
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()
    if (!head.startsWith('ref:')) return head

    const refPath = head.replace(/^ref:\s*/, '')
    const looseRefPath = join(gitDir, refPath)
    if (existsSync(looseRefPath)) return readFileSync(looseRefPath, 'utf8').trim()

    const packedRefsPath = join(gitDir, 'packed-refs')
    if (existsSync(packedRefsPath)) {
      const packedRef = readFileSync(packedRefsPath, 'utf8')
        .split(/\r?\n/)
        .find((line) => line && !line.startsWith('#') && line.endsWith(` ${refPath}`))
      if (packedRef) return packedRef.split(' ')[0].trim()
    }

    return fallback
  } catch {
    return fallback
  }
}

const commit = readGitHead(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown')
const shortCommit = commit && commit !== 'unknown' ? commit.slice(0, 7) : 'unknown'

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify({
  commit,
  sha: commit,
  shortCommit,
  builtAt: new Date().toISOString(),
}, null, 2)}\n`)

const catalogSource = join(root, 'shared', 'tenant-catalog.json')
const catalogTarget = join(root, 'backend', 'config', 'tenant-catalog.json')
if (existsSync(catalogSource)) {
  writeFileSync(catalogTarget, readFileSync(catalogSource, 'utf8'))
  console.log('Copied shared tenant catalog into backend/config for production runtime')
}

console.log(`Wrote backend build metadata for ${shortCommit}`)
