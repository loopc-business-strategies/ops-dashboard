/**
 * MG alias — runs tenant-aware verify with TENANT=mg.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const result = spawnSync('node', [path.join(__dirname, 'verify-journal-jv-live.mjs')], {
  cwd: rootDir,
  env: { ...process.env, TENANT: 'mg' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
