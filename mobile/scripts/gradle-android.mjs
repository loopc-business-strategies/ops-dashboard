/**
 * Run Gradle from mobile/android (no EAS). Usage:
 *   node scripts/gradle-android.mjs bundleRelease
 *   node scripts/gradle-android.mjs assembleRelease
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const androidDir = path.resolve(__dirname, '..', 'android')
const task = process.argv[2] || 'bundleRelease'

const isWin = process.platform === 'win32'
// Match eas.json: release builds succeed without Sentry org/token unless caller opts in.
const env = { ...process.env }
if (env.SENTRY_DISABLE_AUTO_UPLOAD === undefined) {
  env.SENTRY_DISABLE_AUTO_UPLOAD = 'true'
}
if (env.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD === undefined) {
  env.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD = 'true'
}

// Windows: do not pass `cwd: androidDir` to spawnSync. CreateProcess can fail with errno 3
// for SUBST/virtual drive paths (e.g. Q:\...) even when `dir` and `cd` in cmd work fine.
// Run `cd /d` + `gradlew.bat` inside one `cmd /c` line (no child cwd). Use `/` in the path
// fragment and strip a trailing separator so we never produce `"Q:\path\"` (breaks cmd).
// Omit `/s` on cmd — combined with nested `"` it can yield "syntax is incorrect" on some setups.
const dirNorm = path.normalize(androidDir).replace(/[/\\]+$/, '')
const dirForCmd = dirNorm.replace(/\\/g, '/')
const winQuoteCmd = (p) => p.replace(/"/g, '""')
if (!/^[A-Za-z0-9_.-]+$/.test(task)) {
  console.error('Invalid Gradle task name (allowed: letters, digits, ._-)')
  process.exit(1)
}
const cmdLine = `cd /d "${winQuoteCmd(dirForCmd)}" && call gradlew.bat ${task}`
const result = isWin
  ? spawnSync('cmd.exe', ['/d', '/c', cmdLine], { stdio: 'inherit', env })
  : spawnSync('./gradlew', [task], {
      cwd: androidDir,
      stdio: 'inherit',
      env,
    })

const code = result.status === null ? 1 : result.status
if (result.error) {
  console.error('Failed to start Gradle:', result.error)
}
if (code !== 0) {
  console.error(`Gradle exited with code ${code} (task: ${task})`)
}
process.exit(code)
