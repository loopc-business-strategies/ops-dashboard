/**
 * Additive ERP bootstrap for a new catalog tenant (default: vb).
 * No destructive-guard flags — only upserts CoA from a source tenant + currency defaults +
 * direct-type fallback mappings. Safe to re-run.
 *
 * Usage (on Railway network so *.railway.internal resolves):
 *   railway ssh -s ops-dashboard -e production -- node backend/scripts/bootstrap-new-tenant-erp.js --tenant=vb --source=mg
 *
 * Requires MONGO_URI_<TENANT> and MONGO_URI_<SOURCE> in the environment.
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

dns.setServers(['8.8.8.8', '1.1.1.1'])

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (hit) return hit.slice(prefix.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0) return process.argv[idx + 1] || fallback
  return fallback
}

const TARGET = normalizeTenant(getArg('tenant', 'vb'))
const SOURCE = normalizeTenant(getArg('source', 'mg'))

const CURRENCY_DEFAULTS = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'EUR', name: 'Euro', symbol: 'EUR', exchangeRate: 1.08, baseCurrency: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
  { code: 'UZS', name: 'Uzbekistan Som', symbol: 'UZS', exchangeRate: 0.000078, baseCurrency: false },
]

const DIRECT_FALLBACKS = [
  { mappingType: 'sale', debitCode: '1100', creditCode: '4000', department: 'sales', description: 'Default mapping for sale transactions' },
  { mappingType: 'purchase', debitCode: '1200', creditCode: '2000', department: 'operations', description: 'Default mapping for purchase transactions' },
  { mappingType: 'receipt', debitCode: '1010', creditCode: '1100', department: 'sales', description: 'Default mapping for receipt transactions' },
  { mappingType: 'payment', debitCode: '2000', creditCode: '1010', department: 'finance', description: 'Default mapping for payment transactions' },
  { mappingType: 'expense', debitCode: '6100', creditCode: '1010', department: 'operations', description: 'Default mapping for expense transactions' },
  { mappingType: 'payroll', debitCode: '6200', creditCode: '2100', department: 'hr', description: 'Default mapping for payroll transactions' },
]

async function copyCoa(sourceConn, targetConn) {
  const docs = await sourceConn.db.collection('chartofaccounts').find({}).toArray()
  let upserted = 0
  for (const doc of docs) {
    const clone = { ...doc }
    delete clone._id
    delete clone.__v
    const result = await targetConn.db.collection('chartofaccounts').updateOne(
      { accountCode: doc.accountCode },
      { $set: clone },
      { upsert: true },
    )
    if (result.upsertedCount > 0) upserted += 1
  }
  return { total: docs.length, upserted }
}

async function seedCurrencies(conn) {
  const col = conn.db.collection('currencies')
  const now = new Date()
  for (const currency of CURRENCY_DEFAULTS) {
    if (currency.baseCurrency) {
      await col.updateOne(
        { code: currency.code },
        {
          $set: {
            name: currency.name,
            symbol: currency.symbol,
            exchangeRate: 1,
            baseCurrency: true,
            isActive: true,
            rateUpdatedAt: now,
          },
          $setOnInsert: { code: currency.code, createdAt: now },
          $currentDate: { updatedAt: true },
        },
        { upsert: true },
      )
      await col.updateMany(
        { code: { $ne: currency.code }, baseCurrency: true },
        { $set: { baseCurrency: false } },
      )
    } else {
      await col.updateOne(
        { code: currency.code },
        {
          $set: {
            name: currency.name,
            symbol: currency.symbol,
            exchangeRate: currency.exchangeRate,
            baseCurrency: false,
            isActive: true,
            rateUpdatedAt: now,
          },
          $setOnInsert: { code: currency.code, createdAt: now },
          $currentDate: { updatedAt: true },
        },
        { upsert: true },
      )
    }
  }
}

async function coaId(db, code) {
  const doc = await db.collection('chartofaccounts').findOne({ accountCode: String(code) })
  if (!doc) throw new Error(`COA account code ${code} not found`)
  return doc._id
}

async function seedMappings(conn) {
  const db = conn.db
  let added = 0
  for (const m of DIRECT_FALLBACKS) {
    const exists = await db.collection('accountmappings').findOne({ mappingType: m.mappingType })
    if (exists) continue
    await db.collection('accountmappings').insertOne({
      mappingType: m.mappingType,
      debitAccountId: await coaId(db, m.debitCode),
      creditAccountId: await coaId(db, m.creditCode),
      department: m.department || '',
      description: m.description || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    added += 1
  }
  return added
}

async function main() {
  if (!TARGET || !SOURCE) {
    console.error('Invalid --tenant / --source (must be catalog keys)')
    process.exit(1)
  }
  const sourceUri = getTenantUri(SOURCE)
  const targetUri = getTenantUri(TARGET)
  if (!sourceUri || !targetUri) {
    console.error(`Missing URI for source=${SOURCE} or target=${TARGET}`)
    process.exit(1)
  }

  console.log(`Bootstrap ERP: source=${SOURCE} → target=${TARGET}`)
  const sourceConn = await mongoose.createConnection(sourceUri, { autoIndex: false }).asPromise()
  const targetConn = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise()
  try {
    const coa = await copyCoa(sourceConn, targetConn)
    console.log(`CoA: ${coa.total} source rows, ${coa.upserted} new inserts`)
    await seedCurrencies(targetConn)
    console.log('Currencies seeded')
    const mappingsAdded = await seedMappings(targetConn)
    console.log(`Mappings added: ${mappingsAdded}`)
  } finally {
    await sourceConn.close()
    await targetConn.close()
  }
  console.log(`Done. Create first admin: https://${TARGET}.loopcstrategies.com/setup`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
