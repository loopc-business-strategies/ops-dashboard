#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })
/**
 * Remove all MG metal purchase and metal receipt vouchers (soft-delete + ledger/stock cleanup).
 *
 * Dry-run (default):
 *   node scripts/destructive/clear-mg-purchase-metal-receipt-vouchers.js
 *
 * Apply:
 *   node scripts/destructive/clear-mg-purchase-metal-receipt-vouchers.js --apply --tenant=mg \
 *     --reason="Remove disabled MG purchase and metal receipt vouchers" \
 *     --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 */
require('dotenv').config()
const path = require('path')
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri } = require('../../config/tenants')
const { reverseMetalVoucherStockForVoid } = require('../../utils/metalVoucherStockReversal')
const { toQty } = require('../../routes/erp-accounting/transactionHelpers')
const { appendTransactionAudit } = require('../../utils/transactionWorkflowHelpers')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const TENANT = 'mg'
const TARGET_TYPES = ['purchase', 'metal_receipt']

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

async function voidOneTransaction({ tx, actor, Ledger, StockMovement, InventoryItem, deleteReason }) {
  const now = new Date()

  await Ledger.updateMany(
    { referenceId: tx._id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now, updatedBy: actor._id } },
  )

  if (tx.journalEntryId) {
    await Ledger.updateMany(
      { _id: tx.journalEntryId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: actor._id } },
    )
  }

  await reverseMetalVoucherStockForVoid({
    tx,
    user: actor,
    StockMovement,
    InventoryItem,
    toQty,
    deleteReason,
  })

  tx.isDeleted = true
  tx.deletedAt = now
  tx.updatedBy = actor._id
  appendTransactionAudit(tx, actor, 'void', {
    fromStatus: tx.status,
    toStatus: 'voided',
    comment: deleteReason,
  })
  await tx.save()
}

async function main() {
  const applyDev = process.argv.includes('--apply-dev')
  const apply = process.argv.includes('--apply') || applyDev
  if (apply && !applyDev) {
    if (!readArgValue('--confirm')) {
      const fromEnv = String(
        process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN || process.env.CLEANUP_CONFIRM_TOKEN || '',
      ).trim()
      if (fromEnv) process.argv.push('--confirm', fromEnv)
    }
    require(path.join(__dirname, '_destructive-guard'))({ scriptName: path.basename(__filename) })
  } else if (!apply) {
    console.log('--- DRY-RUN (no writes). Re-run with --apply --tenant=mg and destructive guard args to commit. ---\n')
  } else if (applyDev) {
    console.log('--- APPLY-DEV (local development cleanup; no production guard token required) ---\n')
  }

  const uri = getTenantUri(TENANT)
  if (!uri) {
    throw new Error(`Missing Mongo URI for tenant ${TENANT}`)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })

  const Transaction = require('../../models/Transaction')
  const Ledger = require('../../models/Ledger')
  const StockMovement = require('../../models/StockMovement')
  const InventoryItem = require('../../models/InventoryItem')
  const User = require('../../models/User')

  const actor =
    (await User.findOne({ role: 'super_admin', isActive: true }).select('_id name').lean())
    || (await User.findOne({ role: 'management', isActive: true }).select('_id name').lean())
    || (await User.findOne({ isActive: true }).select('_id name').lean())

  if (!actor) {
    throw new Error('No active user found to attribute void actions')
  }

  const txs = await Transaction.find({
    isDeleted: { $ne: true },
    type: { $in: TARGET_TYPES },
  })
    .sort({ date: -1, createdAt: -1 })
    .select('_id status type amount date voucherMeta journalEntryId')
    .lean()

  const preview = {
    tenant: TENANT,
    apply,
    targetTypes: TARGET_TYPES,
    matchedTransactions: txs.length,
    typeBreakdown: TARGET_TYPES.reduce((acc, key) => {
      acc[key] = txs.filter((tx) => String(tx.type || '').toLowerCase() === key).length
      return acc
    }, {}),
    sample: txs.slice(0, 20).map((tx) => ({
      id: String(tx._id),
      type: tx.type,
      status: tx.status,
      docNo: tx?.voucherMeta?.vocNo || '',
      partyCode: tx?.voucherMeta?.partyCode || '',
      date: tx.date,
      amount: tx.amount,
    })),
    actor: { id: String(actor._id), name: actor.name },
  }

  console.log(JSON.stringify(preview, null, 2))

  if (!apply || !txs.length) {
    await mongoose.disconnect()
    return
  }

  const deleteReason = String(readArgValue('--reason') || 'Remove disabled MG purchase and metal receipt vouchers').trim()
  const results = []

  for (const summary of txs) {
    const txDoc = await Transaction.findById(summary._id)
    if (!txDoc || txDoc.isDeleted) {
      results.push({ id: String(summary._id), ok: false, reason: 'missing_or_already_deleted' })
      continue
    }
    await voidOneTransaction({
      tx: txDoc,
      actor,
      Ledger,
      StockMovement,
      InventoryItem,
      deleteReason,
    })
    results.push({
      id: String(summary._id),
      ok: true,
      type: txDoc.type,
      docNo: txDoc?.voucherMeta?.vocNo || '',
      status: summary.status,
    })
  }

  const remaining = await Transaction.countDocuments({
    isDeleted: { $ne: true },
    type: { $in: TARGET_TYPES },
  })

  console.log(JSON.stringify({
    tenant: TENANT,
    apply: true,
    processed: results.length,
    succeeded: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    remainingActive: remaining,
    results,
  }, null, 2))

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  try { await mongoose.disconnect() } catch { void 0 }
  process.exit(1)
})
