/**
 * Report-only mark-to-market of the company's metal book (nothing is posted).
 *
 * Fixing deals post their full value to income/expense with no metal leg, and
 * metal receipts/payments move stock without ledger entries, so the P&L alone
 * misses the value of metal the company still owes or is owed. Valuing the whole
 * book at market and swapping out the inventory book value covers both:
 *
 *   adjustment = (pure stock − metal owed to parties) × price − inventory book value
 */

const {
  createEmptyMetalPosition,
  addOpenUnfixedVoucherWeight,
  addSignedWeightToPosition,
  resolveDirectDealLineSignedWeight,
  resolveDirectDealLineMetalCode,
} = require('./metalPositionPolicy')
const { resolveTransferSignedPureWeight } = require('../../utils/metalStockVoucherTypes')

const UNFIXED_STATUSES = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix']
const VALUED_METALS = ['gold', 'silver']

const roundGrams = (value) => Number(Number(value || 0).toFixed(3))
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

function parseItemCategory(category = '') {
  return String(category || '').split(';').reduce((acc, part) => {
    const [key, ...rest] = part.split('=')
    if (key && rest.length) acc[key.trim()] = rest.join('=').trim()
    return acc
  }, {})
}

/** Pure grams held for an inventory item, by metal; null when the item isn't gold/silver. */
function resolveInventoryItemPureStock(item = {}) {
  const meta = parseItemCategory(item.category)
  const metal = String(meta.metalType || meta.mainStock || '').trim().toLowerCase()
  if (!VALUED_METALS.includes(metal)) return null
  const rawPurity = Number(meta.productPurity || 0)
  const purity = rawPurity > 1.2 ? rawPurity / 1000 : rawPurity > 0 ? rawPurity : 1
  return { metal, grams: Number(item.quantity || 0) * purity }
}

/** Grams owed to parties (positive = in the party's favour), by metal. */
function accumulateMetalOwedToParties({ unfixedVouchers = [], transfers = [], directDeals = [] } = {}) {
  const owed = createEmptyMetalPosition()
  for (const tx of unfixedVouchers) {
    addOpenUnfixedVoucherWeight(owed, tx, { valuation: true })
  }
  for (const tx of transfers) {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    for (const line of lines) {
      // A receipt is metal the party is owed; a payment settles it.
      addSignedWeightToPosition(owed, -resolveTransferSignedPureWeight(tx.type, [line]), { stockCode: line?.stockCode })
    }
  }
  for (const deal of directDeals) {
    const lines = Array.isArray(deal?.lineItems) ? deal.lineItems : []
    for (const line of lines) {
      if (!line?.customerId) continue
      addSignedWeightToPosition(owed, resolveDirectDealLineSignedWeight(line), {
        stockCode: line?.stockCode,
        metalCode: resolveDirectDealLineMetalCode(line),
      })
    }
  }
  return owed
}

function computeMetalBookRevaluation({
  inventoryItems = [],
  inventoryBookValue = 0,
  unfixedVouchers = [],
  transfers = [],
  directDeals = [],
  rates = {},
} = {}) {
  const stock = createEmptyMetalPosition()
  for (const item of inventoryItems) {
    const held = resolveInventoryItemPureStock(item)
    if (held) stock[held.metal] += held.grams
  }
  const owed = accumulateMetalOwedToParties({ unfixedVouchers, transfers, directDeals })
  const prices = { gold: Number(rates.goldPrice || 0), silver: Number(rates.silverPrice || 0) }

  const metals = VALUED_METALS.map((metal) => {
    const netGrams = stock[metal] - owed[metal]
    return {
      metal,
      stockGrams: roundGrams(stock[metal]),
      owedGrams: roundGrams(owed[metal]),
      netGrams: roundGrams(netGrams),
      pricePerGram: prices[metal],
      marketValue: roundMoney(netGrams * prices[metal]),
    }
  })
  const marketValue = metals.reduce((sum, row) => sum + row.marketValue, 0)
  return {
    metals,
    marketValue: roundMoney(marketValue),
    inventoryBookValue: roundMoney(inventoryBookValue),
    adjustment: roundMoney(marketValue - Number(inventoryBookValue || 0)),
    priceCurrency: rates.priceCurrency || 'USD',
    rateUpdatedAt: rates.updatedAt || null,
    priceSource: rates.priceSource || '',
    feedUpdatedAt: rates.feedUpdatedAt || null,
  }
}

async function loadMetalBookRevaluation({
  InventoryItem,
  Ledger,
  ChartOfAccount,
  Transaction,
  DirectDeal,
  getValuationMetalRate,
  DEFAULT_METAL_RATES,
}) {
  const [inventoryItems, unfixedVouchers, transfers, directDeals, latestRate] = await Promise.all([
    InventoryItem.find({ isDeleted: { $ne: true } }).select('category quantity ledgerAccountId').lean(),
    Transaction.find({
      type: { $in: ['sale', 'purchase'] },
      status: 'posted',
      isDeleted: { $ne: true },
      $or: [
        { metalFixStatus: { $in: UNFIXED_STATUSES } },
        { 'voucherMeta.fixingType': { $in: UNFIXED_STATUSES } },
      ],
    }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems voucherMeta.fixings').lean(),
    Transaction.find({
      type: { $in: ['metal_receipt', 'metal_payment'] },
      status: 'posted',
      isDeleted: { $ne: true },
    }).select('type voucherMeta.lineItems').lean(),
    DirectDeal.find({ status: 'confirmed', isDeleted: { $ne: true } })
      .select('lineItems.customerId lineItems.direction lineItems.metal lineItems.qty lineItems.stockCode')
      .lean(),
    typeof getValuationMetalRate === 'function' ? getValuationMetalRate() : null,
  ])

  const stockAccountIds = Array.from(new Set(inventoryItems
    .filter((item) => resolveInventoryItemPureStock(item) && item.ledgerAccountId)
    .map((item) => String(item.ledgerAccountId))))
  let inventoryBookValue = 0
  if (stockAccountIds.length) {
    const accounts = await ChartOfAccount.find({ _id: { $in: stockAccountIds } }).select('openingBalance').lean()
    const accountIds = accounts.map((acc) => acc._id)
    const signedAmount = { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] }
    const [debitAgg, creditAgg] = await Promise.all([
      Ledger.aggregate([
        { $match: { debitAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: signedAmount } } },
      ]),
      Ledger.aggregate([
        { $match: { creditAccountId: { $in: accountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: signedAmount } } },
      ]),
    ])
    const opening = accounts.reduce((sum, acc) => sum + Number(acc.openingBalance || 0), 0)
    inventoryBookValue = opening + Number(debitAgg[0]?.total || 0) - Number(creditAgg[0]?.total || 0)
  }

  return computeMetalBookRevaluation({
    inventoryItems,
    inventoryBookValue,
    unfixedVouchers,
    transfers,
    directDeals,
    rates: latestRate || DEFAULT_METAL_RATES || {},
  })
}

module.exports = {
  parseItemCategory,
  resolveInventoryItemPureStock,
  accumulateMetalOwedToParties,
  computeMetalBookRevaluation,
  loadMetalBookRevaluation,
}
