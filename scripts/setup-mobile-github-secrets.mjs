/**
 * Push mobile store signing secrets to GitHub Actions (repo Settings → Secrets).
 *
 * Prerequisites: gh auth login (or GH_TOKEN with repo + workflow scope)
 * Guide: docs/MOBILE-IOS-GITHUB-BUILD.md
 *
 * Usage:
 *   node scripts/setup-mobile-github-secrets.mjs --print-instructions
 *   node scripts/setup-mobile-github-secrets.mjs --from-env
 *   node scripts/setup-mobile-github-secrets.mjs \
 *     --p12-path ./nexa-distribution.p12 \
 *     --profile-path ./Nexa_App_Store.mobileprovision \
 *     --p8-path ./AuthKey_XXXXX.p8 \
 *     --keystore-path ./upload-keystore.jks \
 *     --google-services-path ./google-services.json
 *
 * Env vars for --from-env (text secrets):
 *   APPLE_TEAM_ID, P12_PASSWORD, KEYCHAIN_PASSWORD,
 *   APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_ISSUER_ID,
 *   ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS
 *
 * Env vars for file paths (--from-env):
 *   MOBILE_P12_PATH, MOBILE_PROFILE_PATH, MOBILE_P8_PATH, MOBILE_KEYSTORE_PATH, MOBILE_GOOGLE_SERVICES_PATH
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'

const TEXT_SECRETS = [
  'APPLE_TEAM_ID',
  'P12_PASSWORD',
  'KEYCHAIN_PASSWORD',
  'APP_STORE_CONNECT_API_KEY_ID',
  'APP_STORE_CONNECT_ISSUER_ID',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
]

const FILE_SECRET_MAP = {
  p12: 'BUILD_CERTIFICATE_BASE64',
  profile: 'BUILD_PROVISION_PROFILE_BASE64',
  p8: 'APP_STORE_CONNECT_API_KEY',
  keystore: 'ANDROID_KEYSTORE_BASE64',
  googleServices: 'GOOGLE_SERVICES_JSON_BASE64',
}

function parseArgs() {
  const args = process.argv.slice(2)
  const flags = {
    printInstructions: args.includes('--print-instructions'),
    fromEnv: args.includes('--from-env'),
    p12Path: null,
    profilePath: null,
    p8Path: null,
    keystorePath: null,
    googleServicesPath: null,
  }
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i]
    const val = args[i + 1]
    if (key === '--p12-path' && val) flags.p12Path = val
    if (key === '--profile-path' && val) flags.profilePath = val
    if (key === '--p8-path' && val) flags.p8Path = val
    if (key === '--keystore-path' && val) flags.keystorePath = val
    if (key === '--google-services-path' && val) flags.googleServicesPath = val
  }
  return flags
}

function runGh(args, input) {
  const result = spawnSync('gh', args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    throw new Error(message || `gh ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function setSecret(name, value) {
  if (!value || !String(value).trim()) return false
  runGh(['secret', 'set', name, '--repo', REPO], String(value))
  console.log(`  set ${name}`)
  return true
}

function fileToBase64(filePath) {
  const abs = path.resolve(rootDir, filePath)
  return readFileSync(abs).toString('base64')
}

function fileToText(filePath) {
  const abs = path.resolve(rootDir, filePath)
  return readFileSync(abs, 'utf8')
}

function printInstructions() {
  console.log('Mobile release secrets — where to do each step\n')
  console.log('1. Apple materials: docs/MOBILE-IOS-GITHUB-BUILD.md')
  console.log('   - App Store Connect app com.loopc.nexa')
  console.log('   - Distribution .p12 + profile "Nexa App Store" + API .p8 key')
  console.log('2. Android keystore: docs/MOBILE-ANDROID-LOCAL-BUILD.md (Signing section)')
  console.log('3. GitHub UI: https://github.com/' + REPO + '/settings/secrets/actions')
  console.log('4. Or run this script with file paths / --from-env\n')
  console.log('iOS secrets (GitHub Actions):')
  console.log('  APPLE_TEAM_ID, BUILD_CERTIFICATE_BASE64, P12_PASSWORD,')
  console.log('  BUILD_PROVISION_PROFILE_BASE64, KEYCHAIN_PASSWORD,')
  console.log('  APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_API_KEY')
  console.log('\nAndroid secrets (optional Play upload):')
  console.log('  ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS')
  console.log('\nAndroid FCM (optional — background push on release APK):')
  console.log('  GOOGLE_SERVICES_JSON_BASE64 (base64 of mobile/android/app/google-services.json)\n')
  console.log('Verify: npm run check:mobile-release-secrets')
  console.log('iOS workflow: Actions → Mobile iOS (GitHub macOS)')
  console.log('Android workflow: Actions → Mobile Android bundle')
}

function applyFromFlags(flags) {
  let count = 0

  if (flags.fromEnv) {
    flags.p12Path = flags.p12Path || process.env.MOBILE_P12_PATH
    flags.profilePath = flags.profilePath || process.env.MOBILE_PROFILE_PATH
    flags.p8Path = flags.p8Path || process.env.MOBILE_P8_PATH
    flags.keystorePath = flags.keystorePath || process.env.MOBILE_KEYSTORE_PATH
    flags.googleServicesPath = flags.googleServicesPath || process.env.MOBILE_GOOGLE_SERVICES_PATH
    for (const name of TEXT_SECRETS) {
      if (setSecret(name, process.env[name])) count += 1
    }
  }

  if (flags.p12Path) {
    setSecret(FILE_SECRET_MAP.p12, fileToBase64(flags.p12Path))
    count += 1
  }
  if (flags.profilePath) {
    setSecret(FILE_SECRET_MAP.profile, fileToBase64(flags.profilePath))
    count += 1
  }
  if (flags.p8Path) {
    setSecret(FILE_SECRET_MAP.p8, fileToText(flags.p8Path))
    count += 1
  }
  if (flags.keystorePath) {
    setSecret(FILE_SECRET_MAP.keystore, fileToBase64(flags.keystorePath))
    count += 1
  }
  if (flags.googleServicesPath) {
    setSecret(FILE_SECRET_MAP.googleServices, fileToBase64(flags.googleServicesPath))
    count += 1
  }

  return count
}

function main() {
  const flags = parseArgs()

  if (flags.printInstructions || (!flags.fromEnv && !flags.p12Path && !flags.profilePath && !flags.p8Path && !flags.keystorePath && !flags.googleServicesPath)) {
    printInstructions()
    if (!flags.fromEnv && !flags.p12Path) process.exit(0)
  }

  console.log(`Setting GitHub secrets on ${REPO}...\n`)
  const count = applyFromFlags(flags)

  if (count === 0) {
    console.error('No secrets set — pass --from-env and/or file paths. See --print-instructions.')
    process.exit(1)
  }

  console.log(`\nDone (${count} secret operation(s)). Run: npm run check:mobile-release-secrets`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
