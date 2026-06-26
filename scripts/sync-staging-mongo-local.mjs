#!/usr/bin/env node
/**
 * Sync STAGING_MONGO_URI_* from Railway staging into backend/.env.staging.local
 * (gitignored). Never reads production backend/.env.
 */
import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const stagingLocalPath = path.join(rootDir, 'backend', '.env.staging.local')
const DEFAULT_STAGING_API = 'https://ops-dashboard-staging-e6c6.up.railway.app'

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
  const raw = runRailway(['variable', 'list', '-e', 'staging', '-s', 'ops-dashboard', '--json'])
  const vars = JSON.parse(raw)

  const mapping = {
    STAGING_MONGO_URI_MG: vars.MONGO_URI_MG,
    STAGING_MONGO_URI_CG: vars.MONGO_URI_CG,
    STAGING_MONGO_URI_LOOPC: vars.MONGO_URI_LOOPC,
  }

  for (const [key, value] of Object.entries(mapping)) {
    if (!String(value || '').trim()) {
      throw new Error(`Railway staging missing ${key.replace('STAGING_', '')}`)
    }
    if (!/ops-dashboard-staging/i.test(String(value))) {
      throw new Error(`Refusing to sync ${key}: URI does not target ops-dashboard-staging`)
    }
  }

  const lines = [
    '# Local staging provisioning ONLY — synced from Railway staging',
    '# Never put production MONGO_URI_* values in this file.',
    '',
    `STAGING_MONGO_URI_MG=${mapping.STAGING_MONGO_URI_MG}`,
    `STAGING_MONGO_URI_CG=${mapping.STAGING_MONGO_URI_CG}`,
    `STAGING_MONGO_URI_LOOPC=${mapping.STAGING_MONGO_URI_LOOPC}`,
    '',
    `STAGING_SMOKE_API_BASE=${vars.SERVER_BASE_URL || DEFAULT_STAGING_API}`,
    '',
  ]

  writeFileSync(stagingLocalPath, `${lines.join('\n')}\n`, 'utf8')

  const { assertStagingMongoTargets } = require(path.join(rootDir, 'backend', 'utils', 'stagingMongoSafety.js'))
  assertStagingMongoTargets(['mg', 'cg', 'loopc'], Object.fromEntries(
    Object.entries(mapping).map(([k, v]) => [k, v]),
  ))

  console.log(`Wrote ${stagingLocalPath} from Railway staging (ops-dashboard-staging DBs).`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
