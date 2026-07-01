const Customer = require('../../models/Customer')
const Ledger = require('../../models/Ledger')
const Transaction = require('../../models/Transaction')
const DirectDeal = require('../../models/DirectDeal')
const MetalRate = require('../../models/MetalRate')
const { canViewCustomers } = require('../erpAccounting/accessPolicy')
const { DEFAULT_METAL_RATES } = require('../erpAccounting/reportBrandingService')
const {
  isUnfixedFixingType,
  accumulateDirectDealMetalIntoMap,
  roundMetalPosition,
} = require('../erpAccounting/metalPositionPolicy')
const { computeMarginMetricsRaw, shouldSuppressSpotMetalMtmForCustomerDashboard } = require('../erpAccounting/metalMarginPolicy')

async function getRates() {
  const NON_FEED = ['manual', 'default', 'inventory']
  const latest = await MetalRate.findOne({
    source: { $nin: NON_FEED },
    goldPrice: { $gt: 0 },
  }).sort({ updatedAt: -1 }).lean()
  if (latest) {
    return { goldPrice: Number(latest.goldPrice) || 0, silverPrice: Number(latest.silverPrice) || 0 }
  }
  return { goldPrice: DEFAULT_METAL_RATES.goldPrice, silverPrice: DEFAULT_METAL_RATES.silverPrice }
}

function buildMetalMap(metalTxs, directDeals) {
  const metalPositionMap = new Map()
  ;(metalTxs || []).forEach((tx) => {
    const customerId = String(tx.customerId || '')
    if (!customerId) return
    const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
    if (!isUnfixedFixingType(fixingType)) return
    const position = metalPositionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
    const sign = tx.type === 'purchase' ? 1 : -1
    const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    lines.forEach((line) => {
      const pureWeight = Number(line?.pureWeight || 0)
      if (!Number.isFinite(pureWeight) || pureWeight === 0) return
      const stockCode = String(line?.stockCode || '').toUpperCase()
      if (stockCode.includes('XAG') || stockCode.includes('SILV')) {
        position.silverPosition += sign * pureWeight
      } else {
        position.goldPosition += sign * pureWeight
      }
    })
    metalPositionMap.set(customerId, position)
  })
  accumulateDirectDealMetalIntoMap(directDeals || [], metalPositionMap)
  return metalPositionMap
}

async function buildErpCustomerSnapshot(user) {
  if (!canViewCustomers(user)) {
    return { accessLevel: 'none', summary: null, topCustomers: [] }
  }

  const customers = await Customer.find({ isActive: true })
    .populate({ path: 'ledgerAccountId', select: 'accountName accountCode accountType openingBalance', match: { isActive: true } })
    .limit(30)
    .lean()

  const accountIds = customers.map((c) => c.ledgerAccountId?._id).filter(Boolean)
  const customerIds = customers.map((c) => c._id).filter(Boolean)

  const [debitAggs, creditAggs, rates, metalTxs, directDeals] = await Promise.all([
    accountIds.length
      ? Ledger.aggregate([
        { $match: { debitAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: '$debitAccountId', total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ])
      : [],
    accountIds.length
      ? Ledger.aggregate([
        { $match: { creditAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: '$creditAccountId', total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ])
      : [],
    getRates(),
    customerIds.length
      ? Transaction.find({
        customerId: { $in: customerIds },
        type: { $in: ['sale', 'purchase'] },
        status: 'posted',
        isDeleted: { $ne: true },
      }).select('customerId type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
      : [],
    customerIds.length
      ? DirectDeal.find({
        status: 'confirmed',
        isDeleted: { $ne: true },
        'lineItems.customerId': { $in: customerIds },
      }).select('lineItems.customerId lineItems.direction lineItems.metal lineItems.qty lineItems.stockCode').lean()
      : [],
  ])

  const debitMap = new Map(debitAggs.map((r) => [String(r._id), r.total]))
  const creditMap = new Map(creditAggs.map((r) => [String(r._id), r.total]))
  const metalPositionMap = buildMetalMap(metalTxs, directDeals)

  const rows = customers.map((customer) => {
    const accountId = String(customer.ledgerAccountId?._id || '')
    const customerId = String(customer._id)
    const debit = debitMap.get(accountId) || 0
    const credit = creditMap.get(accountId) || 0
    const opening = Number(customer.ledgerAccountId?.openingBalance ?? customer.openingBalance ?? 0)
    const net = opening + (debit - credit)
    const metalPosition = metalPositionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
    const goldPosition = roundMetalPosition(metalPosition.goldPosition)
    const silverPosition = roundMetalPosition(metalPosition.silverPosition)
    const suppress = shouldSuppressSpotMetalMtmForCustomerDashboard(customer.ledgerAccountId?.accountType)
    const raw = computeMarginMetricsRaw({
      totalFunds: net,
      goldPosition,
      silverPosition,
      goldPrice: rates.goldPrice,
      silverPrice: rates.silverPrice,
      suppressMetalSpotMtm: suppress,
      fundsMode: 'customerAbsIfNegative',
    })
    return {
      name: customer.name,
      outstandingUSD: Math.round(net * 100) / 100,
      marginStatus: raw.status,
      marginPercent: Math.round((raw.marginPercent || 0) * 100) / 100,
      goldPosition,
      silverPosition,
      exposureScore: Math.abs(net) + Math.abs(goldPosition) * rates.goldPrice + Math.abs(silverPosition) * rates.silverPrice,
    }
  })

  const topCustomers = rows
    .sort((a, b) => b.exposureScore - a.exposureScore)
    .slice(0, 8)
    .map(({ exposureScore: _exposureScore, ...rest }) => rest)

  const atRisk = rows.filter((r) => r.marginStatus === 'negative' || r.marginStatus === 'warning').length

  return {
    accessLevel: 'full',
    summary: {
      activeCustomers: customers.length,
      atRiskCount: atRisk,
      metalRates: rates,
    },
    topCustomers,
  }
}

module.exports = {
  buildErpCustomerSnapshot,
}
