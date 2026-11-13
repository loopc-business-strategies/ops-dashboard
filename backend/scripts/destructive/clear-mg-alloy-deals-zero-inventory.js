#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })
/**
 * MG staging cleanup:
 * - soft-delete all gold alloy stock movements + related inventory ledgers + AML metal_payment txs
 * - soft-delete all Fixing/Direct deals + their ledgers
 * - soft-delete all remaining active stock movements
 * - zero InventoryItem.quantity / pcs (keep product/stock master rows)
 *
 * Preview:
 *   node scripts/destructive/clear-mg-alloy-deals-zero-inventory.js
 *
 * Apply (local/dev staging URI only):
 *   node scripts/destructive/clear-mg-alloy-deals-zero-inventory.js --apply-dev
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

const ALLOY_REASON = /Gold alloy mix|alloy mix/i
const ALLOY_DESC = /Gold alloy mix|alloy mix|Alloy metal loss|alloy metal loss/i
const AML_VOC = /^AML-/i

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
  const reason = 'MG local clear: alloy + fixing deals + zero inventory qty'

  const inventoryitems = db.collection('inventoryitems')
  const stockmovements = db.collection('stockmovements')
  const directdeals = db.collection('directdeals')
  const transactions = db.collection('transactions')
  const ledgers = db.collection('ledgers')

  const preview = {
    inventoryActive: await inventoryitems.countDocuments({ isDeleted: { $ne: true } }),
    inventoryNonZeroQty: await inventoryitems.countDocuments({
      isDeleted: { $ne: true },
      $or: [{ quantity: { $ne: 0 } }, { pcs: { $gt: 0 } }],
    }),
    stockMovesActive: await stockmovements.countDocuments({ isDeleted: { $ne: true } }),
    alloyMovesAll: await stockmovements.countDocuments({ reason: ALLOY_REASON }),
    alloyMovesActive: await stockmovements.countDocuments({
      isDeleted: { $ne: true },
      reason: ALLOY_REASON,
    }),
    directDealsActive: await directdeals.countDocuments({ isDeleted: { $ne: true } }),
    directDealLedgersActive: await ledgers.countDocuments({
      referenceType: 'direct_deal',
      isDeleted: { $ne: true },
    }),
    inventoryLedgersActive: await ledgers.countDocuments({
      referenceType: 'inventory',
      isDeleted: { $ne: true },
      description: ALLOY_DESC,
    }),
    amlTxActive: await transactions.countDocuments({
      isDeleted: { $ne: true },
      $or: [
        { 'voucherMeta.vocNo': AML_VOC },
        { description: ALLOY_DESC },
        { type: 'metal_payment', 'voucherMeta.refNo': /alloy.?metal.?loss|Gold alloy/i },
      ],
    }),
  }

  console.log(JSON.stringify({ preview }, null, 2))

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply-dev to write.')
    await mongoose.disconnect()
    return
  }

  if (!applyDev) {
    throw new Error('Use --apply-dev for this local MG staging cleanup (no production token path).')
  }

  const soft = {
    isDeleted: true,
    deletedAt: now,
    deleteReason: reason,
  }

  const alloyMoves = await stockmovements.updateMany(
    { reason: ALLOY_REASON, isDeleted: { $ne: true } },
    { $set: soft },
  )

  const alloyLedgers = await ledgers.updateMany(
    {
      isDeleted: { $ne: true },
      $or: [
        { referenceType: 'inventory', description: ALLOY_DESC },
        { description: ALLOY_DESC },
      ],
    },
    { $set: { isDeleted: true, deletedAt: now } },
  )

  const amlTx = await transactions.updateMany(
    {
      isDeleted: { $ne: true },
      $or: [
        { 'voucherMeta.vocNo': AML_VOC },
        { description: ALLOY_DESC },
        { type: 'metal_payment', 'voucherMeta.refNo': /alloy.?metal.?loss|Gold alloy/i },
      ],
    },
    { $set: { isDeleted: true, deletedAt: now } },
  )

  const dealIds = (
    await directdeals.find({ isDeleted: { $ne: true } }).project({ _id: 1 }).toArray()
  ).map((row) => row._id)

  const deals = await directdeals.updateMany(
    { isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now } },
  )

  const dealLedgers = await ledgers.updateMany(
    {
      isDeleted: { $ne: true },
      $or: [
        { referenceType: 'direct_deal' },
        ...(dealIds.length ? [{ referenceId: { $in: dealIds } }] : []),
      ],
    },
    { $set: { isDeleted: true, deletedAt: now } },
  )

  const otherMoves = await stockmovements.updateMany(
    { isDeleted: { $ne: true } },
    { $set: soft },
  )

  const zeroInv = await inventoryitems.updateMany(
    { isDeleted: { $ne: true } },
    { $set: { quantity: 0, pcs: 0 } },
  )

  // Remove soft-deleted alloy clutter from stock ledger history UI.
  const hardAlloyHistory = await stockmovements.deleteMany({
    isDeleted: true,
    reason: ALLOY_REASON,
  })

  const after = {
    inventoryActive: await inventoryitems.countDocuments({ isDeleted: { $ne: true } }),
    inventoryNonZeroQty: await inventoryitems.countDocuments({
      isDeleted: { $ne: true },
      $or: [{ quantity: { $ne: 0 } }, { pcs: { $gt: 0 } }],
    }),
    stockMovesActive: await stockmovements.countDocuments({ isDeleted: { $ne: true } }),
    alloyMovesRemaining: await stockmovements.countDocuments({ reason: ALLOY_REASON }),
    directDealsActive: await directdeals.countDocuments({ isDeleted: { $ne: true } }),
    amlTxActive: await transactions.countDocuments({
      isDeleted: { $ne: true },
      $or: [{ 'voucherMeta.vocNo': AML_VOC }, { description: ALLOY_DESC }],
    }),
    dealLedgersActive: await ledgers.countDocuments({
      referenceType: 'direct_deal',
      isDeleted: { $ne: true },
    }),
    alloyLedgersActive: await ledgers.countDocuments({
      isDeleted: { $ne: true },
      description: ALLOY_DESC,
    }),
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        updates: {
          alloyMovesSoftDeleted: alloyMoves.modifiedCount,
          alloyLedgersSoftDeleted: alloyLedgers.modifiedCount,
          amlTxSoftDeleted: amlTx.modifiedCount,
          directDealsSoftDeleted: deals.modifiedCount,
          dealLedgersSoftDeleted: dealLedgers.modifiedCount,
          otherMovesSoftDeleted: otherMoves.modifiedCount,
          inventoryZeroed: zeroInv.modifiedCount,
          alloyHistoryHardDeleted: hardAlloyHistory.deletedCount,
        },
        after,
      },
      null,
      2,
    ),
  )

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
