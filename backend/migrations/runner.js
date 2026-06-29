#!/usr/bin/env node
/**
 * Multi-tenant migration runner.
 * Usage:
 *   node migrations/runner.js              # dry-run pending migrations
 *   node migrations/runner.js --apply      # apply pending migrations
 *   node migrations/runner.js --apply --confirm=TOKEN
 *   node migrations/runner.js --until=002-backfill-mapping-departments
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { TENANT_KEYS } = require('../config/tenants')
const {
  assertMigrationApplyAllowed,
  redactMongoUri,
} = require('../utils/migrationSafety')

const MIGRATIONS_DIR = __dirname
const COLLECTION = '_migrations'

function hasArg(name) {
  return process.argv.includes(name)
}

function getArgValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function loadMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}-.+\.js$/.test(name) && name !== 'runner.js')
    .sort()
    .map((name) => {
      const mod = require(path.join(MIGRATIONS_DIR, name))
      if (!mod?.id || typeof mod.up !== 'function') {
        throw new Error(`Invalid migration ${name}: must export { id, up }`)
      }
      return { file: name, ...mod }
    })
}

async function getAppliedIds(db) {
  const col = db.collection(COLLECTION)
  const rows = await col.find({}).project({ _id: 0, id: 1 }).toArray()
  return new Set(rows.map((row) => row.id))
}

async function markApplied(db, migration) {
  await db.collection(COLLECTION).updateOne(
    { id: migration.id },
    { $set: { id: migration.id, file: migration.file, appliedAt: new Date() } },
    { upsert: true },
  )
}

function resolveTenantUri(tenant) {
  const key = `MONGO_URI_${String(tenant).toUpperCase()}`
  return String(process.env[key] || '').trim()
}

function resolveUntilMigrationId() {
  const until = getArgValue('--until=')
  return until ? String(until).trim() : ''
}

function filterMigrationsByUntil(migrations, untilId) {
  if (!untilId) return migrations
  const untilIndex = migrations.findIndex((migration) => migration.id === untilId)
  if (untilIndex === -1) {
    throw new Error(`Unknown --until migration id: ${untilId}`)
  }
  return migrations.slice(0, untilIndex + 1)
}

async function main() {
  const apply = hasArg('--apply')
  const validateOnly = hasArg('--validate-only')
  const untilId = resolveUntilMigrationId()
  const confirm = getArgValue('--confirm=')
  const expectedToken = String(process.env.MIGRATION_CONFIRM_TOKEN || '').trim()

  const migrations = filterMigrationsByUntil(loadMigrationFiles(), untilId)
  if (validateOnly) {
    console.log(`Migration validate-only — ${migrations.length} registered`)
    console.log(migrations.map((migration) => `  • ${migration.id} (${migration.file})`).join('\n'))
    return
  }

  if (apply) {
    if (!expectedToken) {
      throw new Error('Refusing apply: set MIGRATION_CONFIRM_TOKEN in the environment.')
    }
    if (!confirm || confirm !== expectedToken) {
      throw new Error('Refusing apply: pass --confirm=$MIGRATION_CONFIRM_TOKEN')
    }
    const tenantsPreview = TENANT_KEYS.filter((tenant) => resolveTenantUri(tenant))
    assertMigrationApplyAllowed({ tenants: tenantsPreview, resolveUri: resolveTenantUri })
  }

  const tenants = TENANT_KEYS.filter((tenant) => resolveTenantUri(tenant))
  if (!tenants.length) {
    throw new Error('No tenant Mongo URIs configured (MONGO_URI_MG / _CG / _LOOPC)')
  }

  console.log(`Migration runner — mode: ${apply ? 'apply' : 'dry-run'}`)
  if (untilId) console.log(`Until: ${untilId} (later migrations skipped)`)
  console.log(`Tenants: ${tenants.join(', ')}`)
  console.log(`Registered migrations: ${migrations.length}`)

  for (const tenant of tenants) {
    const uri = resolveTenantUri(tenant)
    console.log(`\n[${tenant}] connecting to ${redactMongoUri(uri)}…`)
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
    const db = mongoose.connection.db
    const applied = await getAppliedIds(db)
    const pending = migrations.filter((migration) => !applied.has(migration.id))

    if (!pending.length) {
      console.log(`[${tenant}] up to date (${applied.size} applied)`)
      await mongoose.disconnect()
      continue
    }

    console.log(`[${tenant}] pending: ${pending.map((m) => m.id).join(', ')}`)

    for (const migration of pending) {
      console.log(`[${tenant}] ${apply ? 'APPLY' : 'DRY-RUN'} ${migration.id} (${migration.file})`)
      if (apply) {
        await migration.up({ db, tenant, mongoose })
        await markApplied(db, migration)
      }
    }

    await mongoose.disconnect()
  }

  if (!apply) {
    console.log('\nDry-run complete — no data was changed.')
    console.log('To apply: backup first, then set MIGRATION_I_HAVE_BACKUP=true, MIGRATION_CONFIRM_TOKEN, and run with --apply --confirm=<token>.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
