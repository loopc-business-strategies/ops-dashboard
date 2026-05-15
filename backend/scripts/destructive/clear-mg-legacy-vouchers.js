require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const mongoose = require('mongoose')

const LEGACY_TYPES = ['payment', 'receipt', 'purchase', 'sale']
const LEGACY_DOC_NO_RX = /^\d+$/

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGO_URI_MG

  if (!uri) {
    throw new Error('Missing MONGO_URI_MG in environment')
  }

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const now = new Date()

    const txFilter = {
      isDeleted: { $ne: true },
      type: { $in: LEGACY_TYPES },
      'voucherMeta.vocNo': { $type: 'string', $regex: LEGACY_DOC_NO_RX },
    }

    const txDocs = await db
      .collection('transactions')
      .find(txFilter)
      .project({ _id: 1, type: 1, status: 1, journalEntryId: 1, 'voucherMeta.vocNo': 1, date: 1, amount: 1 })
      .sort({ date: -1, _id: -1 })
      .toArray()

    const txIds = txDocs.map((d) => d._id)
    const journalEntryIds = txDocs.map((d) => d.journalEntryId).filter(Boolean)

    const ledgerFilter = {
      isDeleted: { $ne: true },
      $or: [
        ...(txIds.length ? [{ referenceId: { $in: txIds } }] : []),
        ...(journalEntryIds.length ? [{ _id: { $in: journalEntryIds } }] : []),
      ],
    }

    const candidateLedgerCount = (txIds.length || journalEntryIds.length)
      ? await db.collection('ledgers').countDocuments(ledgerFilter)
      : 0

    const summaryByType = LEGACY_TYPES.reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
    for (const tx of txDocs) {
      const t = String(tx.type || '').toLowerCase()
      if (Object.prototype.hasOwnProperty.call(summaryByType, t)) summaryByType[t] += 1
    }

    const preview = {
      generatedAt: now.toISOString(),
      tenant: 'mg',
      dryRun: !apply,
      criteria: {
        typeIn: LEGACY_TYPES,
        legacyDocNoPattern: '^\\d+$',
        isDeleted: { $ne: true },
      },
      candidates: {
        transactions: txDocs.length,
        ledgers: candidateLedgerCount,
      },
      typeBreakdown: summaryByType,
      sample: txDocs.slice(0, 15).map((tx) => ({
        _id: String(tx._id),
        type: tx.type,
        status: tx.status,
        docNo: tx?.voucherMeta?.vocNo || '',
        date: tx.date,
        amount: tx.amount,
      })),
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry run complete. Re-run with --apply to soft-delete matching MG legacy voucher records and linked ledgers.',
      }, null, 2))
      return
    }

    if (!txDocs.length) {
      console.log(JSON.stringify({
        ...preview,
        dryRun: false,
        executed: {
          matchedTransactions: 0,
          archivedTransactions: 0,
          matchedLedgers: 0,
          archivedLedgers: 0,
        },
        message: 'No legacy records found. Nothing changed.',
      }, null, 2))
      return
    }

    const [txRes, ledgerRes] = await Promise.all([
      db.collection('transactions').updateMany(
        { _id: { $in: txIds }, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now, updatedAt: now } },
      ),
      (txIds.length || journalEntryIds.length)
        ? db.collection('ledgers').updateMany(
            ledgerFilter,
            { $set: { isDeleted: true, deletedAt: now, updatedAt: now } },
          )
        : Promise.resolve({ matchedCount: 0, modifiedCount: 0 }),
    ])

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        matchedTransactions: txRes.matchedCount || 0,
        archivedTransactions: txRes.modifiedCount || 0,
        matchedLedgers: ledgerRes.matchedCount || 0,
        archivedLedgers: ledgerRes.modifiedCount || 0,
      },
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
