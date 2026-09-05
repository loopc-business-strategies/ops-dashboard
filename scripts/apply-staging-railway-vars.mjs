#!/usr/bin/env node
/**
 * Apply missing security vars from backend/.env.staging.generated.local
 * to Railway STAGING ops-dashboard only. Never touches MONGO_URI_* or JWT_SECRET.
 *
 * Fail-closed: refuses known production Mongo hosts / production-like URIs if they
 * appear in the generated file or in Railway staging MONGO_* listings.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const generatedPath = path.join(rootDir, 'backend', '.env.staging.generated.local')
const require = createRequire(import.meta.url)
const {
  looksLikeNonProductionUri,
  isKnownProductionMongoHost,
  redactMongoUri,
} = require(path.join(rootDir, 'backend', 'utils', 'migrationSafety.js'))

const ENSURE_VOLUME_KEYS = {
  UPLOAD_STORAGE_ROOT: '/app/uploads',
  CHAT_UPLOAD_DIR: '/app/uploads/chat',
}

const APPLY_KEYS = [
  'SETUP_TOKEN',
  'CLEANUP_CONFIRM_TOKEN',
  'MIGRATION_CONFIRM_TOKEN',
  'ENABLE_SETUP',
  'ENABLE_ADMIN_CLEANUP_API',
  'ENABLE_DESTRUCTIVE_ADMIN_API',
  'REQUEST_BODY_LIMIT',
]

const NEVER_TOUCH = new Set([
  'JWT_SECRET',
  'MONGO_URI_MG',
  'MONGO_URI_CG',
  'MONGO_URI_LOOPC',
  'STAGING_SMOKE_AUTH_NAME',
  'STAGING_SMOKE_AUTH_PASSWORD',
  'STAGING_SMOKE_API_BASE',
  'NODE_ENV',
])

const MONGO_KEY_RE = /^(?:STAGING_)?MONGO_URI_[A-Z0-9_]+$/

function loadDotEnv(filePath) {
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

function parseKv(text) {
  const out = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

function runRailway(args) {
  const result = spawnSync('railway', args, {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || `railway ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function assertAppEnvStaging(bundle) {
  const appEnv = String(bundle.APP_ENV || process.env.APP_ENV || '').trim().toLowerCase()
  if (appEnv !== 'staging') {
    throw new Error(
      'Refusing apply-staging-railway-vars: APP_ENV must be staging '
      + `(generated file or process.env). Got ${appEnv || '(empty)'}.`,
    )
  }
}

function assertMongoValuesSafe(sourceLabel, entries) {
  for (const [key, value] of entries) {
    if (!MONGO_KEY_RE.test(key)) continue
    const uri = String(value || '').trim()
    if (!uri) continue
    if (isKnownProductionMongoHost(uri)) {
      throw new Error(
        `Refusing ${sourceLabel}: ${key} points at a known production Mongo host `
        + `(${redactMongoUri(uri)}).`,
      )
    }
    if (!looksLikeNonProductionUri(uri)) {
      throw new Error(
        `Refusing ${sourceLabel}: ${key}=${redactMongoUri(uri)} is not a non-production URI.`,
      )
    }
  }
}

function main() {
  if (!existsSync(generatedPath)) {
    throw new Error(`Missing ${generatedPath}. Run npm run setup:staging first.`)
  }

  const bundle = loadDotEnv(generatedPath)
  assertAppEnvStaging(bundle)
  assertMongoValuesSafe('generated staging env file', Object.entries(bundle))

  runRailway(['environment', 'staging'])
  runRailway(['service', 'ops-dashboard'])

  const existingKv = runRailway(['variable', 'list', '-e', 'staging', '-s', 'ops-dashboard', '--kv'])
  const existingMap = parseKv(existingKv)
  const existing = new Set(Object.keys(existingMap))

  assertMongoValuesSafe('Railway staging variable list', Object.entries(existingMap))

  console.log('Railway staging ops-dashboard — applying missing security vars only.')
  console.log('Skipping: JWT_SECRET, MONGO_URI_* (already configured for ops-dashboard-staging DBs).')

  const mongoKeys = ['MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC']
  const mongoOk = mongoKeys.every((key) => {
    const line = existingMap[key] || ''
    return /ops-dashboard-staging/i.test(line)
  })
  if (!mongoOk) {
    throw new Error(
      'Refusing: staging MONGO_URI_* must point at ops-dashboard-staging databases. '
      + 'Verify in Railway dashboard before applying security vars.',
    )
  }
  console.log('Verified: MONGO_URI_MG/CG/LOOPC already use ops-dashboard-staging databases (unchanged).')

  for (const [key, value] of Object.entries(ENSURE_VOLUME_KEYS)) {
    if (existing.has(key)) {
      console.log(`  keep ${key} (already set on staging)`)
      continue
    }
    runRailway(['variable', 'set', `${key}=${value}`, '-e', 'staging', '-s', 'ops-dashboard'])
    console.log(`  set ${key}=${value}`)
  }

  for (const key of APPLY_KEYS) {
    if (NEVER_TOUCH.has(key)) continue
    const value = bundle[key]
    if (!value) {
      console.log(`  skip ${key} (not in generated file)`)
      continue
    }
    if (existing.has(key)) {
      console.log(`  keep ${key} (already set on staging)`)
      continue
    }
    runRailway(['variable', 'set', `${key}=${value}`, '-e', 'staging', '-s', 'ops-dashboard'])
    console.log(`  set ${key}`)
  }

  if (!existing.has('DESTRUCTIVE_ADMIN_CONFIRM_TOKEN')) {
    const token = bundle.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN
    if (token) {
      runRailway(['variable', 'set', `DESTRUCTIVE_ADMIN_CONFIRM_TOKEN=${token}`, '-e', 'staging', '-s', 'ops-dashboard'])
      console.log('  set DESTRUCTIVE_ADMIN_CONFIRM_TOKEN')
    }
  } else {
    console.log('  keep DESTRUCTIVE_ADMIN_CONFIRM_TOKEN (already set on staging)')
  }

  console.log('\nStaging Railway security vars updated. Mongo URIs and JWT were not modified.')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
