/**
 * Run Gradle from mobile/android (no EAS). Usage:
 *   node scripts/gradle-android.mjs bundleRelease
 *   node scripts/gradle-android.mjs assembleRelease
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// SUBST (e.g. Q:\) shortens native compile paths, but Gradle's JVM often cannot use a SUBST
// path as cwd (errno 3). build-mobile-apk-subst-q.cmd sets OPS_DASHBOARD_REPO_ROOT to the
// real disk path so we cd to C:\...\mobile\android for gradlew while npm still runs from Q:\.
const repoRoot = process.env.OPS_DASHBOARD_REPO_ROOT
const androidDir = repoRoot
  ? path.resolve(repoRoot, 'mobile', 'android')
  : path.resolve(__dirname, '..', 'android')
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

// Windows: (1) Do not pass `cwd: androidDir` — CreateProcess can errno 3 on SUBST drives.
// (2) Do not pass one `cmd /c "cd ... && gradlew..."` string — Node/libuv quoting on Windows
// often breaks `&&` / nested quotes → "The filename, directory name, or volume label syntax is incorrect."
// Instead write a tiny temp .bat (cd + call) and `cmd /d /c call <that.bat>` with simple argv.
const dirNorm = path.normalize(androidDir).replace(/[/\\]+$/, '')
const winQuoteBat = (p) => p.replace(/"/g, '""')
if (!/^[A-Za-z0-9_.-]+$/.test(task)) {
  console.error('Invalid Gradle task name (allowed: letters, digits, ._-)')
  process.exit(1)
}

let result
if (isWin) {
  const batPath = path.join(
    os.tmpdir(),
    `mg-ops-gradle-${process.pid}-${Date.now()}.bat`,
  )
  const batBody = [
    '@echo off',
    `cd /d "${winQuoteBat(dirNorm)}"`,
    'if errorlevel 1 exit /b 1',
    `call gradlew.bat ${task}`,
    'exit /b %ERRORLEVEL%',
  ].join('\r\n')
  fs.writeFileSync(batPath, batBody, 'utf8')
  result = spawnSync('cmd.exe', ['/d', '/c', 'call', batPath], {
    stdio: 'inherit',
    env,
  })
  try {
    fs.unlinkSync(batPath)
  } catch {
    /* ignore */
  }
} else {
  result = spawnSync('./gradlew', [task], {
    cwd: androidDir,
    stdio: 'inherit',
    env,
  })
}

const code = result.status === null ? 1 : result.status
if (result.error) {
  console.error('Failed to start Gradle:', result.error)
}
if (code !== 0) {
  console.error(`Gradle exited with code ${code} (task: ${task})`)
}
process.exit(code)
