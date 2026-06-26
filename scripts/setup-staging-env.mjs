#!/usr/bin/env node
/**
 * Generate staging Railway + GitHub config safely (no production DB writes by default).
 *
 * Usage:
 *   node scripts/setup-staging-env.mjs                    # generate tokens + print checklist
 *   node scripts/setup-staging-env.mjs --push-github      # push GitHub secrets (needs gh auth)
 *   node scripts/setup-staging-env.mjs --provision-users  # create smoke users in STAGING DBs only
 *   node scripts/setup-staging-env.mjs --check-github     # list which staging secrets exist
 */
import crypto from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const generatedPath = path.join(backendDir, '.env.staging.generated.local')
const stagingLocalPath = path.join(backendDir, '.env.staging.local')
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'
const DEFAULT_STAGING_API = 'https://ops-dashboard-staging-e6c6.up.railway.app'

const args = new Set(process.argv.slice(2))
const pushGithub = args.has('--push-github')
const provisionUsers = args.has('--provision-users')
const checkGithub = args.has('--check-github')

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const out = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

function ghAvailable() {
  return spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: process.platform === 'win32' }).status === 0
}

function runGh(argv, input) {
  const result = spawnSync('gh', argv, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || `gh ${argv.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function generateBundle(existing = {}) {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: existing.JWT_SECRET || randomToken(32),
    SETUP_TOKEN: existing.SETUP_TOKEN || randomToken(24),
    CLEANUP_CONFIRM_TOKEN: existing.CLEANUP_CONFIRM_TOKEN || randomToken(24),
    DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: existing.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN || randomToken(24),
    MIGRATION_CONFIRM_TOKEN: existing.MIGRATION_CONFIRM_TOKEN || randomToken(24),
    STAGING_SMOKE_AUTH_NAME: existing.STAGING_SMOKE_AUTH_NAME || 'ops-staging-smoke-probe',
    STAGING_SMOKE_AUTH_PASSWORD: existing.STAGING_SMOKE_AUTH_PASSWORD || randomToken(24),
    STAGING_SMOKE_API_BASE: existing.STAGING_SMOKE_API_BASE || DEFAULT_STAGING_API,
    ENABLE_SETUP: 'false',
    ENABLE_ADMIN_CLEANUP_API: 'false',
    ENABLE_DESTRUCTIVE_ADMIN_API: 'false',
  }
}

function writeGeneratedFile(bundle) {
  const lines = [
    '# AUTO-GENERATED — gitignored. Copy Railway block to Railway staging service.',
    '# Do NOT commit. Rotate if leaked.',
    '',
    ...Object.entries(bundle).map(([key, value]) => `${key}=${value}`),
    '',
    '# GitHub repository secrets (same values):',
    '# STAGING_SMOKE_AUTH_NAME, STAGING_SMOKE_AUTH_PASSWORD',
    '# STAGING_MONGO_URI_MG, STAGING_MONGO_URI_CG, STAGING_MONGO_URI_LOOPC (from Atlas staging clusters)',
  ]
  writeFileSync(generatedPath, `${lines.join('\n')}\n`, 'utf8')
}

function printRailwayBlock(bundle) {
  console.log('\n=== Railway staging service variables (paste into Railway) ===\n')
  console.log('NODE_ENV=production')
  console.log(`JWT_SECRET=${bundle.JWT_SECRET}`)
  console.log(`SETUP_TOKEN=${bundle.SETUP_TOKEN}`)
  console.log(`CLEANUP_CONFIRM_TOKEN=${bundle.CLEANUP_CONFIRM_TOKEN}`)
  console.log(`DESTRUCTIVE_ADMIN_CONFIRM_TOKEN=${bundle.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN}`)
  console.log(`MIGRATION_CONFIRM_TOKEN=${bundle.MIGRATION_CONFIRM_TOKEN}`)
  console.log('ENABLE_SETUP=false')
  console.log('ENABLE_ADMIN_CLEANUP_API=false')
  console.log('ENABLE_DESTRUCTIVE_ADMIN_API=false')
  console.log('REQUEST_BODY_LIMIT=5mb')
  console.log('SENTRY_ENVIRONMENT=staging')
  console.log('')
  console.log('# Set these from Atlas STAGING clusters (not production):')
  console.log('MONGO_URI_MG=<staging-mg-uri>')
  console.log('MONGO_URI_CG=<staging-cg-uri>')
  console.log('MONGO_URI_LOOPC=<staging-loopc-uri>')
  console.log('')
  console.log(`SERVER_BASE_URL=${bundle.STAGING_SMOKE_API_BASE}`)
  console.log(`CLIENT_URLS=<your-staging-vercel-preview-host>`)
}

function printGithubChecklist(bundle) {
  console.log('\n=== GitHub Actions (Settings → Secrets and variables) ===\n')
  console.log('Repository secrets:')
  console.log(`  STAGING_SMOKE_AUTH_NAME = ${bundle.STAGING_SMOKE_AUTH_NAME}`)
  console.log(`  STAGING_SMOKE_AUTH_PASSWORD = ${bundle.STAGING_SMOKE_AUTH_PASSWORD}`)
  console.log('  STAGING_MONGO_URI_MG / _CG / _LOOPC = staging Atlas URIs (for provision workflow)')
  console.log('')
  console.log('Repository variables (after smoke users exist):')
  console.log(`  STAGING_SMOKE_API_BASE = ${bundle.STAGING_SMOKE_API_BASE}`)
  console.log('  STAGING_SMOKE_REQUIRE_AUTH = true')
  console.log('  STAGING_SMOKE_REQUIRE_MOBILE_AUTH = true')
  console.log('  STAGING_SMOKE_SKIP_FRONTEND = true   # until Vercel preview host is ready')
}

function pushStagingMongoSecrets() {
  if (!existsSync(stagingLocalPath)) {
    throw new Error(
      `Missing ${stagingLocalPath}. Run: node scripts/sync-staging-mongo-local.mjs`,
    )
  }

  const { assertStagingMongoTargets } = require(path.join(backendDir, 'utils', 'stagingMongoSafety.js'))
  const localEnv = loadDotEnv(stagingLocalPath)
  assertStagingMongoTargets(['mg', 'cg', 'loopc'], localEnv)

  for (const tenant of ['MG', 'CG', 'LOOPC']) {
    const key = `STAGING_MONGO_URI_${tenant}`
    const value = String(localEnv[key] || '').trim()
    if (!value) {
      throw new Error(`Missing ${key} in ${stagingLocalPath}`)
    }
    runGh(['secret', 'set', key, '-R', REPO], `${value}\n`)
    console.log(`  set ${key}`)
  }
}

function pushGithubSecrets(bundle) {
  if (!ghAvailable()) {
    throw new Error('GitHub CLI not authenticated. Run: gh auth login')
  }
  console.log(`\nPushing staging smoke secrets to ${REPO}...`)
  runGh(['secret', 'set', 'STAGING_SMOKE_AUTH_NAME', '-R', REPO], `${bundle.STAGING_SMOKE_AUTH_NAME}\n`)
  runGh(['secret', 'set', 'STAGING_SMOKE_AUTH_PASSWORD', '-R', REPO], `${bundle.STAGING_SMOKE_AUTH_PASSWORD}\n`)
  for (const tenant of ['MG', 'CG', 'LOOPC']) {
    runGh(['secret', 'set', `STAGING_SMOKE_AUTH_NAME_${tenant}`, '-R', REPO], `${bundle.STAGING_SMOKE_AUTH_NAME}\n`)
    runGh(['secret', 'set', `STAGING_SMOKE_AUTH_PASSWORD_${tenant}`, '-R', REPO], `${bundle.STAGING_SMOKE_AUTH_PASSWORD}\n`)
  }
  console.log('Pushing STAGING_MONGO_URI_* from backend/.env.staging.local...')
  pushStagingMongoSecrets()
  runGh(['variable', 'set', 'STAGING_SMOKE_API_BASE', '-R', REPO], `${bundle.STAGING_SMOKE_API_BASE}\n`)
  runGh(['variable', 'set', 'STAGING_SMOKE_REQUIRE_AUTH', '-R', REPO], 'true\n')
  runGh(['variable', 'set', 'STAGING_SMOKE_REQUIRE_MOBILE_AUTH', '-R', REPO], 'true\n')
  console.log('GitHub staging smoke secrets, Mongo URIs, and variables configured.')
}

function checkGithubSecrets() {
  if (!ghAvailable()) {
    console.log('GitHub CLI not authenticated — run: gh auth login')
    return
  }
  const secrets = runGh(['secret', 'list', '-R', REPO])
  const vars = runGh(['variable', 'list', '-R', REPO])
  const wanted = [
    'STAGING_SMOKE_AUTH_NAME',
    'STAGING_SMOKE_AUTH_PASSWORD',
    'STAGING_MONGO_URI_MG',
    'STAGING_MONGO_URI_CG',
    'STAGING_MONGO_URI_LOOPC',
  ]
  console.log('\n=== GitHub staging secret status ===\n')
  for (const name of wanted) {
    const ok = new RegExp(`\\b${name}\\b`, 'm').test(secrets)
    console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  }
  console.log('\nVariables:')
  for (const name of ['STAGING_SMOKE_API_BASE', 'STAGING_SMOKE_REQUIRE_AUTH', 'STAGING_SMOKE_REQUIRE_MOBILE_AUTH']) {
    const ok = new RegExp(`\\b${name}\\b`, 'm').test(vars)
    console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  }
}

function provisionStagingSmokeUsers(bundle) {
  if (!existsSync(stagingLocalPath)) {
    throw new Error(
      `Missing ${stagingLocalPath}. Copy backend/.env.staging.local.example and add STAGING Mongo URIs only.`,
    )
  }

  const { assertStagingMongoTargets, mapStagingMongoToProcessEnv } = require(path.join(backendDir, 'utils', 'stagingMongoSafety.js'))
  const localEnv = loadDotEnv(stagingLocalPath)
  assertStagingMongoTargets(['mg', 'cg', 'loopc'], localEnv)

  const childEnv = mapStagingMongoToProcessEnv({
    ...process.env,
    ...localEnv,
    SMOKE_AUTH_NAME: bundle.STAGING_SMOKE_AUTH_NAME,
    SMOKE_AUTH_PASSWORD: bundle.STAGING_SMOKE_AUTH_PASSWORD,
    SMOKE_API_BASE: bundle.STAGING_SMOKE_API_BASE,
  })

  console.log('\nProvisioning smoke users in STAGING databases only (validated non-production URIs)...')
  const result = spawnSync(
    process.execPath,
    ['scripts/setup-smoke-github-secrets.js', '--staging', '--users-only', '--skip-verify'],
    { cwd: rootDir, stdio: 'inherit', env: childEnv, shell: false },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  console.log('Staging smoke users provisioned. Run --push-github if secrets are not in GitHub yet.')
}

function main() {
  const existing = loadDotEnv(generatedPath)
  const bundle = generateBundle(existing)
  writeGeneratedFile(bundle)

  console.log('Staging setup — no production data touched.')
  console.log(`Generated local file: ${generatedPath}`)
  printRailwayBlock(bundle)
  printGithubChecklist(bundle)

  if (checkGithub) {
    checkGithubSecrets()
  }

  if (pushGithub) {
    pushGithubSecrets(bundle)
  } else if (!checkGithub && !provisionUsers) {
    console.log('\nNext commands (safe):')
    console.log('  gh auth login')
    console.log('  node scripts/setup-staging-env.mjs --check-github')
    console.log('  node scripts/setup-staging-env.mjs --push-github')
    console.log('  # After backend/.env.staging.local has STAGING_MONGO_URI_*:')
    console.log('  node scripts/setup-staging-env.mjs --provision-users')
    console.log('\nOr use GitHub Actions → "Provision Staging Smoke Credentials" after STAGING_MONGO_URI_* secrets are set.')
  }

  if (provisionUsers) {
    provisionStagingSmokeUsers(bundle)
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
