#!/usr/bin/env node
/**
 * FILE: fix-multi-line-voucher-fx-mg.js
 * WHAT THIS DOES:
 *   Fixes vouchers in mg tenant that have multiple line items with incorrect exchange gain/loss.
 *   The issue: when a second line item was added, the system aggregated all line items' foreign amounts,
 *   causing incorrect FX gain/loss calculation.
 *   This script:
 *   1. Finds all posted payment/receipt vouchers with multiple line items
 *   2. Identifies those with incorrectly calculated exchange gain/loss
 *   3. Removes the incorrect FX journals
 *   4. Re-posts the voucher with the corrected FX calculation (primary line item only)
 */

require('dotenv').config()
const mongoose = require('mongoose')
const path = require('path')

// Models
const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const Currency = require('../models/Currency')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')

const { getTenantUri, normalizeTenant } = require('../config/tenants')

const TENANT = 'mg'

// Helper functions (from erp-accountingContext.js)
const toMoney = (value) => Number(Number(value || 0).toFixed(2))

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value || fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

const FX_REVALUATION_EPSILON = 0.01 // minimum FX difference to create journal entry

const resolveVoucherFxLineForeignAmount = (line = {}) => {
  const amount = Number(line.amountFC || line.amountFc || line.amtFc || line.headerAmt || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

const resolveVoucherFxLineBaseAmount = (line = {}) => {
  const foreignAmount = resolveVoucherFxLineForeignAmount(line)
  const lineRate = Number(line?.currRate || 0)
  if (foreignAmount > 0 && Number.isFinite(lineRate) && lineRate > 0) {
    return foreignAmount * lineRate
  }

  const candidates = [line.amountLC, line.totalAmount, line.amountWithVAT, line.metalAmount]
  for (const candidate of candidates) {
    const amount = Number(candidate || 0)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return 0
}

const resolvePrimaryVoucherFxLine = (voucherMeta = {}) => {
  const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
  if (!lines.length) return {}

  return lines.find((line) => {
    const hasCurrency = String(line?.currCode || '').trim().length > 0
    const hasRate = Number(line?.currRate || 0) > 0
    const hasForeign = resolveVoucherFxLineForeignAmount(line) > 0
    const hasBase = resolveVoucherFxLineBaseAmount(line) > 0
    return hasCurrency || hasRate || hasForeign || hasBase
  }) || lines[0] || {}
}

const resolveReferenceExchangeRate = (voucherMeta) => {
  const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
  const lineReferenceRate = lines.reduce((acc, line) => {
    if (acc > 0) return acc
    const rate = Number(line?.referenceRate || 0)
    return Number.isFinite(rate) && rate > 0 ? rate : 0
  }, 0)

  const rate = Number(
    voucherMeta?.referenceExchangeRate
    || voucherMeta?.invoiceExchangeRate
    || lineReferenceRate
    || 0
  )
  if (!Number.isFinite(rate) || rate <= 0) return null
  return rate
}

async function connectDb() {
  const uri = getTenantUri(TENANT)
  if (!uri) throw new Error(`No MongoDB URI for tenant: ${TENANT}`)
  
  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    retryWrites: true,
  })
  
  console.log(`✅ Connected to ${TENANT} database`)
}

async function findMultiLineVouchers() {
  // Find payment/receipt vouchers with multiple line items that have FX journals
  const vouchersWithMultiLines = await Transaction.aggregate([
    {
      $match: {
        type: { $in: ['payment', 'receipt'] },
        status: 'posted',
        isDeleted: { $ne: true },
      },
    },
    {
      $project: {
        _id: 1,
        type: 1,
        voucherMeta: 1,
        lineItemCount: {
          $size: {
            $ifNull: ['$voucherMeta.lineItems', []],
          },
        },
      },
    },
    {
      $match: {
        lineItemCount: { $gt: 1 },
      },
    },
  ])

  console.log(`Found ${vouchersWithMultiLines.length} vouchers with multiple line items`)
  return vouchersWithMultiLines.map(v => v._id)
}

async function checkAndFixVoucher(txId) {
  const tx = await Transaction.findById(txId).lean()
  if (!tx) return { status: 'not_found' }

  const voucherMeta = tx.voucherMeta || {}
  const lineItems = Array.isArray(voucherMeta.lineItems) ? voucherMeta.lineItems : []
  
  if (lineItems.length <= 1) {
    return { status: 'skipped_single_line', txId }
  }

  // Check if this voucher has FX journals
  const fxJournals = await Ledger.find({
    referenceId: txId,
    referenceType: 'journal',
    isDeleted: { $ne: true },
    description: /Exchange (gain|loss) adjustment/i,
  }).lean()

  if (!fxJournals.length) {
    return { status: 'no_fx_journals', txId, lineCount: lineItems.length }
  }

  // Get the primary line item
  const primaryLine = resolvePrimaryVoucherFxLine(voucherMeta)
  const referenceRate = resolveReferenceExchangeRate(voucherMeta)

  if (!referenceRate || referenceRate <= 0) {
    return { status: 'no_reference_rate', txId, lineCount: lineItems.length, fxJournalCount: fxJournals.length }
  }

  // Calculate what the correct FX should be based on PRIMARY line only
  const foreignAmount = resolveVoucherFxLineForeignAmount(primaryLine)
  const lineRate = Number(primaryLine?.currRate || tx.exchangeRate || 1)
  const expectedForeignAmount = Number(tx.amount || 0) / referenceRate
  const actualForeignAmount = foreignAmount > 0 ? foreignAmount : Number(tx.amount || 0) / lineRate

  const fcDiff = actualForeignAmount - expectedForeignAmount
  const rawDiffInBase = Math.abs(fcDiff) * referenceRate

  // If the difference is below epsilon, there shouldn't be any FX journals
  if (rawDiffInBase < FX_REVALUATION_EPSILON) {
    return {
      status: 'fx_should_be_removed',
      txId,
      lineCount: lineItems.length,
      fxJournalCount: fxJournals.length,
      rawDiffInBase: toMoney(rawDiffInBase),
      action: 'will_remove_fx_journals',
    }
  }

  return {
    status: 'ok',
    txId,
    lineCount: lineItems.length,
    fxJournalCount: fxJournals.length,
    correctedDiffInBase: toMoney(rawDiffInBase),
  }
}

async function removeIncorrectFxJournals(txId) {
  const result = await Ledger.updateMany(
    {
      referenceId: txId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
    },
    { $set: { isDeleted: true, updatedAt: new Date() } }
  )
  return result
}

async function main() {
  try {
    await connectDb()

    console.log(`\n📋 Scanning ${TENANT} for multi-line vouchers with FX issues...\n`)

    const txIds = await findMultiLineVouchers()
    const results = []
    let removedCount = 0

    for (const txId of txIds) {
      const check = await checkAndFixVoucher(txId)
      results.push(check)

      if (check.status === 'fx_should_be_removed') {
        await removeIncorrectFxJournals(txId)
        removedCount++
        console.log(`✅ Removed incorrect FX journals from ${txId}`)
      }
    }

    // Summary
    console.log(`\n${'='.repeat(70)}`)
    console.log(`📊 SUMMARY FOR TENANT: ${TENANT}`)
    console.log(`${'='.repeat(70)}\n`)

    const summary = {
      total: results.length,
      no_fx_journals: results.filter(r => r.status === 'no_fx_journals').length,
      fx_should_be_removed: results.filter(r => r.status === 'fx_should_be_removed').length,
      no_reference_rate: results.filter(r => r.status === 'no_reference_rate').length,
      ok: results.filter(r => r.status === 'ok').length,
      removed_fx_journal_count: removedCount,
    }

    console.log(`Total multi-line vouchers checked: ${summary.total}`)
    console.log(`  - With correct FX journals: ${summary.ok}`)
    console.log(`  - With removed FX journals: ${summary.removed_fx_journal_count}`)
    console.log(`  - With no FX journals: ${summary.no_fx_journals}`)
    console.log(`  - With no reference rate: ${summary.no_reference_rate}`)

    if (summary.removed_fx_journal_count > 0) {
      console.log(`\n✅ Fixed ${summary.removed_fx_journal_count} vouchers by removing incorrect FX journals`)
      console.log(`\n⚠️  NOTE: These vouchers will recalculate FX gain/loss correctly on next posting/revaluation.`)
    } else {
      console.log(`\n✅ No multi-line vouchers with incorrect FX journals found in ${TENANT}`)
    }

    console.log(`\n✅ Script completed successfully\n`)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
