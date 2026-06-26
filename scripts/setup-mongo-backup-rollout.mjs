#!/usr/bin/env node
/**
 * Mongo backup rollout — Phase 1 drill + Phase 2 R2 mongodump + GitHub secrets/variables.
 *
 * Requires (from backend/.env or environment):
 *   MONGO_URI_MG, MONGO_URI_CG, MONGO_URI_LOOPC
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  (for R2 bucket creation)
 *   BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY   (R2 S3 API token — or create in dashboard)
 *
 * GitHub: gh auth login OR GH_TOKEN with repo admin + actions scope.
 *
 * Usage:
 *   node scripts/setup-mongo-backup-rollout.mjs --check
 *   node scripts/setup-mongo-backup-rollout.mjs --r2
 *   node scripts/setup-mongo-backup-rollout.mjs --github
 *   node scripts/setup-mongo-backup-rollout.mjs --trigger-drill
 *   node scripts/setup-mongo-backup-rollout.mjs --trigger-mongodump
 *   node scripts/setup-mongo-backup-rollout.mjs --all
 */
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const envPath = path.join(backendDir, '.env')
const generatedPath = path.join(backendDir, '.env.backup.generated.local')
const REPO = process.env.GITHUB_REPOSITORY || 'loopc-business-strategies/ops-dashboard'
const DEFAULT_BUCKET = 'ops-dashboard-mongo-backups'

const require = createRequire(import.meta.url)
const args = new Set(process.argv.slice(2))
const runAll = args.size === 0 || args.has('--all')
const runCheck = runAll || args.has('--check')
const runR2 = runAll || args.has('--r2')
const runGithub = runAll || args.has('--github')
const runTriggerDrill = runAll || args.has('--trigger-drill')
const runTriggerMongodump = runAll || args.has('--trigger-mongodump')

require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: envPath })

function loadEnvFile(filePath) {
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

function env(key, fallback = '') {
  return String(process.env[key] || fallback).trim()
}

function ghAvailable() {
  if (env('GH_TOKEN') || env('GITHUB_TOKEN')) return true
  if (resolveGhTokenFromGit()) return true
  return spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', shell: process.platform === 'win32' }).status === 0
}

function resolveGhTokenFromGit() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return true
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  })
  const match = (result.stdout || '').match(/^password=(.+)$/m)
  if (!match) return false
  process.env.GH_TOKEN = match[1].trim()
  return true
}

function runGh(argv, input) {
  const result = spawnSync('gh', argv, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join('\n').trim() || `gh ${argv.join(' ')} failed`)
  }
  return (result.stdout || '').trim()
}

async function cfApi(method, apiPath, body) {
  const token = env('CLOUDFLARE_API_TOKEN')
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
  const res = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join('; ') || res.statusText
    throw new Error(`Cloudflare API ${method} ${apiPath}: ${msg}`)
  }
  return json.result
}

async function ensureR2Bucket() {
  const accountId = env('CLOUDFLARE_ACCOUNT_ID')
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set')
  const bucket = env('BACKUP_S3_BUCKET', DEFAULT_BUCKET)

  console.log('\n=== Cloudflare R2 bucket ===\n')
  const buckets = await cfApi('GET', `/accounts/${accountId}/r2/buckets`)
  const exists = (buckets?.buckets || buckets || []).some?.((b) => b.name === bucket)
    || Array.isArray(buckets) && buckets.some((b) => b.name === bucket)

  if (exists) {
    console.log(`  Bucket "${bucket}" already exists.`)
  } else {
    await cfApi('POST', `/accounts/${accountId}/r2/buckets`, { name: bucket })
    console.log(`  Created bucket "${bucket}".`)
  }

  const endpoint = env('BACKUP_S3_ENDPOINT') || `https://${accountId}.r2.cloudflarestorage.com`
  process.env.BACKUP_S3_ENDPOINT = endpoint
  process.env.BACKUP_S3_BUCKET = bucket

  if (!env('BACKUP_S3_ACCESS_KEY') || !env('BACKUP_S3_SECRET_KEY')) {
    console.log('\n  R2 S3 API credentials not in env.')
    console.log('  Cloudflare dashboard → R2 → Manage R2 API Tokens → Object Read and Write')
    console.log(`  Scope to bucket "${bucket}". Save Access Key ID + Secret Access Key to backend/.env:`)
    console.log('    BACKUP_S3_ACCESS_KEY=...')
    console.log('    BACKUP_S3_SECRET_KEY=...')
    console.log(`    BACKUP_S3_ENDPOINT=${endpoint}`)
    console.log(`    BACKUP_S3_BUCKET=${bucket}`)
    return { bucket, endpoint, s3KeysReady: false }
  }

  const lines = [
    '# AUTO-GENERATED — gitignored. Used for local mongodump dry-runs.',
    `BACKUP_S3_ENDPOINT=${endpoint}`,
    `BACKUP_S3_BUCKET=${bucket}`,
    `BACKUP_S3_ACCESS_KEY=${env('BACKUP_S3_ACCESS_KEY')}`,
    `BACKUP_S3_SECRET_KEY=${env('BACKUP_S3_SECRET_KEY')}`,
    'BACKUP_S3_REGION=auto',
    'BACKUP_S3_PREFIX=ops-dashboard',
    'BACKUP_RETAIN_DAYS=7',
    '',
  ]
  writeFileSync(generatedPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`  Wrote ${generatedPath}`)
  return { bucket, endpoint, s3KeysReady: true }
}

function pushGithubSecrets() {
  if (!ghAvailable()) {
    throw new Error('GitHub not authenticated. Run: gh auth login  OR  set GH_TOKEN')
  }

  const fileEnv = loadEnvFile(envPath)
  const secretKeys = [
    'MONGO_URI_MG',
    'MONGO_URI_CG',
    'MONGO_URI_LOOPC',
    'BACKUP_S3_ENDPOINT',
    'BACKUP_S3_BUCKET',
    'BACKUP_S3_ACCESS_KEY',
    'BACKUP_S3_SECRET_KEY',
  ]

  console.log(`\n=== GitHub secrets (${REPO}) ===\n`)
  for (const key of secretKeys) {
    const value = env(key) || String(fileEnv[key] || '').trim()
    if (!value) throw new Error(`Missing ${key} — set in backend/.env before --github`)
    runGh(['secret', 'set', key, '-R', REPO], `${value}\n`)
    console.log(`  set ${key}`)
  }
}

function pushGithubVariables() {
  if (!ghAvailable()) {
    throw new Error('GitHub not authenticated. Run: gh auth login  OR  set GH_TOKEN')
  }

  const variables = {
    ATLAS_BACKUP_PHASE: 'deferred',
    MONGO_BACKUP_ENABLED: 'true',
    MONGO_BACKUP_S3_CONFIGURED: (env('BACKUP_S3_ACCESS_KEY') && env('BACKUP_S3_SECRET_KEY')) ? 'true' : 'false',
    BACKUP_S3_REGION: env('BACKUP_S3_REGION', 'auto'),
    BACKUP_S3_PREFIX: env('BACKUP_S3_PREFIX', 'ops-dashboard'),
    BACKUP_RETAIN_DAYS: env('BACKUP_RETAIN_DAYS', '7'),
  }

  console.log(`\n=== GitHub variables (${REPO}) ===\n`)
  for (const [name, value] of Object.entries(variables)) {
    runGh(['variable', 'set', name, '-R', REPO], `${value}\n`)
    console.log(`  set ${name}=${value}`)
  }
}

function triggerWorkflow(workflowFile, fields = []) {
  if (!ghAvailable()) {
    throw new Error('GitHub not authenticated. Run: gh auth login  OR  set GH_TOKEN')
  }
  const argv = ['workflow', 'run', workflowFile, '--ref', 'main', '-R', REPO]
  for (const pair of fields) {
    const [key, value] = pair.split('=')
    argv.push('-f', `${key}=${value}`)
  }
  runGh(argv)
  console.log(`  Dispatched ${workflowFile}`)
}

function checkStatus() {
  console.log('Mongo backup rollout — status check\n')
  const checks = [
    ['MONGO_URI_MG', env('MONGO_URI_MG')],
    ['MONGO_URI_CG', env('MONGO_URI_CG')],
    ['MONGO_URI_LOOPC', env('MONGO_URI_LOOPC')],
    ['CLOUDFLARE_API_TOKEN', env('CLOUDFLARE_API_TOKEN')],
    ['CLOUDFLARE_ACCOUNT_ID', env('CLOUDFLARE_ACCOUNT_ID')],
    ['BACKUP_S3_BUCKET', env('BACKUP_S3_BUCKET') || 'missing'],
    ['BACKUP_S3_ENDPOINT', env('BACKUP_S3_ENDPOINT')],
    ['BACKUP_S3_ACCESS_KEY', env('BACKUP_S3_ACCESS_KEY')],
    ['BACKUP_S3_SECRET_KEY', env('BACKUP_S3_SECRET_KEY')],
    ['GitHub auth', ghAvailable() ? 'ok' : 'missing'],
  ]
  for (const [label, value] of checks) {
    const ok = label === 'GitHub auth'
      ? value === 'ok'
      : Boolean(value && value !== 'missing')
    console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  }

  if (ghAvailable()) {
    try {
      const secrets = runGh(['secret', 'list', '-R', REPO])
      const vars = runGh(['variable', 'list', '-R', REPO])
      console.log('\nGitHub repo:')
      for (const name of ['MONGO_URI_MG', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY']) {
        console.log(`  ${/\b${name}\b/.test(secrets) ? '✓' : '✗'} secret ${name}`)
      }
      for (const name of ['ATLAS_BACKUP_PHASE', 'MONGO_BACKUP_ENABLED']) {
        console.log(`  ${/\b${name}\b/.test(vars) ? '✓' : '✗'} variable ${name}`)
      }
    } catch (err) {
      console.log(`\n  GitHub list failed: ${err.message}`)
    }
  }
}

function runLocalVerify() {
  console.log('\n=== Local verification (Phase 1) ===\n')
  for (const script of ['verify:upload-storage', 'drill:atlas-backup-plan']) {
    const result = spawnSync('npm', ['run', script], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ATLAS_BACKUP_PHASE: 'deferred', ATLAS_RESTORE_DRILL_SKIP: 'true' },
    })
    if (result.status !== 0) throw new Error(`${script} failed`)
  }
}

async function main() {
  if (runCheck) checkStatus()

  let r2Ready = Boolean(env('BACKUP_S3_ACCESS_KEY') && env('BACKUP_S3_SECRET_KEY'))
  if (runR2) {
    if (!env('CLOUDFLARE_API_TOKEN') || !env('CLOUDFLARE_ACCOUNT_ID')) {
      console.log('\nSkipping R2 API — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in backend/.env')
      console.log('Or create bucket manually: Cloudflare → R2 → ops-dashboard-mongo-backups')
    } else {
      const r2 = await ensureR2Bucket()
      r2Ready = r2.s3KeysReady
    }
  }

  if (runGithub) {
    if (!r2Ready) {
      throw new Error('BACKUP_S3_ACCESS_KEY + BACKUP_S3_SECRET_KEY required before --github')
    }
    if (!env('BACKUP_S3_ENDPOINT')) {
      const accountId = env('CLOUDFLARE_ACCOUNT_ID')
      if (accountId) process.env.BACKUP_S3_ENDPOINT = `https://${accountId}.r2.cloudflarestorage.com`
    }
    if (!env('BACKUP_S3_BUCKET')) process.env.BACKUP_S3_BUCKET = DEFAULT_BUCKET
    pushGithubSecrets()
    pushGithubVariables()
  }

  if (runTriggerDrill) {
    triggerWorkflow('mongo-backup-drill.yml', ['phase=deferred'])
    console.log('  Watch: GitHub → Actions → Mongo Backup Drill')
  }

  if (runTriggerMongodump) {
    if (!r2Ready && !runGithub) {
      throw new Error('Enable mongodump only after R2 S3 keys are configured')
    }
    triggerWorkflow('mongo-backup-mongodump.yml')
    console.log('  Watch: GitHub → Actions → Mongo Backup Mongodump')
  }

  if (runAll || runCheck) {
    runLocalVerify()
  }

  console.log('\nMongo backup rollout step complete.')
  console.log('Docs: docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md')
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
})
