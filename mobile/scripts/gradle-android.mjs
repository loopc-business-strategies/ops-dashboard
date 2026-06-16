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
// Windows SUBST (Q:\) is great for npm cwd but Gradle's JVM often errno 3 on Q:\ paths.
// Using the real Desktop path fixes errno 3 but Ninja hits MAX_PATH. build-mobile-apk-subst-q.cmd
// creates a short junction (e.g. C:\mgops-m -> ...\mobile) and sets OPS_MOBILE_JUNCTION_ROOT
// so Gradle + native codegen see short paths on a normal drive letter.
const mobileJunction = process.env.OPS_MOBILE_JUNCTION_ROOT
const repoRoot = process.env.OPS_DASHBOARD_REPO_ROOT
const androidDir = mobileJunction
  ? path.resolve(mobileJunction, 'android')
  : repoRoot
    ? path.resolve(repoRoot, 'mobile', 'android')
    : path.resolve(__dirname, '..', 'android')
const task = process.argv[2] || 'bundleRelease'

const isWin = process.platform === 'win32'
// Match eas.json: release builds succeed without Sentry org/token unless caller opts in.
const env = { ...process.env }
// Some tooling sets GRADLE_USER_HOME under a very long Temp path; Ninja then fails with
// "Filename longer than 260 characters" on prefab/transform paths. Prefer ~/.gradle on Windows.
if (
  isWin &&
  env.GRADLE_USER_HOME &&
  /sandbox-cache|cursor-sandbox/i.test(env.GRADLE_USER_HOME)
) {
  env.GRADLE_USER_HOME = path.join(os.homedir(), '.gradle')
}
if (env.SENTRY_DISABLE_AUTO_UPLOAD === undefined) {
  env.SENTRY_DISABLE_AUTO_UPLOAD = 'true'
}
if (env.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD === undefined) {
  env.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD = 'true'
}

const archList = env.OPS_REACT_NATIVE_ARCHS
const archGradleArg =
  archList && /^[a-zA-Z0-9_,-]+$/.test(archList)
    ? ` -PreactNativeArchitectures=${archList}`
    : ''

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
    `call gradlew.bat ${task}${archGradleArg}`,
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
  const args = [task]
  if (archGradleArg) {
    args.push(archGradleArg.trim())
  }
  result = spawnSync('./gradlew', args, {
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
