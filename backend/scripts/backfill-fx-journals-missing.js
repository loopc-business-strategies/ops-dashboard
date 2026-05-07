/**
 * backfill-fx-journals-missing.js
 *
 * Finds posted payment/receipt transactions where line items are in a foreign
 * (non-base) currency but no FX gain/loss ledger entry exists, and creates them.
 *
 * Handles the common case where the transaction header currency is USD but
 * the line item currency is a foreign currency (e.g. UZS).
 *
 * Usage:
 *   node scripts/backfill-fx-journals-missing.js [--tenant mg|cg|loopc] [--dry-run]
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
  mg:    process.env.MONGO_URI_MG,
  cg:    process.env.MONGO_URI_CG,
  loopc: process.env.MONGO_URI_LOOPC || process.env.MONGO_URI,
}

const toMoney = (v) => Math.round(Number(v) * 100) / 100

async function backfillTenant(uri, tenantName) {
  console.log(`\n=== Tenant: ${tenantName} ===`)
  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  const db = conn.db

  try {
    // Base currency
    const baseCurrDoc = await db.collection('currencies').findOne({ baseCurrency: true, isActive: true })
    const baseCurrCode = String(baseCurrDoc?.code || 'USD').toUpperCase()
    console.log(`  Base currency: ${baseCurrCode}`)

    // Find exchange gain/loss accounts
    const gainAcc  = await db.collection('chartofaccounts').findOne({ accountCode: '4190', isActive: true })
    const lossAcc  = await db.collection('chartofaccounts').findOne({ accountCode: '5190', isActive: true })
    const cashBankAcc = await db.collection('chartofaccounts').findOne({
      $or: [{ accountCode: '1000' }, { accountCode: '1010' }],
      isActive: true,
    })
    if (!gainAcc || !lossAcc) {
      console.log('  ⚠️  4190/5190 accounts not found — skipping')
      return
    }
    console.log(`  Gain account: ${gainAcc.accountCode}, Loss account: ${lossAcc.accountCode}`)

    // Check account mapping overrides
    const gainMapping = await db.collection('accountmappings').findOne({ mappingType: 'exchange_gain', isActive: true })
    const lossMapping = await db.collection('accountmappings').findOne({ mappingType: 'exchange_loss', isActive: true })

    const gainDebitId  = gainMapping?.debitAccountId  || cashBankAcc?._id
    const gainCreditId = gainMapping?.creditAccountId || gainAcc._id
    const lossDebitId  = lossMapping?.debitAccountId  || lossAcc._id
    const lossCreditId = lossMapping?.creditAccountId || cashBankAcc?._id

    // All currencies
    const currencies = await db.collection('currencies').find({ isActive: true }).toArray()
    const currMap = {}
    currencies.forEach(c => { currMap[String(c.code).toUpperCase()] = Number(c.exchangeRate || 0) })

    // Find ALL posted payment/receipt transactions (including USD-header with foreign line items)
    const transactions = await db.collection('transactions').find({
      type: { $in: ['payment', 'receipt'] },
      status: 'posted',
    }).toArray()

    console.log(`  Total posted payment/receipt transactions: ${transactions.length}`)

    let created = 0, skipped = 0

    for (const tx of transactions) {
      const txCurrCode = String(tx.currency || '').toUpperCase()
      const voucherLine = tx?.voucherMeta?.lineItems?.[0] || {}
      const lineCurrCode = String(voucherLine?.currCode || txCurrCode || 'USD').toUpperCase()

      // Only process if either the transaction or line item is in a foreign currency
      if (lineCurrCode === baseCurrCode && txCurrCode === baseCurrCode) { skipped++; continue }

      const effectiveCurrCode = lineCurrCode !== baseCurrCode ? lineCurrCode : txCurrCode

      // Skip if FX journal already exists
      const existingFx = await db.collection('ledgers').findOne({
        referenceId: tx._id,
        referenceType: 'journal',
        description: { $regex: /exchange (gain|loss)/i },
        isDeleted: { $ne: true },
      })
      if (existingFx) {
        console.log(`  ✓ tx ${tx._id} (${tx.type} ${effectiveCurrCode}) already has FX journal`)
        skipped++
        continue
      }

      const masterRate = currMap[effectiveCurrCode] || 0
      const referenceRate = Number(
        voucherLine?.referenceRate
        || tx?.voucherMeta?.referenceExchangeRate
        || tx?.voucherMeta?.invoiceExchangeRate
        || masterRate
        || 0
      )

      if (!referenceRate || referenceRate <= 0) {
        console.log(`  ⚠️  tx ${tx._id} — no reference rate for ${effectiveCurrCode}, skip`)
        skipped++; continue
      }

      const lineRate = Number(voucherLine?.currRate || tx.exchangeRate || masterRate || 1)
      const txAmount = Number(tx.amount || 0)
      const foreignAmount = Number(
        voucherLine?.amountFC || voucherLine?.amountFc || voucherLine?.amtFc || voucherLine?.headerAmt || 0
      )

      const expectedFC = txAmount / referenceRate
      const actualFC   = foreignAmount > 0 ? foreignAmount : (txAmount / lineRate)
      const fcDiff     = actualFC - expectedFC
      const diffInBase = toMoney(Math.abs(fcDiff) * lineRate)

      // Sanity check: skip if the FC difference is more than 200% of actual FC
      // (protects against test/bad data with grossly wrong amountFC values)
      if (actualFC > 0 && Math.abs(fcDiff) / actualFC > 2) {
        console.log(`  ⚠️  tx ${tx._id} (${tx.type} ${effectiveCurrCode}) implausible FC ratio ${(Math.abs(fcDiff)/actualFC).toFixed(1)}x — skip (bad data?)`)
        skipped++; continue
      }

      if (diffInBase < 0.01) {
        console.log(`  — tx ${tx._id} (${tx.type} ${effectiveCurrCode}) FC diff=${fcDiff.toFixed(2)} → $${diffInBase} < 0.01 → skip`)
        skipped++; continue
      }

      const type   = String(tx.type || '').toLowerCase()
      const isGain = type === 'payment' ? fcDiff < 0 : fcDiff > 0
      const debitAccountId  = isGain ? gainDebitId  : lossDebitId
      const creditAccountId = isGain ? gainCreditId : lossCreditId

      console.log(`  ${isDryRun ? '[DRY]' : '+'} ${tx.type} | ${effectiveCurrCode} | actualFC=${actualFC.toFixed(2)} expectedFC=${expectedFC.toFixed(2)} | fcDiff=${fcDiff.toFixed(2)} | $${diffInBase} | ${isGain ? 'GAIN→4190' : 'LOSS→5190'}`)

      if (!isDryRun) {
        await db.collection('ledgers').insertOne({
          _id: new mongoose.Types.ObjectId(),
          date: tx.date || new Date(),
          debitAccountId,
          creditAccountId,
          amount: diffInBase,
          description: `Exchange ${isGain ? 'gain' : 'loss'} adjustment for transaction ${tx._id}`,
          referenceType: 'journal',
          referenceId: tx._id,
          createdBy: tx.createdBy || null,
          updatedBy: tx.createdBy || null,
          department: tx.department || null,
          currency: baseCurrCode,
          exchangeRate: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        created++
      } else {
        created++
      }
    }

    console.log(`  Done — ${created} FX journals ${isDryRun ? 'would be created' : 'created'}, ${skipped} skipped`)
  } finally {
    await conn.close()
  }
}

async function main() {
  const tenantsToRun = tenantKey
    ? [[tenantKey, TENANT_URIS[tenantKey]]]
    : Object.entries(TENANT_URIS)

  for (const [name, uri] of tenantsToRun) {
    if (!uri) { console.log(`\nSkipping ${name} — no URI`); continue }
    await backfillTenant(uri, name)
  }
  console.log('\nAll done.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
