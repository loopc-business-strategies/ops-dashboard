require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const TARGET_TX_TYPES = ['payment', 'receipt', 'sale', 'purchase']
const TARGET_LEDGER_TYPES = ['payment', 'receipt', 'sale', 'purchase', 'journal', 'cogs', 'vat_input', 'vat_output', 'reversal']

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const now = new Date()

    const [coaCount, txCandidates, txTypeSummary, ledgerTypeSummary] = await Promise.all([
      db.collection('chartofaccounts').countDocuments({}),
      db.collection('transactions').find({
        isDeleted: { $ne: true },
        type: { $in: TARGET_TX_TYPES },
      }).project({ _id: 1, type: 1 }).toArray(),
      db.collection('transactions').aggregate([
        { $match: { isDeleted: { $ne: true }, type: { $in: TARGET_TX_TYPES } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('ledgers').aggregate([
        { $match: { isDeleted: { $ne: true }, referenceType: { $in: TARGET_LEDGER_TYPES } } },
        { $group: { _id: '$referenceType', count: { $sum: 1 } } },
      ]).toArray(),
    ])

    const txIds = txCandidates.map((x) => x._id)

    const linkedLedgerCount = txIds.length
      ? await db.collection('ledgers').countDocuments({
          isDeleted: { $ne: true },
          referenceId: { $in: txIds },
        })
      : 0

    const directLedgerTypeCount = await db.collection('ledgers').countDocuments({
      isDeleted: { $ne: true },
      referenceType: { $in: TARGET_LEDGER_TYPES },
    })

    const preview = {
      generatedAt: new Date().toISOString(),
      tenant: 'CG',
      dryRun: !apply,
      keep: {
        chartOfAccountsCount: coaCount,
      },
      candidates: {
        transactionCount: txCandidates.length,
        transactionByType: txTypeSummary,
        ledgerByReferenceType: ledgerTypeSummary,
        ledgersLinkedToTargetTransactions: linkedLedgerCount,
        ledgersByTargetReferenceType: directLedgerTypeCount,
      },
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry-run only. Re-run with --apply to execute purge.',
      }, null, 2))
      return
    }

    const [txRes, txJournalIdRes, ledgerByRefRes, ledgerByTypeRes, stockRes] = await Promise.all([
      db.collection('transactions').updateMany(
        {
          isDeleted: { $ne: true },
          type: { $in: TARGET_TX_TYPES },
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            status: 'void',
            updatedAt: now,
          },
        }
      ),
      db.collection('transactions').updateMany(
        {
          type: { $in: TARGET_TX_TYPES },
          $or: [{ journalEntryId: { $exists: true, $ne: null } }, { journalEntryId: { $type: 'string', $ne: '' } }],
        },
        {
          $set: {
            journalEntryId: null,
            updatedAt: now,
          },
        }
      ),
      db.collection('ledgers').updateMany(
        {
          isDeleted: { $ne: true },
          referenceId: { $in: txIds },
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          },
        }
      ),
      db.collection('ledgers').updateMany(
        {
          isDeleted: { $ne: true },
          referenceType: { $in: TARGET_LEDGER_TYPES },
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          },
        }
      ),
      db.collection('stockmovements').updateMany(
        {
          isDeleted: { $ne: true },
          referenceId: { $in: txIds },
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          },
        }
      ),
    ])

    const [remainingTx, remainingLedgers, remainingTargetLedgers, coaAfter] = await Promise.all([
      db.collection('transactions').countDocuments({ isDeleted: { $ne: true }, type: { $in: TARGET_TX_TYPES } }),
      db.collection('ledgers').countDocuments({ isDeleted: { $ne: true } }),
      db.collection('ledgers').countDocuments({ isDeleted: { $ne: true }, referenceType: { $in: TARGET_LEDGER_TYPES } }),
      db.collection('chartofaccounts').countDocuments({}),
    ])

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        transactionsSoftDeleted: txRes.modifiedCount || 0,
        transactionsJournalPointerCleared: txJournalIdRes.modifiedCount || 0,
        ledgersSoftDeletedByReferenceId: ledgerByRefRes.modifiedCount || 0,
        ledgersSoftDeletedByReferenceType: ledgerByTypeRes.modifiedCount || 0,
        stockMovementsSoftDeleted: stockRes.modifiedCount || 0,
      },
      remaining: {
        activeTargetTransactions: remainingTx,
        activeAllLedgers: remainingLedgers,
        activeTargetLedgers: remainingTargetLedgers,
      },
      keepVerified: {
        chartOfAccountsBefore: coaCount,
        chartOfAccountsAfter: coaAfter,
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
