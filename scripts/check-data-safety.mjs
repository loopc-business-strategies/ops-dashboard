#!/usr/bin/env node
/**
 * Read-only local checklist for staging / production safety.
 * Does not connect to databases or change any data.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const STAGING_SECURITY_VARS = [
  'JWT_SECRET',
  'SETUP_TOKEN',
  'CLEANUP_CONFIRM_TOKEN',
  'DESTRUCTIVE_ADMIN_CONFIRM_TOKEN',
  'MIGRATION_CONFIRM_TOKEN',
]

const STAGING_MONGO_VARS = ['MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC']

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const out = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

function redactHost(uri) {
  const raw = String(uri || '')
  if (!raw) return '(unset)'
  if (/staging|preview|test|dev|sandbox|smoke|qa|uat/i.test(raw)) return '(looks like non-prod)'
  if (/localhost|127\.0\.0\.1|memory/i.test(raw)) return '(local/ephemeral)'
  return '(production-like — verify this is intentional)'
}

function main() {
  const envPath = path.join(root, 'backend', '.env')
  const env = loadDotEnv(envPath)
  const nodeEnv = process.env.NODE_ENV || env.NODE_ENV || '(unset)'

  console.log('Data-safety checklist (read-only)\n')
  console.log(`NODE_ENV: ${nodeEnv}`)
  console.log('')

  console.log('Mongo targets (host classification only — credentials not shown):')
  for (const key of STAGING_MONGO_VARS) {
    const uri = process.env[key] || env[key] || ''
    console.log(`  ${key}: ${uri ? redactHost(uri) : '(unset)'}`)
  }
  console.log('')

  console.log('Security tokens (presence only):')
  for (const key of STAGING_SECURITY_VARS) {
    const value = process.env[key] || env[key] || ''
    console.log(`  ${key}: ${value ? 'set' : 'missing'}`)
  }
  console.log('')

  console.log('Safe commands (no writes):')
  console.log('  npm run verify:data-safety              # upload volume + Mongo connectivity')
  console.log('  npm run verify:upload-storage           # Railway UPLOAD_STORAGE_ROOT on prod/staging')
  console.log('  npm run verify:mongo-backup-drill       # tenant Mongo connectivity drill')
  console.log('  npm --prefix backend run migrate          # dry-run migrations')
  console.log('  npm run smoke:staging                     # read-only HTTP probes (when configured)')
  console.log('  npm run check:data-safety                 # this script + migration safety tests')
  console.log('')
  console.log('Before any apply / destructive script:')
  console.log('  1. Backup MongoDB (docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md)')
  console.log('  2. Use staging URIs only unless ALLOW_PRODUCTION_MIGRATION=true after backup')
  console.log('  3. Set MIGRATION_I_HAVE_BACKUP=true and MIGRATION_CONFIRM_TOKEN for migrate:apply')
  console.log('')
  console.log('Templates: backend/.env.staging.example, backend/.env.production.example')
}

main()
