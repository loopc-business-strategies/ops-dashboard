#!/usr/bin/env node
/**
 * Run backend migrations against staging Mongo (from backend/.env.staging.local).
 * Usage:
 *   node scripts/migrate-staging.mjs
 *   node scripts/migrate-staging.mjs --apply --confirm=$MIGRATION_CONFIRM_TOKEN
 *   node scripts/migrate-staging.mjs --until=002-backfill-mapping-departments
 *
 * Requires APP_ENV=staging (established here) and dedicated STAGING_MONGO_URI_*.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const stagingLocalPath = path.join(backendDir, '.env.staging.local')

const dotenv = require('dotenv')
dotenv.config({ path: stagingLocalPath })
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require(path.join(backendDir, 'utils', 'stagingMongoSafety.js'))
const { assertStagingOnlyScript } = require(path.join(backendDir, 'utils', 'assertStagingOnlyScript.js'))

const STAGING_TENANTS = ['mg', 'cg', 'loopc']

const baseEnv = {
  ...process.env,
  APP_ENV: 'staging',
}

try {
  assertStagingMongoTargets(STAGING_TENANTS, baseEnv)
  assertStagingOnlyScript(
    { scriptName: 'migrate-staging', tenants: STAGING_TENANTS },
    baseEnv,
    process.argv,
  )
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}

const env = mapStagingMongoToProcessEnv(baseEnv)
env.APP_ENV = 'staging'

const runnerArgs = ['migrations/runner.js', ...process.argv.slice(2)]
const result = spawnSync('node', runnerArgs, {
  cwd: backendDir,
  env,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)
