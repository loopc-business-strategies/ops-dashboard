#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })
/**
 * MG staging: soft-delete all voucher transactions + their ledger rows.
 * Keeps chart of accounts, users, inventory product masters, customers/vendors.
 *
 * Preview:
 *   node scripts/destructive/clear-mg-all-vouchers.js
 *
 * Apply:
 *   node scripts/destructive/clear-mg-all-vouchers.js --apply-dev
 */
const dns = require('dns')
dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

require('dotenv').config()
const mongoose = require('mongoose')
const { looksLikeNonProductionUri, redactMongoUri } = require('../../utils/migrationSafety')

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const apply = hasFlag('--apply') || hasFlag('--apply-dev')
  const applyDev = hasFlag('--apply-dev')
  const uri = String(process.env.MONGO_URI_MG || '').trim()
  if (!uri) throw new Error('Missing MONGO_URI_MG')
  if (!looksLikeNonProductionUri(uri)) {
    throw new Error(`Refusing non-staging URI ${redactMongoUri(uri)}`)
  }

  console.log(`Target: ${redactMongoUri(uri)}`)
  console.log(`Mode: ${apply ? (applyDev ? 'APPLY-DEV' : 'APPLY') : 'DRY-RUN'}`)

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })
  const db = mongoose.connection.db
  const now = new Date()
  const reason = 'MG local clear: all voucher entries'

  const transactions = db.collection('transactions')
  const ledgers = db.collection('ledgers')
  const stockmovements = db.collection('stockmovements')

  const activeTx = await transactions.find({ isDeleted: { $ne: true } })
    .project({ type: 1, status: 1, 'voucherMeta.vocNo': 1, description: 1, journalEntryId: 1 })
    .toArray()

  const typeBreakdown = activeTx.reduce((acc, tx) => {
    const key = String(tx.type || '(none)')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const txIds = activeTx.map((tx) => tx._id)
  const journalIds = activeTx
    .map((tx) => tx.journalEntryId)
    .filter(Boolean)

  const preview = {
    activeTransactions: activeTx.length,
    typeBreakdown,
    sample: activeTx.slice(0, 30).map((tx) => ({
      id: String(tx._id),
      type: tx.type,
      status: tx.status,
      vocNo: tx?.voucherMeta?.vocNo || '',
      description: tx.description || '',
    })),
    activeLedgers: await ledgers.countDocuments({ isDeleted: { $ne: true } }),
    ledgersLinkedToTx: txIds.length
      ? await ledgers.countDocuments({
        isDeleted: { $ne: true },
        $or: [
          { referenceId: { $in: txIds } },
          ...(journalIds.length ? [{ _id: { $in: journalIds } }] : []),
        ],
      })
      : 0,
    activeStockMoves: await stockmovements.countDocuments({ isDeleted: { $ne: true } }),
    chartOfAccounts: await db.collection('chartofaccounts').countDocuments({}),
    inventoryItems: await db.collection('inventoryitems').countDocuments({ isDeleted: { $ne: true } }),
    users: await db.collection('users').countDocuments({}),
  }

  console.log(JSON.stringify({ preview }, null, 2))

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply-dev to write.')
    await mongoose.disconnect()
    return
  }

  if (!applyDev) {
    throw new Error('Use --apply-dev for this local MG staging cleanup.')
  }

  const softTx = await transactions.updateMany(
    { isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        status: 'voided',
        deleteReason: reason,
      },
    },
  )

  // Soft-delete ledgers tied to those vouchers, plus any remaining active ledger rows
  // so account enquiry / reports have no live voucher postings.
  const softLedgersLinked = txIds.length
    ? await ledgers.updateMany(
      {
        isDeleted: { $ne: true },
        $or: [
          { referenceId: { $in: txIds } },
          { referenceType: { $in: ['transaction', 'voucher', 'metal_voucher', 'inventory', 'direct_deal'] } },
          ...(journalIds.length ? [{ _id: { $in: journalIds } }] : []),
        ],
      },
      { $set: { isDeleted: true, deletedAt: now } },
    )
    : { modifiedCount: 0 }

  const softLedgersAll = await ledgers.updateMany(
    { isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now } },
  )

  const softMoves = await stockmovements.updateMany(
    { isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        deleteReason: reason,
      },
    },
  )

  const after = {
    activeTransactions: await transactions.countDocuments({ isDeleted: { $ne: true } }),
    activeLedgers: await ledgers.countDocuments({ isDeleted: { $ne: true } }),
    activeStockMoves: await stockmovements.countDocuments({ isDeleted: { $ne: true } }),
    inventoryItems: await db.collection('inventoryitems').countDocuments({ isDeleted: { $ne: true } }),
    chartOfAccounts: await db.collection('chartofaccounts').countDocuments({}),
  }

  console.log(JSON.stringify({
    applied: true,
    updates: {
      transactionsSoftDeleted: softTx.modifiedCount,
      ledgersSoftDeletedLinked: softLedgersLinked.modifiedCount || 0,
      ledgersSoftDeletedRemaining: softLedgersAll.modifiedCount,
      stockMovesSoftDeleted: softMoves.modifiedCount,
    },
    after,
  }, null, 2))

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err.message || err)
  try {
    await mongoose.disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
