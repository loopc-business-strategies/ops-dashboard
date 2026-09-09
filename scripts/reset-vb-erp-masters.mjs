#!/usr/bin/env node
/**
 * Hard-reset Venus Bullions ERP masters/ops on MONGO_URI_VB only.
 * Preserves users (vbadmin). Seeds a clean starter CoA — never copies from MG.
 *
 * Dry-run (default):
 *   npm run reset:vb-erp-masters -- --from-railway
 *
 * Apply:
 *   I_UNDERSTAND=RESET-VB-ERP-MASTERS npm run reset:vb-erp-masters -- \
 *     --from-railway --apply --reason="Remove MG CoA contamination from VB"
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

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

const UNDERSTAND = 'RESET-VB-ERP-MASTERS'

/** Explicit wipe allowlist — never includes users. */
const WIPE_COLLECTIONS = [
  'chartofaccounts',
  'accountmappings',
  'currencies',
  'customers',
  'vendors',
  'suppliers',
  'transactions',
  'ledgers',
  'directdeals',
  'stockmovements',
  'accountingperiods',
  'accountingcontrols',
  'metalrates',
]

const CURRENCY_DEFAULTS = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
]

/** Clean Venus Bullions starter CoA — no party / MG names. */
const STARTER_COA = [
  { accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', description: 'Petty and till cash' },
  { accountCode: '1010', accountName: 'Main Bank Account', accountType: 'Asset', description: 'Primary operating bank' },
  { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', description: 'Trade debtors control' },
  { accountCode: '1200', accountName: 'Inventory - Raw Materials', accountType: 'Asset', description: 'Metal and materials stock' },
  { accountCode: '1210', accountName: 'Metal Inventory', accountType: 'Asset', description: 'Bullion and metal inventory' },
  { accountCode: '1500', accountName: 'Property & Equipment', accountType: 'Asset', description: 'Fixed assets' },
  { accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', description: 'Trade creditors control' },
  { accountCode: '2100', accountName: 'Payroll Payable', accountType: 'Liability', description: 'Salaries and wages payable' },
  { accountCode: '2200', accountName: 'Tax Payable', accountType: 'Liability', description: 'Taxes payable' },
  { accountCode: '3000', accountName: "Owner's Equity", accountType: 'Equity', description: 'Capital and retained equity' },
  { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', description: 'Trading and sales income' },
  { accountCode: '4100', accountName: 'Other Income', accountType: 'Income', description: 'Non-trading income' },
  { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'Expense', description: 'Direct cost of sales' },
  { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'Expense', description: 'General operating expenses' },
  { accountCode: '6200', accountName: 'Payroll Expense', accountType: 'Expense', description: 'Salaries and wages expense' },
]

const DIRECT_FALLBACKS = [
  { mappingType: 'sale', debitCode: '1100', creditCode: '4000', department: 'sales', description: 'Default mapping for sale transactions' },
  { mappingType: 'purchase', debitCode: '1200', creditCode: '2000', department: 'operations', description: 'Default mapping for purchase transactions' },
  { mappingType: 'receipt', debitCode: '1010', creditCode: '1100', department: 'sales', description: 'Default mapping for receipt transactions' },
  { mappingType: 'payment', debitCode: '2000', creditCode: '1010', department: 'finance', description: 'Default mapping for payment transactions' },
  { mappingType: 'expense', debitCode: '6100', creditCode: '1010', department: 'operations', description: 'Default mapping for expense transactions' },
  { mappingType: 'payroll', debitCode: '6200', creditCode: '2100', department: 'hr', description: 'Default mapping for payroll transactions' },
]

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

async function countWipeTargets(db) {
  const rows = []
  for (const name of WIPE_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext()
    if (!exists) {
      rows.push({ name, count: 0, exists: false })
      continue
    }
    const count = await db.collection(name).countDocuments({})
    rows.push({ name, count, exists: true })
  }
  return rows
}

async function wipeCollections(db) {
  const results = []
  for (const name of WIPE_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext()
    if (!exists) {
      results.push({ name, deletedCount: 0, skipped: true })
      continue
    }
    const result = await db.collection(name).deleteMany({})
    results.push({ name, deletedCount: result.deletedCount, skipped: false })
  }
  return results
}

async function seedCurrencies(db) {
  const col = db.collection('currencies')
  const now = new Date()
  for (const currency of CURRENCY_DEFAULTS) {
    await col.insertOne({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: currency.baseCurrency ? 1 : currency.exchangeRate,
      baseCurrency: Boolean(currency.baseCurrency),
      isActive: true,
      rateUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  }
  return CURRENCY_DEFAULTS.length
}

async function seedCoa(db) {
  const col = db.collection('chartofaccounts')
  const now = new Date()
  const inserted = []
  for (const row of STARTER_COA) {
    const doc = {
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      parentAccountId: null,
      currency: 'USD',
      isActive: true,
      description: row.description || '',
      address: '',
      openingBalance: 0,
      department: '',
      usedInTransactions: false,
      createdAt: now,
      updatedAt: now,
    }
    const result = await col.insertOne(doc)
    inserted.push({ ...doc, _id: result.insertedId })
  }
  return inserted
}

async function seedMappings(db, coaByCode) {
  const col = db.collection('accountmappings')
  const now = new Date()
  let added = 0
  for (const m of DIRECT_FALLBACKS) {
    const debit = coaByCode.get(m.debitCode)
    const credit = coaByCode.get(m.creditCode)
    if (!debit || !credit) {
      throw new Error(`Missing CoA for mapping ${m.mappingType}: ${m.debitCode}/${m.creditCode}`)
    }
    await col.insertOne({
      mappingType: m.mappingType,
      debitAccountId: debit._id,
      creditAccountId: credit._id,
      department: m.department || '',
      description: m.description || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    added += 1
  }
  return added
}

async function assertNoModernCapital(db) {
  const hits = await db.collection('chartofaccounts')
    .find({ accountName: /modern capital/i })
    .project({ accountCode: 1, accountName: 1 })
    .toArray()
  if (hits.length) {
    throw new Error(`Seed verification failed — Modern Capital still present: ${JSON.stringify(hits)}`)
  }
}

async function assertVbadminPreserved(db) {
  const admin = await db.collection('users').findOne({ name: /^vbadmin$/i })
  if (!admin) throw new Error('vbadmin missing after reset — aborting verification')
  const userCount = await db.collection('users').countDocuments({})
  return { userCount, adminId: String(admin._id) }
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
    const beforeUsers = await db.collection('users').countDocuments({})
    const wipeCounts = await countWipeTargets(db)
    const modernBefore = await db.collection('chartofaccounts')
      .countDocuments({ accountName: /modern capital/i })

    console.log(`Users preserved (count before): ${beforeUsers}`)
    console.log(`Modern Capital CoA rows before: ${modernBefore}`)
    console.log('Wipe targets:')
    for (const row of wipeCounts) {
      console.log(`  ${row.name}: ${row.count}${row.exists ? '' : ' (missing)'}`)
    }
    console.log(`Will seed CoA accounts: ${STARTER_COA.length}`)
    console.log(`Will seed currencies: ${CURRENCY_DEFAULTS.length}`)
    console.log(`Will seed mappings: ${DIRECT_FALLBACKS.length}`)

    if (!apply) {
      console.log('Dry-run only. Re-run with I_UNDERSTAND=RESET-VB-ERP-MASTERS --apply --reason="..."')
      return
    }

    const wiped = await wipeCollections(db)
    console.log('Deleted:')
    for (const row of wiped) {
      console.log(`  ${row.name}: ${row.deletedCount}${row.skipped ? ' (skipped missing)' : ''}`)
    }

    const currencies = await seedCurrencies(db)
    const coa = await seedCoa(db)
    const coaByCode = new Map(coa.map((d) => [d.accountCode, d]))
    const mappings = await seedMappings(db, coaByCode)

    await assertNoModernCapital(db)
    const users = await assertVbadminPreserved(db)

    const coaAfter = await db.collection('chartofaccounts').countDocuments({})
    console.log(`Seeded currencies: ${currencies}`)
    console.log(`Seeded CoA: ${coaAfter}`)
    console.log(`Seeded mappings: ${mappings}`)
    console.log(`Users remaining: ${users.userCount} (vbadmin=${users.adminId})`)
    console.log('RESET_OK')
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
