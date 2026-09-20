/**
 * Run Gradle from mg-floor/android (no EAS). Usage:
 *   node scripts/gradle-android.mjs bundleRelease
 *   node scripts/gradle-android.mjs assembleRelease
 *
 * Path resolution (first match wins):
 *   OPS_MG_FLOOR_JUNCTION_ROOT/android
 *   OPS_DASHBOARD_REPO_ROOT/mg-floor/android
 *   ../android (relative to this script)
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mgFloorJunction = process.env.OPS_MG_FLOOR_JUNCTION_ROOT
const repoRoot = process.env.OPS_DASHBOARD_REPO_ROOT
const androidDir = mgFloorJunction
  ? path.resolve(mgFloorJunction, 'android')
  : repoRoot
    ? path.resolve(repoRoot, 'mg-floor', 'android')
    : path.resolve(__dirname, '..', 'android')
const task = process.argv[2] || 'bundleRelease'
const keystorePropertiesPath = path.join(androidDir, 'keystore.properties')
const allowDebugReleaseSigning =
  process.env.ANDROID_ALLOW_DEBUG_RELEASE_SIGNING === 'true'
  || !fs.existsSync(keystorePropertiesPath)
const signingGradleArg = allowDebugReleaseSigning ? ' -PallowDebugReleaseSigning=true' : ''
if (allowDebugReleaseSigning && !fs.existsSync(keystorePropertiesPath)) {
  console.warn(
    'android/keystore.properties not found — using debug signing for release (internal QA only, not Play Store).',
  )
}

const isWin = process.platform === 'win32'
const env = { ...process.env }
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

const dirNorm = path.normalize(androidDir).replace(/[/\\]+$/, '')
const winQuoteBat = (p) => p.replace(/"/g, '""')
if (!/^[A-Za-z0-9_.-]+$/.test(task)) {
  console.error('Invalid Gradle task name (allowed: letters, digits, ._-)')
  process.exit(1)
}

if (!fs.existsSync(path.join(dirNorm, isWin ? 'gradlew.bat' : 'gradlew'))) {
  console.error(
    `Native Android project not found at ${dirNorm}\n` +
      'Run first: npm run prebuild:android  (from mg-floor/) or npm run mg-floor:prebuild:android',
  )
  process.exit(1)
}

let result
if (isWin) {
  const batPath = path.join(
    os.tmpdir(),
    `mg-floor-gradle-${process.pid}-${Date.now()}.bat`,
  )
  const batBody = [
    '@echo off',
    `cd /d "${winQuoteBat(dirNorm)}"`,
    'if errorlevel 1 exit /b 1',
    `call gradlew.bat ${task}${archGradleArg}${signingGradleArg}`,
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
  if (archGradleArg.trim()) {
    args.push(archGradleArg.trim())
  }
  if (signingGradleArg.trim()) {
    args.push(signingGradleArg.trim())
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
