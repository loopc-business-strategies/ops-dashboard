#!/usr/bin/env node
require('dotenv').config()

const dns = require('dns')
const mongoose = require('mongoose')

const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const Currency = require('../models/Currency')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const { getTenantUri } = require('../config/tenants')

const TENANT = 'mg'
const FX_REVALUATION_EPSILON = 0.01

const toMoney = (value) => Number(Number(value || 0).toFixed(2))
const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

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

  return Number.isFinite(rate) && rate > 0 ? rate : 0
}

const resolveVoucherFxMetrics = ({ voucherMeta = {}, fallbackRate = 0, referenceRate = 0 }) => {
  const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
  const normalizedFallbackRate = Number(fallbackRate || 0)
  const normalizedReferenceRate = Number(referenceRate || 0)

  let totalForeignAmount = 0
  let totalBaseAmount = 0
  let totalExpectedForeignAmount = 0
  let totalActualForeignAmount = 0
  let hasUsableLine = false

  lines.forEach((line) => {
    const foreignAmount = resolveVoucherFxLineForeignAmount(line)
    const baseAmount = resolveVoucherFxLineBaseAmount(line)
    const lineRateRaw = Number(line?.currRate || 0)
    const lineRate = lineRateRaw > 0
      ? lineRateRaw
      : (foreignAmount > 0 && baseAmount > 0
        ? (baseAmount / foreignAmount)
        : (Number.isFinite(normalizedFallbackRate) && normalizedFallbackRate > 0 ? normalizedFallbackRate : 0))

    const lineActualForeign = foreignAmount > 0
      ? foreignAmount
      : (lineRate > 0 && baseAmount > 0 ? (baseAmount / lineRate) : 0)
    const lineExpectedForeign = normalizedReferenceRate > 0 && baseAmount > 0
      ? (baseAmount / normalizedReferenceRate)
      : 0

    const lineHasData = (foreignAmount > 0 || baseAmount > 0 || lineRate > 0)
    if (!lineHasData) return

    hasUsableLine = true
    if (foreignAmount > 0) totalForeignAmount += foreignAmount
    if (baseAmount > 0) totalBaseAmount += baseAmount
    totalActualForeignAmount += lineActualForeign
    totalExpectedForeignAmount += lineExpectedForeign
  })

  if (!hasUsableLine) {
    return {
      lineRate: normalizedFallbackRate,
      totalForeignAmount: 0,
      totalBaseAmount: 0,
      actualForeignAmount: 0,
      expectedForeignAmount: 0,
      fcDifference: 0,
    }
  }

  const aggregateLineRate = totalActualForeignAmount > 0 && totalBaseAmount > 0
    ? (totalBaseAmount / totalActualForeignAmount)
    : (Number.isFinite(normalizedFallbackRate) && normalizedFallbackRate > 0 ? normalizedFallbackRate : 0)

  return {
    lineRate: aggregateLineRate,
    totalForeignAmount,
    totalBaseAmount,
    actualForeignAmount: totalActualForeignAmount,
    expectedForeignAmount: totalExpectedForeignAmount,
    fcDifference: totalActualForeignAmount - totalExpectedForeignAmount,
  }
}

async function connectDb() {
  const dnsServers = process.env.DNS_SERVERS
    ? process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['8.8.8.8', '8.8.4.4']
  dns.setServers(dnsServers)

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

  console.log(`Connected to ${TENANT} database`)
}

async function resolveExchangeAccounts(isGain) {
  const mappingType = isGain ? 'exchange_gain' : 'exchange_loss'
  const mapping = await AccountMapping.findOne({ mappingType, isActive: true })
    .select('debitAccountId creditAccountId')
    .lean()

  if (!mapping?.debitAccountId || !mapping?.creditAccountId) return null

  const [debitAccount, creditAccount] = await Promise.all([
    ChartOfAccount.findOne({ _id: mapping.debitAccountId, isActive: true }).select('_id').lean(),
    ChartOfAccount.findOne({ _id: mapping.creditAccountId, isActive: true }).select('_id').lean(),
  ])

  if (!debitAccount || !creditAccount) return null
  return {
    debitAccountId: mapping.debitAccountId,
    creditAccountId: mapping.creditAccountId,
  }
}

async function softDeleteJournals(journals, actorId) {
  if (!journals.length) return 0
  const ids = journals.map((j) => j._id)
  const res = await Ledger.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId || null,
        updatedAt: new Date(),
      },
    }
  )
  return Number(res.modifiedCount || 0)
}

async function reconcileVoucher(tx, baseCurrencyCode) {
  const voucherMeta = tx.voucherMeta || {}
  const voucherLine = resolvePrimaryVoucherFxLine(voucherMeta)
  const currencyCode = String(tx.currency || 'USD').toUpperCase()
  const lineCurrCode = String(voucherLine?.currCode || currencyCode || 'USD').toUpperCase()

  const txCurrency = await Currency.findOne({ code: currencyCode, isActive: true }).lean()
  let masterRate = 0
  if (lineCurrCode !== String(baseCurrencyCode || 'USD').toUpperCase()) {
    if (lineCurrCode === currencyCode) {
      masterRate = Number(txCurrency?.exchangeRate || 0)
    } else {
      const lineCurrency = await Currency.findOne({ code: lineCurrCode, isActive: true }).lean()
      masterRate = Number(lineCurrency?.exchangeRate || 0)
    }
  }

  const referenceRate = Number(resolveReferenceExchangeRate(voucherMeta) || masterRate || 0)
  const existing = await Ledger.find({
    referenceId: tx._id,
    referenceType: 'journal',
    isDeleted: { $ne: true },
    description: /Exchange (gain|loss) adjustment/i,
  }).sort({ createdAt: 1, _id: 1 })

  if (!(Number.isFinite(referenceRate) && referenceRate > 0)) {
    const removed = await softDeleteJournals(existing, tx.updatedBy || tx.postedBy || tx.createdBy)
    return { status: 'no_reference_rate', removed }
  }

  const fallbackRate = Number(voucherLine?.currRate || tx.exchangeRate || masterRate || 1)
  const fxMetrics = resolveVoucherFxMetrics({
    voucherMeta,
    fallbackRate,
    referenceRate,
  })

  const fcDiff = Number(fxMetrics.fcDifference || 0)
  const rawDiffInBase = Math.abs(fcDiff) * referenceRate

  if (rawDiffInBase < FX_REVALUATION_EPSILON) {
    const removed = await softDeleteJournals(existing, tx.updatedBy || tx.postedBy || tx.createdBy)
    return { status: 'no_fx_required', removed }
  }

  const txType = String(tx.type || '').toLowerCase()
  const expectedDirection = txType === 'payment'
    ? (fcDiff < 0 ? 'gain' : 'loss')
    : (fcDiff > 0 ? 'gain' : 'loss')
  const expectedAmount = toMoney(rawDiffInBase)
  const actorId = tx.updatedBy || tx.postedBy || tx.createdBy

  const matching = existing.find((j) => {
    const d = String(j.description || '').toLowerCase()
    return expectedDirection === 'gain' ? d.includes('exchange gain') : d.includes('exchange loss')
  })

  const extras = matching ? existing.filter((j) => String(j._id) !== String(matching._id)) : existing
  let removedExtra = 0
  if (extras.length) {
    removedExtra = await softDeleteJournals(extras, actorId)
  }

  if (matching) {
    const needsAmountUpdate = Math.abs(Number(matching.amount || 0) - expectedAmount) >= FX_REVALUATION_EPSILON
    const targetDescription = `Exchange ${expectedDirection} adjustment for transaction ${tx._id}`
    const needsDescriptionUpdate = String(matching.description || '') !== targetDescription

    if (needsAmountUpdate || needsDescriptionUpdate) {
      await Ledger.updateOne(
        { _id: matching._id },
        {
          $set: {
            amount: expectedAmount,
            description: targetDescription,
            updatedBy: actorId || null,
            updatedAt: new Date(),
          },
        }
      )
      return { status: 'updated_existing', removedExtra }
    }

    return { status: 'already_correct', removedExtra }
  }

  const accounts = await resolveExchangeAccounts(expectedDirection === 'gain')
  if (!accounts) {
    return { status: 'missing_mapping', removedExtra }
  }

  await Ledger.create({
    date: tx.date || new Date(),
    debitAccountId: accounts.debitAccountId,
    creditAccountId: accounts.creditAccountId,
    amount: expectedAmount,
    description: `Exchange ${expectedDirection} adjustment for transaction ${tx._id}`,
    referenceType: 'journal',
    referenceId: tx._id,
    createdBy: actorId,
    updatedBy: actorId,
    department: '',
    currency: baseCurrencyCode,
    exchangeRate: 1,
  })

  return { status: 'created_missing', removedExtra }
}

async function main() {
  try {
    await connectDb()

    const base = await Currency.findOne({ baseCurrency: true, isActive: true }).lean()
    const baseCurrencyCode = String(base?.code || 'USD').toUpperCase()

    const vouchers = await Transaction.find({
      type: { $in: ['payment', 'receipt'] },
      status: 'posted',
      isDeleted: { $ne: true },
    })
      .select('_id type status amount currency exchangeRate date createdBy updatedBy postedBy voucherMeta')
      .lean()

    console.log(`Scanning ${vouchers.length} posted payment/receipt vouchers in ${TENANT}`)

    const stats = {
      total: vouchers.length,
      payments: vouchers.filter((v) => v.type === 'payment').length,
      receipts: vouchers.filter((v) => v.type === 'receipt').length,
      already_correct: 0,
      updated_existing: 0,
      created_missing: 0,
      no_fx_required: 0,
      no_reference_rate: 0,
      missing_mapping: 0,
      removed_total: 0,
    }

    for (const tx of vouchers) {
      const result = await reconcileVoucher(tx, baseCurrencyCode)
      if (Object.prototype.hasOwnProperty.call(stats, result.status)) {
        stats[result.status] += 1
      }
      stats.removed_total += Number(result.removed || result.removedExtra || 0)
    }

    console.log('\n===== MG Payment/Receipt Voucher FX Reconciliation =====')
    console.log(`Total scanned: ${stats.total}`)
    console.log(`Payment vouchers: ${stats.payments}`)
    console.log(`Receipt vouchers: ${stats.receipts}`)
    console.log(`Already correct: ${stats.already_correct}`)
    console.log(`Updated existing FX journals: ${stats.updated_existing}`)
    console.log(`Created missing FX journals: ${stats.created_missing}`)
    console.log(`No FX required (removed old): ${stats.no_fx_required}`)
    console.log(`No reference rate (removed old): ${stats.no_reference_rate}`)
    console.log(`Missing mapping (manual review): ${stats.missing_mapping}`)
    console.log(`Total FX journals removed: ${stats.removed_total}`)
    console.log('===============================================\n')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
