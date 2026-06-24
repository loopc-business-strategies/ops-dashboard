/**
 * Static release-readiness checks (no network). Run in CI before store builds.
 * Usage: node scripts/check-release-readiness.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED_BUNDLE_ID = 'com.loopc.nexa'
const EXPECTED_SCHEME = 'nexaops'

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`OK  ${message}`)
}

function assertMatch(label, content, pattern, hint = '') {
  if (!pattern.test(content)) {
    fail(`${label}${hint ? ` (${hint})` : ''}`)
    return false
  }
  ok(label)
  return true
}

const packageJson = JSON.parse(read('package.json'))
const appConfigSource = read('app.config.ts')
const appNameSource = read('appName.cjs')
const androidGradle = read('android/app/build.gradle')
const exportPlist = read('scripts/ios-export-options.plist')

const appVersionMatch = appConfigSource.match(/const APP_VERSION = '([^']+)'/)
const appVersion = appVersionMatch?.[1] || ''

if (packageJson.version !== appVersion) {
  fail(`version mismatch: package.json ${packageJson.version} vs app.config APP_VERSION ${appVersion}`)
} else {
  ok(`version aligned (${packageJson.version})`)
}

assertMatch(
  'app.config ios.bundleIdentifier',
  appConfigSource,
  new RegExp(`bundleIdentifier:\\s*'${EXPECTED_BUNDLE_ID}'`),
)
assertMatch(
  'app.config android.package',
  appConfigSource,
  new RegExp(`package:\\s*'${EXPECTED_BUNDLE_ID}'`),
)
assertMatch(
  'app.config scheme',
  appConfigSource,
  new RegExp(`scheme:\\s*'${EXPECTED_SCHEME}'`),
)
assertMatch(
  'appName.cjs',
  appNameSource,
  /APP_NAME:\s*'Nexa'/,
)
assertMatch(
  'android applicationId',
  androidGradle,
  new RegExp(`applicationId\\s+'${EXPECTED_BUNDLE_ID}'`),
)
assertMatch(
  'android namespace',
  androidGradle,
  new RegExp(`namespace\\s+'${EXPECTED_BUNDLE_ID}'`),
)
assertMatch(
  'ios export profile mapping',
  exportPlist,
  new RegExp(`<key>${EXPECTED_BUNDLE_ID}</key>[\\s\\S]*<string>Nexa App Store</string>`),
)

const workflowPaths = [
  '../.github/workflows/mobile-ios-testflight.yml',
  '../.github/workflows/mobile-android-bundle.yml',
]
for (const rel of workflowPaths) {
  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full)) {
    fail(`missing workflow ${rel}`)
  } else {
    ok(`workflow present (${path.basename(full)})`)
  }
}

if (process.exitCode) {
  console.error('Release readiness: FAILED')
  process.exit(1)
}

console.log('Release readiness: PASSED')
