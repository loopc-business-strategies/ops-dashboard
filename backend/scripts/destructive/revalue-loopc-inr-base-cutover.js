/**
 * LoopC only: revalue posted ledger amounts from USD-base to INR-base, then flip Currency master
 * so INR is base (rate 1) and non-INR rows store "INR per 1 unit of FC" (USD row = inrPerUsd).
 *
 * Assumes pre-cutover convention: ledger.currency was the tenant base (USD); Currency.exchangeRate
 * for non-base codes was "USD per 1 unit of that FC" (same as posting tests).
 *
 * Does NOT rewrite transactions / voucherMeta (ledger-only cutover per ops plan).
 *
 * Usage (dry-run — default):
 *   node backend/scripts/destructive/revalue-loopc-inr-base-cutover.js --tenant=loopc --inr-per-usd=83.5
 *
 * Apply (requires token + reason + production flag if prod):
 *   ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true \  # if NODE_ENV/RAILWAY_ENV is production
 *   node backend/scripts/destructive/revalue-loopc-inr-base-cutover.js --tenant=loopc --inr-per-usd=83.5 --apply \
 *     --reason="LoopC INR base cutover approved YYYY-MM-DD" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 *
 * Env: MONGO_URI_LOOPC, dotenv from backend/.env; DESTRUCTIVE_ADMIN_CONFIRM_TOKEN or CLEANUP_CONFIRM_TOKEN
 */
require('./_destructive-guard')({ scriptName: __filename, allowDryRunNoApply: true })

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

const APPLY = process.argv.includes('--apply')
const tenant = normalizeTenant(String(readArgValue('--tenant') || readArgValue('-t') || '').trim().toLowerCase())

const fromBase = String(readArgValue('--from-base') || 'USD').trim().toUpperCase() || 'USD'
const toBase = 'INR'

function parseInrPerUsd() {
  const raw = String(readArgValue('--inr-per-usd') || readArgValue('--inrPerUsd') || '').trim()
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.error('Required: --inr-per-usd=<positive number> (INR per 1 USD at cutover, e.g. 83.5).')
    process.exit(1)
  }
  return n
}

const toMoney = (v) => Number(Number(v || 0).toFixed(2))

async function main() {
  if (tenant !== 'loopc') {
    console.error('This cutover script is restricted to --tenant=loopc only.')
    process.exit(1)
  }

  const inrPerUsd = parseInrPerUsd()
  const uri = getTenantUri('loopc')
  if (!uri) {
    console.error('Missing MONGO_URI_LOOPC')
    process.exit(1)
  }

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 30000 }).asPromise()
  const db = conn.getClient().db()
  const ledgers = db.collection('ledgers')
  const currencies = db.collection('currencies')

  const baseRow = await currencies.findOne({ baseCurrency: true, isActive: { $ne: false } })
  const currentBase = String(baseRow?.code || '').trim().toUpperCase() || ''

  const ledgerFilter = {
    isDeleted: { $ne: true },
    currency: fromBase,
    amount: { $gt: 0 },
  }

  const count = await ledgers.countDocuments(ledgerFilter)
  const sumAgg = await ledgers.aggregate([
    { $match: ledgerFilter },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray()
  const sumBefore = sumAgg[0]?.total || 0

  const byRef = await ledgers.aggregate([
    { $match: ledgerFilter },
    { $group: { _id: '$referenceType', n: { $sum: 1 } } },
  ]).toArray()

  const currencySnapshot = await currencies.find({ isActive: { $ne: false } }).project({ code: 1, exchangeRate: 1, baseCurrency: 1 }).toArray()

  const plan = {
    tenant: 'loopc',
    apply: APPLY,
    fromBase,
    toBase,
    inrPerUsd,
    currentBaseFromDb: currentBase,
    ledgerRowsToScale: count,
    sumAmountBefore: sumBefore,
    sumAmountAfterApprox: toMoney(sumBefore * inrPerUsd),
    ledgerByReferenceType: Object.fromEntries(byRef.map((r) => [String(r._id || ''), r.n])),
    currenciesBefore: currencySnapshot.map((c) => ({
      code: c.code,
      exchangeRate: c.exchangeRate,
      baseCurrency: Boolean(c.baseCurrency),
    })),
  }

  console.log(JSON.stringify({ phase: 'preview', plan }, null, 2))

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply --reason="..." --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN" to execute.')
    await conn.close()
    return
  }

  if (currentBase && currentBase !== fromBase) {
    console.error(
      `Refusing apply: database base is "${currentBase}" but --from-base=${fromBase}. ` +
        'Adjust --from-base or fix currencies manually before cutover.',
    )
    await conn.close()
    process.exit(1)
  }
  if (!currentBase) {
    console.warn(
      `[apply] No row with baseCurrency=true; continuing using ledger.currency=${fromBase} as cutover source.`,
    )
  }

  // 1) Revalue ledgers still tagged with old base currency
  const ledgerResult = await ledgers.updateMany(ledgerFilter, [
    {
      $set: {
        amount: {
          $round: [{ $multiply: ['$amount', { $literal: inrPerUsd }] }, 2],
        },
        currency: { $literal: toBase },
        exchangeRate: { $literal: 1 },
      },
    },
  ])
  console.log(JSON.stringify({
    phase: 'ledgers_updated',
    matchedCount: ledgerResult.matchedCount,
    modifiedCount: ledgerResult.modifiedCount,
  }))

  const now = new Date()

  // 2) Clear all base flags, then set INR as base and rescale non-INR rates from "USD per FC" to "INR per FC"
  await currencies.updateMany({}, { $set: { baseCurrency: false, updatedAt: now } })

  await currencies.updateOne(
    { code: toBase },
    {
      $set: {
        code: toBase,
        name: 'Indian Rupee',
        symbol: '₹',
        exchangeRate: 1,
        baseCurrency: true,
        isActive: true,
        rateUpdatedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  )

  const all = await currencies.find({}).toArray()
  for (const row of all) {
    const code = String(row.code || '').trim().toUpperCase()
    if (!code || code === toBase) continue

    const oldRate = Number(row.exchangeRate || 0)
    if (code === fromBase) {
      await currencies.updateOne(
        { _id: row._id },
        {
          $set: {
            exchangeRate: inrPerUsd,
            baseCurrency: false,
            isActive: row.isActive !== false,
            rateUpdatedAt: now,
            updatedAt: now,
          },
        },
      )
      continue
    }

    const newRate = Number.isFinite(oldRate) && oldRate > 0 ? Number((oldRate * inrPerUsd).toFixed(8)) : oldRate
    await currencies.updateOne(
      { _id: row._id },
      {
        $set: {
          exchangeRate: newRate > 0 ? newRate : oldRate,
          baseCurrency: false,
          rateUpdatedAt: now,
          updatedAt: now,
        },
      },
    )
  }

  const afterBase = await currencies.findOne({ baseCurrency: true })
  const afterAll = await currencies.find({}).project({ code: 1, exchangeRate: 1, baseCurrency: 1 }).toArray()

  console.log(JSON.stringify({
    phase: 'currencies_updated',
    baseCode: String(afterBase?.code || ''),
    currenciesAfter: afterAll.map((c) => ({
      code: c.code,
      exchangeRate: c.exchangeRate,
      baseCurrency: Boolean(c.baseCurrency),
    })),
  }, null, 2))

  await conn.close()
  console.log('\nCutover apply finished. Run verification checklist in backend/docs/loopc-inr-cutover-checklist.md')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
