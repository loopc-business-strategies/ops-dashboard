/** Backward-compatible alias for run-jv-live-verify.mjs (default tenant mg). */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
if (!args.includes('--tenant')) args.unshift('--tenant', 'mg')

const result = spawnSync('node', [path.join(__dirname, 'run-jv-live-verify.mjs'), ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
