/**
 * `npm test` entry point.
 *
 * Linux/CI: `jest --runInBand` (unchanged).
 * Windows: one worker that is recycled once it exceeds WINDOWS_WORKER_MEMORY_LIMIT. Suites still run one at a
 * time, but a single in-band process grows past ~2 GB over the full suite and Node 24 on Windows aborts with
 * 0xC0000409. Passing --runInBand / -i / --maxWorkers / --detectOpenHandles keeps the caller's choice.
 *
 * --experimental-vm-modules: mongodb >= 7.6 loads `os` with a dynamic `import()`. Without the flag that import
 * throws inside Jest's sandbox, the driver silently sends empty client metadata, and mongod rejects every
 * connection with "Missing required sub-document 'driver'".
 */
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

const WINDOWS_WORKER_MEMORY_LIMIT = '800MB'

const backendDir = fileURLToPath(new URL('..', import.meta.url))
const userArgs = process.argv.slice(2)
const callerChoseMode = userArgs.some((arg) =>
  arg === '--runInBand' || arg === '-i' || arg.startsWith('--maxWorkers') || arg.startsWith('-w')
  || arg === '--detectOpenHandles' || arg.startsWith('--workerIdleMemoryLimit'),
)

const modeArgs = callerChoseMode
  ? []
  : process.platform === 'win32'
    ? ['--maxWorkers=1', `--workerIdleMemoryLimit=${WINDOWS_WORKER_MEMORY_LIMIT}`]
    : ['--runInBand']

const child = spawn(
  process.execPath,
  [
    '--experimental-vm-modules',
    '--disable-warning=ExperimentalWarning',
    './node_modules/jest/bin/jest.js',
    ...modeArgs,
    '--cacheDirectory',
    './node_modules/.cache/jest',
    ...userArgs,
  ],
  { cwd: backendDir, stdio: 'inherit', env: process.env },
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
