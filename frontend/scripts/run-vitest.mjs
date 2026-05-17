import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const tempDir = fileURLToPath(new URL('../node_modules/.cache/tmp/', import.meta.url))
mkdirSync(tempDir, { recursive: true })

const child = spawn(
  process.execPath,
  ['./node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    env: {
      ...process.env,
      TMPDIR: tempDir,
      TMP: tempDir,
      TEMP: tempDir,
    },
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
