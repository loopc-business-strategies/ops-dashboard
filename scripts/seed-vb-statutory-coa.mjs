#!/usr/bin/env node
/**
 * Upsert VB statutory CoA + FX/VAT mappings (no wipe).
 *
 * Dry-run:
 *   npm run seed:vb-statutory-coa -- --from-railway
 *
 * Apply:
 *   I_UNDERSTAND=SEED-VB-STATUTORY-COA npm run seed:vb-statutory-coa -- \
 *     --from-railway --apply --reason="Add FX VAT P&L accounts to VB"
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { STARTER_COA, DIRECT_FALLBACKS } from './reset-vb-erp-masters.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const mongoose = require(path.join(root, 'backend', 'node_modules', 'mongoose'))
const { getTenantConfig } = require(path.join(root, 'backend', 'config', 'tenantRegistry'))
const { redactMongoUri } = require(path.join(root, 'backend', 'utils', 'mongoUriFingerprint'))

const UNDERSTAND = 'SEED-VB-STATUTORY-COA'

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (hit) return hit.slice(prefix.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0) return process.argv[idx + 1] || fallback
  return fallback
}

function loadRailwayVars(environment = 'production') {
  const projectId = arg('railway-project', process.env.RAILWAY_PROJECT_ID || '')
  const args = ['variable', 'list', '-s', 'ops-dashboard', '-e', environment, '--json']
  if (projectId) args.push('-p', projectId)
  const r = spawnSync('railway', args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const raw = `${r.stdout || ''}\n${r.stderr || ''}`
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) {
    throw new Error(
      `Failed to load Railway vars (${environment}). `
      + 'Link the project (`railway link`) or pass --railway-project <id>.',
    )
  }
  return JSON.parse(raw.slice(start, end + 1))
}

function resolveVbUri() {
  const fromRailway = hasFlag('from-railway')
  const merged = fromRailway
    ? { ...process.env, ...loadRailwayVars('production') }
    : process.env
  const envVar = getTenantConfig('vb')?.envVar || 'MONGO_URI_VB'
  const uri = String(merged[envVar] || '').trim()
  if (!uri) throw new Error(`${envVar} is not set`)
  return uri
}

async function upsertAccounts(db) {
  const col = db.collection('chartofaccounts')
  const now = new Date()
  let upserted = 0
  const byCode = new Map()

  for (const row of STARTER_COA) {
    const result = await col.updateOne(
      { accountCode: row.accountCode },
      {
        $set: {
          accountName: row.accountName,
          accountType: row.accountType,
          description: row.description || '',
          department: row.department || '',
          currency: 'USD',
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          accountCode: row.accountCode,
          parentAccountId: null,
          address: '',
          openingBalance: 0,
          usedInTransactions: false,
          createdAt: now,
        },
      },
      { upsert: true },
    )
    if (result.upsertedCount > 0 || result.modifiedCount > 0) upserted += 1
  }

  const all = await col.find({ accountCode: { $in: STARTER_COA.map((r) => r.accountCode) } }).toArray()
  for (const doc of all) byCode.set(doc.accountCode, doc)

  for (const row of STARTER_COA) {
    if (!row.parentCode) continue
    const child = byCode.get(row.accountCode)
    const parent = byCode.get(row.parentCode)
    if (!child || !parent) continue
    await col.updateOne(
      { _id: child._id },
      { $set: { parentAccountId: parent._id, updatedAt: now } },
    )
  }

  return { upserted, total: byCode.size, byCode }
}

async function upsertMappings(db, byCode) {
  const col = db.collection('accountmappings')
  const now = new Date()
  let upserted = 0
  for (const m of DIRECT_FALLBACKS) {
    const debit = byCode.get(m.debitCode)
    const credit = byCode.get(m.creditCode)
    if (!debit || !credit) {
      throw new Error(`Missing CoA for mapping ${m.mappingType}: ${m.debitCode}/${m.creditCode}`)
    }
    const result = await col.updateOne(
      { mappingType: m.mappingType },
      {
        $set: {
          mappingType: m.mappingType,
          debitAccountId: debit._id,
          creditAccountId: credit._id,
          department: m.department || '',
          description: m.description || '',
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
    if (result.upsertedCount > 0 || result.modifiedCount > 0) upserted += 1
  }
  return upserted
}

async function main() {
  const apply = hasFlag('apply')
  const reason = String(arg('reason', '')).trim()

  if (apply) {
    if (process.env.I_UNDERSTAND !== UNDERSTAND) {
      console.error(`Refusing apply: set I_UNDERSTAND=${UNDERSTAND}`)
      process.exit(1)
    }
    if (reason.length < 10) {
      console.error('Refusing apply: pass --reason= with at least 10 characters')
      process.exit(1)
    }
  }

  const uri = resolveVbUri()
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`VB fingerprint: ${redactMongoUri(uri)}`)
  if (apply) console.log(`Reason: ${reason}`)

  const conn = await mongoose.createConnection(uri, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 20000,
  }).asPromise()

  try {
    const db = conn.db
    const existingCodes = new Set(
      (await db.collection('chartofaccounts').find({}).project({ accountCode: 1 }).toArray())
        .map((d) => String(d.accountCode)),
    )
    const missing = STARTER_COA.filter((r) => !existingCodes.has(r.accountCode)).map((r) => r.accountCode)
    const existingMaps = new Set(
      (await db.collection('accountmappings').find({}).project({ mappingType: 1 }).toArray())
        .map((d) => String(d.mappingType)),
    )
    const missingMaps = DIRECT_FALLBACKS.filter((m) => !existingMaps.has(m.mappingType)).map((m) => m.mappingType)

    console.log(`Accounts in starter: ${STARTER_COA.length}`)
    console.log(`Missing account codes: ${missing.join(', ') || 'none'}`)
    console.log(`Missing mappings: ${missingMaps.join(', ') || 'none'}`)

    if (!apply) {
      console.log('Dry-run only. Re-run with I_UNDERSTAND=SEED-VB-STATUTORY-COA --apply --reason="..."')
      return
    }

    const accounts = await upsertAccounts(db)
    const mappings = await upsertMappings(db, accounts.byCode)
    const modern = await db.collection('chartofaccounts').countDocuments({ accountName: /modern capital/i })
    if (modern > 0) throw new Error('Modern Capital still present after seed')

    const afterCodes = await db.collection('chartofaccounts')
      .find({ isActive: { $ne: false } })
      .project({ accountCode: 1, accountName: 1, accountType: 1 })
      .sort({ accountCode: 1 })
      .toArray()
    const afterMaps = await db.collection('accountmappings')
      .find({ isActive: { $ne: false } })
      .project({ mappingType: 1 })
      .toArray()

    console.log(`Upserted/updated accounts: ${accounts.upserted}`)
    console.log(`Upserted/updated mappings: ${mappings}`)
    console.log(`Active CoA count: ${afterCodes.length}`)
    console.log(`Active mappings: ${afterMaps.map((m) => m.mappingType).join(', ')}`)
    console.log('SEED_VB_STATUTORY_OK')
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
