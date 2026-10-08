/**
 * Shared metal position accumulation for account enquiry, customer margin, and dashboard.
 * Position = unfixed sale/purchase + metal transfers (caller) + confirmed direct deals.
 */

const { resolveTransferSignedPureWeight } = require('../../utils/metalStockVoucherTypes')

const OZ_TO_GRAM = 31.1034768
const METAL_TRANSFER_POSITION_TYPES = ['metal_receipt', 'metal_payment']

function isUnfixedFixingType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
}

function roundMetalPosition(value) {
  return Number(Number(value || 0).toFixed(6))
}

function isSilverLine(stockCode = '', metalCode = '') {
  const sc = String(stockCode || '').toUpperCase()
  const mc = String(metalCode || '').trim().toUpperCase()
  return sc.includes('XAG') || sc.includes('SILV') || mc === 'XAG'
}

function resolveDirectDealLineWeightGram(line = {}) {
  const qty = Number(line?.qty || 0)
  if (!Number.isFinite(qty) || qty <= 0) return 0
  const stockCode = String(line?.stockCode || 'OZ').trim().toUpperCase()
  if (stockCode === 'KG') return qty * 1000
  if (stockCode === 'GRAM') return qty
  return qty * OZ_TO_GRAM
}

function resolveDirectDealLineSignedWeight(line = {}) {
  const grams = resolveDirectDealLineWeightGram(line)
  if (grams <= 0) return 0
  const direction = String(line?.direction || '').trim().toLowerCase()
  // Metal stays on account: buy => customer holds the grams (positive, in the
  // customer's favour, offsetting the cash debit); sell => customer gives grams up.
  return direction === 'buy' ? grams : -grams
}

/**
 * Unfixed sale/purchase voucher grams follow the same side as the trade:
 * sale => metal to the party (positive / Dr), purchase => metal from the party
 * (negative / Cr). Matches direct deals and metal payment (Dr) / receipt (Cr).
 */
function resolveUnfixedVoucherWeightSign(txType = '') {
  const type = String(txType || '').trim().toLowerCase()
  if (type === 'sale') return 1
  if (type === 'purchase') return -1
  return 0
}

/**
 * Open unfixed grams are valued on the party's side of the price still to be
 * fixed: a purchase (metal received, not yet priced) is owed to the party and
 * counts in its favour, a sale counts against it. That is the opposite of the
 * Dr/Cr side the grams show on, so margin/equity use this sign instead.
 */
function resolveUnfixedVoucherValuationSign(txType = '') {
  return -resolveUnfixedVoucherWeightSign(txType) || 0
}

/**
 * Direct deal direction is the customer's side (buy posts Dr customer / Cr Gold
 * Sales Fixing). Company reports (fixing register, dashboard net position) need
 * MG's side, matching vouchers where purchase = buy.
 */
function resolveDirectDealCompanyDirection(direction = '') {
  const normalized = String(direction || '').trim().toLowerCase()
  if (normalized === 'buy') return 'sell'
  if (normalized === 'sell') return 'buy'
  return normalized
}

function resolveDirectDealLineMetalCode(line = {}) {
  return String(line?.metal || '').trim().toUpperCase() || ''
}

function createEmptyMetalPosition() {
  return { gold: 0, silver: 0 }
}

function addSignedWeightToPosition(position, signedWeight, { stockCode = '', metalCode = '' } = {}) {
  if (!signedWeight) return position
  if (isSilverLine(stockCode, metalCode)) {
    position.silver += signedWeight
  } else {
    position.gold += signedWeight
  }
  return position
}

function listActiveVoucherFixings(tx = {}) {
  const fixings = tx?.voucherMeta?.fixings
  if (!Array.isArray(fixings)) return []
  return fixings.filter((fixing) => fixing && fixing.isDeleted !== true && Number(fixing.pureWeight || 0) > 0)
}

/** Grams already closed by fixings on an unfixed voucher, split by metal. */
function resolveVoucherFixedWeightByMetal(tx = {}) {
  const position = createEmptyMetalPosition()
  for (const fixing of listActiveVoucherFixings(tx)) {
    addSignedWeightToPosition(position, Number(fixing.pureWeight || 0), { metalCode: fixing.metalCode })
  }
  return position
}

/**
 * Adds an unfixed voucher's open grams (line grams minus fixed grams) into
 * `position` using the voucher's Dr/Cr sign, or its valuation sign when
 * `valuation` is set. Returns false when the voucher is fixed.
 */
function addOpenUnfixedVoucherWeight(position, tx = {}, { valuation = false } = {}) {
  const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
  if (!isUnfixedFixingType(fixingType)) return false
  const sign = valuation
    ? resolveUnfixedVoucherValuationSign(tx.type)
    : resolveUnfixedVoucherWeightSign(tx.type)
  if (!sign) return false
  const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  for (const line of lines) {
    const pw = Number(line?.pureWeight || 0)
    if (!Number.isFinite(pw) || pw === 0) continue
    addSignedWeightToPosition(position, sign * pw, { stockCode: line?.stockCode })
  }
  for (const fixing of listActiveVoucherFixings(tx)) {
    addSignedWeightToPosition(position, -sign * Number(fixing.pureWeight || 0), { metalCode: fixing.metalCode })
  }
  return true
}

function accumulateUnfixedMetalFromTransactions(metalTxs = [], { valuation = false } = {}) {
  const position = createEmptyMetalPosition()
  for (const tx of metalTxs) {
    addOpenUnfixedVoucherWeight(position, tx, { valuation })
  }
  return position
}

function createEmptyPartyPositionRow() {
  return { goldPosition: 0, silverPosition: 0, goldValuationPosition: 0, silverValuationPosition: 0 }
}

/**
 * Adds an unfixed voucher's open grams to a party row: Dr/Cr grams into
 * gold/silverPosition, valuation grams into gold/silverValuationPosition.
 */
function addOpenUnfixedVoucherToPartyRow(row, tx = {}) {
  const shown = createEmptyMetalPosition()
  if (!addOpenUnfixedVoucherWeight(shown, tx)) return false
  const valued = createEmptyMetalPosition()
  addOpenUnfixedVoucherWeight(valued, tx, { valuation: true })
  row.goldPosition += shown.gold
  row.silverPosition += shown.silver
  row.goldValuationPosition += valued.gold
  row.silverValuationPosition += valued.silver
  return true
}

/**
 * Adds a metal receipt/payment to a party row: Dr/Cr grams (payment +, receipt -)
 * into gold/silverPosition and the opposite into the valuation grams, since like
 * an unfixed voucher a receipt is metal the party is owed and a payment settles it.
 */
function addMetalTransferToPartyRow(row, tx = {}) {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  let added = false
  for (const line of lines) {
    const signedWeight = resolveTransferSignedPureWeight(tx.type, [line])
    if (!signedWeight) continue
    if (isSilverLine(line?.stockCode)) {
      row.silverPosition += signedWeight
      row.silverValuationPosition -= signedWeight
    } else {
      row.goldPosition += signedWeight
      row.goldValuationPosition -= signedWeight
    }
    added = true
  }
  return added
}

/** Posted metal receipts/payments for these customers, matched like Account Summary. */
function buildCustomerMetalTransferFilter(customers = []) {
  const customerIds = []
  const accountIds = []
  const accountCodes = []
  for (const customer of customers) {
    if (customer?._id) customerIds.push(customer._id)
    const account = customer?.ledgerAccountId
    if (account?._id) accountIds.push(account._id, String(account._id))
    const code = String(account?.accountCode || '').trim()
    if (code) accountCodes.push(code)
  }
  const or = []
  if (customerIds.length) or.push({ customerId: { $in: customerIds } })
  if (accountIds.length) or.push({ 'voucherMeta.partyAccountId': { $in: accountIds } })
  if (accountCodes.length) or.push({ 'voucherMeta.partyCode': { $in: accountCodes } })
  if (!or.length) return null
  return {
    isDeleted: { $ne: true },
    status: 'posted',
    type: { $in: METAL_TRANSFER_POSITION_TYPES },
    $or: or,
  }
}

function accumulateMetalTransfersIntoMap(transfers = [], customers = [], positionMap = new Map()) {
  const byCustomerId = new Map()
  const byAccountId = new Map()
  const byAccountCode = new Map()
  for (const customer of customers) {
    const customerId = String(customer?._id || '')
    if (!customerId) continue
    byCustomerId.set(customerId, customerId)
    const account = customer?.ledgerAccountId
    if (account?._id) byAccountId.set(String(account._id), customerId)
    const code = String(account?.accountCode || '').trim()
    if (code) byAccountCode.set(code, customerId)
  }
  for (const tx of transfers) {
    const customerId = byCustomerId.get(String(tx?.customerId || ''))
      || byAccountId.get(String(tx?.voucherMeta?.partyAccountId || ''))
      || byAccountCode.get(String(tx?.voucherMeta?.partyCode || '').trim())
    if (!customerId) continue
    const position = positionMap.get(customerId) || createEmptyPartyPositionRow()
    if (addMetalTransferToPartyRow(position, tx)) positionMap.set(customerId, position)
  }
  return positionMap
}

function accumulateDirectDealMetalForCustomer(directDeals = [], customerId) {
  const position = createEmptyMetalPosition()
  const targetId = String(customerId || '')
  if (!targetId) return position

  for (const deal of directDeals) {
    const lines = Array.isArray(deal?.lineItems) ? deal.lineItems : []
    for (const line of lines) {
      if (String(line?.customerId || '') !== targetId) continue
      const signedWeight = resolveDirectDealLineSignedWeight(line)
      addSignedWeightToPosition(position, signedWeight, {
        stockCode: line?.stockCode,
        metalCode: resolveDirectDealLineMetalCode(line),
      })
    }
  }
  return position
}

function accumulateDirectDealMetalIntoMap(directDeals = [], positionMap = new Map()) {
  for (const deal of directDeals) {
    const lines = Array.isArray(deal?.lineItems) ? deal.lineItems : []
    for (const line of lines) {
      const customerId = String(line?.customerId || '')
      if (!customerId) continue
      const signedWeight = resolveDirectDealLineSignedWeight(line)
      if (!signedWeight) continue
      const position = positionMap.get(customerId) || createEmptyPartyPositionRow()
      if (isSilverLine(line?.stockCode, resolveDirectDealLineMetalCode(line))) {
        position.silverPosition += signedWeight
        position.silverValuationPosition = Number(position.silverValuationPosition || 0) + signedWeight
      } else {
        position.goldPosition += signedWeight
        position.goldValuationPosition = Number(position.goldValuationPosition || 0) + signedWeight
      }
      positionMap.set(customerId, position)
    }
  }
  return positionMap
}

function mergeMetalPositions(...parts) {
  return parts.reduce((acc, part) => {
    acc.gold += Number(part?.gold ?? part?.goldBalance ?? part?.goldPosition ?? 0)
    acc.silver += Number(part?.silver ?? part?.silverBalance ?? part?.silverPosition ?? 0)
    return acc
  }, createEmptyMetalPosition())
}

function toMetalBalancePair(position = {}) {
  return {
    goldBalance: roundMetalPosition(position.gold ?? position.goldBalance ?? position.goldPosition ?? 0),
    silverBalance: roundMetalPosition(position.silver ?? position.silverBalance ?? position.silverPosition ?? 0),
  }
}

module.exports = {
  OZ_TO_GRAM,
  isUnfixedFixingType,
  roundMetalPosition,
  resolveDirectDealLineWeightGram,
  resolveDirectDealLineSignedWeight,
  resolveDirectDealLineMetalCode,
  resolveUnfixedVoucherWeightSign,
  resolveUnfixedVoucherValuationSign,
  resolveDirectDealCompanyDirection,
  createEmptyMetalPosition,
  createEmptyPartyPositionRow,
  addSignedWeightToPosition,
  listActiveVoucherFixings,
  resolveVoucherFixedWeightByMetal,
  addOpenUnfixedVoucherWeight,
  addOpenUnfixedVoucherToPartyRow,
  addMetalTransferToPartyRow,
  buildCustomerMetalTransferFilter,
  accumulateMetalTransfersIntoMap,
  accumulateUnfixedMetalFromTransactions,
  accumulateDirectDealMetalForCustomer,
  accumulateDirectDealMetalIntoMap,
  mergeMetalPositions,
  toMetalBalancePair,
}
