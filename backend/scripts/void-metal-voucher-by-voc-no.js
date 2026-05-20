#!/usr/bin/env node
/**
 * Void a metal purchase or sale voucher by document number (voucherMeta.vocNo), matching
 * POST /transactions/:id/void: soft-delete ledgers, reverse stock movements, soft-delete transaction.
 *
 * Dry-run (default): prints what would happen; no writes.
 * Apply: requires destructive guard (same as other maintenance scripts).
 *
 *   node scripts/void-metal-voucher-by-voc-no.js --tenant=mg --voc-no=Pur/2026/0001
 *
 *   node scripts/void-metal-voucher-by-voc-no.js --tenant=mg --apply --voc-no=Pur/2026/0001 \
 *     --reason="Void erroneous metal purchase Pur/2026/0001" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 */

require('dotenv').config()
const path = require('path')
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')
const { reverseMetalVoucherStockForVoid, escapeRegExp } = require('../utils/metalVoucherStockReversal')
const { toQty } = require('../routes/erp-accounting/transactionHelpers')
const { appendTransactionAudit } = require('../utils/transactionWorkflowHelpers')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

async function voidOneTransaction({ tx, actor, Ledger, deleteReason }) {
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

  const StockMovement = require('../models/StockMovement')
  const InventoryItem = require('../models/InventoryItem')

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
  appendTransactionAudit(tx, actor, 'void', { fromStatus: tx.status, toStatus: 'voided', comment: deleteReason })
  await tx.save()
}

async function main() {
  const tenant = normalizeTenant(readArgValue('--tenant') || readArgValue('-t'))
  if (!tenant) {
    console.error('Missing --tenant=mg|cg|loopc')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  if (apply) {
    if (!readArgValue('--confirm')) {
      const fromEnv = String(
        process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN || process.env.CLEANUP_CONFIRM_TOKEN || '',
      ).trim()
      if (fromEnv) process.argv.push('--confirm', fromEnv)
    }
    require(path.join(__dirname, 'destructive', '_destructive-guard'))({
      scriptName: path.basename(__filename),
    })
  } else {
    console.log('--- DRY-RUN (no writes). Re-run with --apply and destructive guard args to commit. ---\n')
  }

  const vocNoArg = String(readArgValue('--voc-no') || process.env.VOID_VOC_NO || 'Pur/2026/0001').trim()
  if (!vocNoArg) {
    console.error('Missing --voc-no')
    process.exit(1)
  }

  const deleteReason = String(readArgValue('--reason') || process.env.VOID_REASON || '').trim()
  if (apply && deleteReason.length < 10) {
    console.error('With --apply, pass --reason with at least 10 characters (audit / guard).')
    process.exit(1)
  }

  const uri = getTenantUri(tenant)
  if (!uri) {
    console.error(`Missing Mongo URI for tenant ${tenant}`)
    process.exit(1)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })

  const Transaction = require('../models/Transaction')
  const Ledger = require('../models/Ledger')
  const User = require('../models/User')

  const actor =
    (await User.findOne({ role: 'super_admin', isActive: true }).select('_id name').lean())
    || (await User.findOne({ role: 'management', isActive: true }).select('_id name').lean())
    || (await User.findOne({ isActive: true }).select('_id name').lean())

  if (!actor) {
    console.error('No active user found to attribute void (need at least one user in DB).')
    await mongoose.disconnect()
    process.exit(1)
  }

  const vocRx = new RegExp(`^${escapeRegExp(vocNoArg)}$`, 'i')
  const txs = await Transaction.find({
    isDeleted: { $ne: true },
    type: { $in: ['purchase', 'sale'] },
    'voucherMeta.vocNo': vocRx,
  })
    .sort({ createdAt: -1 })
    .select('_id status type amount voucherMeta journalEntryId')
    .lean()

  if (!txs.length) {
    console.log(`No active purchase/sale transactions matched voc-no (case-insensitive): ${vocNoArg}`)
    await mongoose.disconnect()
    return
  }

  if (txs.length > 1) {
    console.error(`Matched ${txs.length} transactions; refusing ambiguous void. IDs: ${txs.map((t) => t._id).join(', ')}`)
    await mongoose.disconnect()
    process.exit(1)
  }

  const summary = txs[0]
  const ledgerN = await Ledger.countDocuments({ referenceId: summary._id, isDeleted: { $ne: true } })
  const journalExtra = summary.journalEntryId
    ? await Ledger.countDocuments({ _id: summary.journalEntryId, isDeleted: { $ne: true } })
    : 0

  console.log(JSON.stringify({
    tenant,
    vocNo: vocNoArg,
    apply,
    transaction: {
      _id: String(summary._id),
      status: summary.status,
      type: summary.type,
      amount: summary.amount,
      vocNoStored: summary.voucherMeta?.vocNo,
      partyCode: summary.voucherMeta?.partyCode,
    },
    activeLedgerRowsByReferenceId: ledgerN,
    journalEntryRowActive: journalExtra,
    actor: { id: String(actor._id), name: actor.name },
  }, null, 2))

  if (!apply) {
    await mongoose.disconnect()
    return
  }

  const txDoc = await Transaction.findById(summary._id)
  if (!txDoc || txDoc.isDeleted) {
    console.error('Transaction disappeared or already voided.')
    await mongoose.disconnect()
    process.exit(1)
  }

  await voidOneTransaction({
    tx: txDoc,
    actor,
    Ledger,
    deleteReason,
  })

  console.log('\nVoid applied: transaction soft-deleted, ledgers and stock reversed per server void rules.')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
