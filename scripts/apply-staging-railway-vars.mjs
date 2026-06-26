#!/usr/bin/env node
/**
 * Apply missing security vars from backend/.env.staging.generated.local
 * to Railway STAGING ops-dashboard only. Never touches MONGO_URI_* or JWT_SECRET.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const generatedPath = path.join(rootDir, 'backend', '.env.staging.generated.local')

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

function main() {
  if (!existsSync(generatedPath)) {
    throw new Error(`Missing ${generatedPath}. Run npm run setup:staging first.`)
  }

  const bundle = loadDotEnv(generatedPath)
  runRailway(['environment', 'staging'])
  runRailway(['service', 'ops-dashboard'])

  const existingKv = runRailway(['variable', 'list', '-e', 'staging', '-s', 'ops-dashboard', '--kv'])
  const existing = new Set(
    existingKv.split(/\r?\n/).map((line) => line.split('=')[0]).filter(Boolean),
  )

  console.log('Railway staging ops-dashboard — applying missing security vars only.')
  console.log('Skipping: JWT_SECRET, MONGO_URI_* (already configured for ops-dashboard-staging DBs).')

  let mongoOk = ['MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC'].every((key) => {
    const line = existingKv.split(/\r?\n/).find((row) => row.startsWith(`${key}=`))
    return line && /ops-dashboard-staging/i.test(line)
  })
  if (!mongoOk) {
    console.warn('Warning: staging MONGO_URI_* may not point at ops-dashboard-staging databases — verify in Railway dashboard.')
  } else {
    console.log('Verified: MONGO_URI_MG/CG/LOOPC already use ops-dashboard-staging databases (unchanged).')
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
