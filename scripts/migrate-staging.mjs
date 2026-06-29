#!/usr/bin/env node
/**
 * Run backend migrations against staging Mongo (from backend/.env.staging.local).
 * Usage:
 *   node scripts/migrate-staging.mjs
 *   node scripts/migrate-staging.mjs --apply --confirm=$MIGRATION_CONFIRM_TOKEN
 *   node scripts/migrate-staging.mjs --until=002-backfill-mapping-departments
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
const { mapStagingMongoToProcessEnv } = require(path.join(backendDir, 'utils', 'stagingMongoSafety.js'))

const env = {
  ...process.env,
  ...mapStagingMongoToProcessEnv(process.env),
}

const runnerArgs = ['migrations/runner.js', ...process.argv.slice(2)]
const result = spawnSync('node', runnerArgs, {
  cwd: backendDir,
  env,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)
