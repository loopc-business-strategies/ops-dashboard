require('./destructive/_destructive-guard')({ scriptName: __filename })
/**
 * backfill-ledger-exchange-rates.js
 *
 * Fixes ledger entries that were posted with exchangeRate: 1 (default)
 * even though their currency is not the base currency.
 *
 * For each non-base-currency ledger entry that has exchangeRate <= 0 or === 1,
 * this script sets the correct exchangeRate from the Currency collection.
 *
 * Usage:
 *   node scripts/backfill-ledger-exchange-rates.js [--tenant mg|cg|loopc] [--dry-run]
 *
 * Examples:
 *   node scripts/backfill-ledger-exchange-rates.js --tenant mg
 *   node scripts/backfill-ledger-exchange-rates.js --tenant mg --dry-run
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const args = process.argv.slice(2)
const tenantArg = args.find((a) => a.startsWith('--tenant'))
const tenantKey = tenantArg ? tenantArg.split('=')[1] || args[args.indexOf(tenantArg) + 1] : null
const isDryRun = args.includes('--dry-run')

const TENANT_URIS = {
  mg: process.env.MONGO_URI_MG,
  cg: process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC,
}

async function backfillTenant(uri, tenantName) {
  console.log(`\n=== Tenant: ${tenantName} ===`)
  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  const db = conn.db

  try {
    // 1. Determine base currency code
    const baseCurrencyDoc = await db.collection('currencies').findOne({ baseCurrency: true, isActive: true })
    const baseCurrencyCode = String(baseCurrencyDoc?.code || 'USD').toUpperCase()
    console.log(`Base currency: ${baseCurrencyCode}`)

    // 2. Load all non-base currencies into a map: code -> exchangeRate
    const allCurrencies = await db.collection('currencies').find({ isActive: true }).toArray()
    const rateMap = {}
    for (const c of allCurrencies) {
      const code = String(c.code || '').toUpperCase()
      rateMap[code] = Number(c.exchangeRate || 1)
    }
    console.log(`Loaded ${allCurrencies.length} currencies`)

    // 3. Find ledger entries with non-base currency AND exchangeRate that looks wrong (1 or 0)
    //    "Wrong" means: currency != base AND exchangeRate === 1 (was never set)
    const badEntries = await db.collection('ledgers').find({
      isDeleted: { $ne: true },
      $expr: {
        $and: [
          { $ne: ['$currency', baseCurrencyCode] },
          { $or: [
            { $lte: ['$exchangeRate', 0] },
            { $eq: ['$exchangeRate', 1] },
            { $not: ['$exchangeRate'] },
          ]},
        ],
      },
    }).toArray()

    console.log(`Found ${badEntries.length} ledger entries with potentially wrong exchange rate`)

    if (badEntries.length === 0) {
      console.log('Nothing to fix.')
      return
    }

    // 4. Group by currency so we can report clearly
    const byCurrency = {}
    for (const entry of badEntries) {
      const code = String(entry.currency || '').toUpperCase()
      if (!byCurrency[code]) byCurrency[code] = []
      byCurrency[code].push(entry)
    }

    for (const [code, entries] of Object.entries(byCurrency)) {
      const correctRate = rateMap[code]
      if (!correctRate || correctRate === 1) {
        console.log(`  [SKIP] ${code}: ${entries.length} entries — no rate found in Currency collection or rate is 1 (already base or unknown)`)
        continue
      }

      console.log(`  [${isDryRun ? 'DRY-RUN' : 'FIX'}] ${code}: ${entries.length} entries — setting exchangeRate = ${correctRate}`)

      if (!isDryRun) {
        const ids = entries.map((e) => e._id)
        const result = await db.collection('ledgers').updateMany(
          { _id: { $in: ids } },
          { $set: { exchangeRate: correctRate } }
        )
        console.log(`    → Updated ${result.modifiedCount} documents`)
      } else {
        // Print sample entries
        for (const e of entries.slice(0, 5)) {
          console.log(`    Sample: _id=${e._id} amount=${e.amount} currency=${e.currency} date=${e.date} desc="${e.description}"`)
        }
        if (entries.length > 5) console.log(`    ... and ${entries.length - 5} more`)
      }
    }
  } finally {
    await conn.close()
  }
}

async function main() {
  if (isDryRun) console.log('*** DRY RUN MODE — no changes will be written ***\n')

  const tenantsToProcess = tenantKey
    ? [tenantKey]
    : Object.keys(TENANT_URIS)

  for (const key of tenantsToProcess) {
    const uri = TENANT_URIS[key]
    if (!uri) {
      console.warn(`[SKIP] Tenant "${key}": no URI in .env (MONGO_URI_${key.toUpperCase()})`)
      continue
    }
    await backfillTenant(uri, key.toUpperCase())
  }

  console.log('\nBackfill complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
