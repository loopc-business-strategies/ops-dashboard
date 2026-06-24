/**
 * Report which GitHub Actions secrets exist for mobile store releases (names only).
 * Usage: node scripts/check-mobile-release-secrets.mjs
 * Requires: gh auth login (or GH_TOKEN) with repo access.
 */
import { spawnSync } from 'node:child_process'

const GROUPS = {
  'iOS signing (required for Mobile iOS workflow)': [
    'APPLE_TEAM_ID',
    'BUILD_CERTIFICATE_BASE64',
    'P12_PASSWORD',
    'BUILD_PROVISION_PROFILE_BASE64',
    'KEYCHAIN_PASSWORD',
  ],
  'iOS TestFlight upload (when upload_testflight=true)': [
    'APP_STORE_CONNECT_API_KEY_ID',
    'APP_STORE_CONNECT_ISSUER_ID',
    'APP_STORE_CONNECT_API_KEY',
  ],
  'Android Play upload signing (optional — without these CI uses debug signing)': [
    'ANDROID_KEYSTORE_BASE64',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
  ],
}

function listSecretNames() {
  const result = spawnSync('gh', ['secret', 'list', '--json', 'name'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    const err = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    throw new Error(err || 'gh secret list failed — run gh auth login')
  }
  const rows = JSON.parse(result.stdout || '[]')
  return new Set(rows.map((row) => String(row.name || '').trim()).filter(Boolean))
}

function main() {
  const present = listSecretNames()
  let missingRequired = 0

  console.log('Mobile release GitHub secrets audit\n')

  for (const [label, names] of Object.entries(GROUPS)) {
    console.log(label)
    for (const name of names) {
      const ok = present.has(name)
      console.log(`  ${ok ? '✓' : '✗'} ${name}`)
      if (!ok && label.startsWith('iOS signing')) missingRequired += 1
    }
    console.log('')
  }

  if (missingRequired === 0 && GROUPS['iOS signing (required for Mobile iOS workflow)'].every((n) => present.has(n))) {
    console.log('iOS signing: ready to run Mobile iOS (GitHub macOS) workflow.')
  } else {
    console.log('iOS signing: incomplete — see docs/MOBILE-IOS-GITHUB-BUILD.md and mobile/RELEASE_CHECKLIST.md')
  }

  const androidReady = GROUPS['Android Play upload signing (optional — without these CI uses debug signing)']
    .every((n) => present.has(n))
  if (androidReady) {
    console.log('Android signing: Play-upload keystore secrets configured for CI.')
  } else {
    console.log('Android signing: not configured in GitHub — CI AAB uses debug signing (internal QA only).')
  }

  process.exit(missingRequired > 0 ? 1 : 0)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
