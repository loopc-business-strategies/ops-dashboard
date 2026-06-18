/**
 * Shared metal position accumulation for account enquiry, customer margin, and dashboard.
 * Position = unfixed sale/purchase + metal transfers (caller) + confirmed direct deals.
 */

const OZ_TO_GRAM = 31.1034768

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
  // buy  => company sold metal to customer => metal credit (negative sign)
  // sell => company bought metal from customer => metal debit (positive sign)
  return direction === 'buy' ? -grams : grams
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

function accumulateUnfixedMetalFromTransactions(metalTxs = []) {
  const position = createEmptyMetalPosition()
  for (const tx of metalTxs) {
    const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
    if (!isUnfixedFixingType(fixingType)) continue
    const sign = tx.type === 'purchase' ? 1 : -1
    const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    for (const line of lines) {
      const pw = Number(line.pureWeight || 0)
      if (pw === 0) continue
      addSignedWeightToPosition(position, sign * pw, { stockCode: line?.stockCode })
    }
  }
  return position
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
      const position = positionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
      if (isSilverLine(line?.stockCode, resolveDirectDealLineMetalCode(line))) {
        position.silverPosition += signedWeight
      } else {
        position.goldPosition += signedWeight
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
  createEmptyMetalPosition,
  addSignedWeightToPosition,
  accumulateUnfixedMetalFromTransactions,
  accumulateDirectDealMetalForCustomer,
  accumulateDirectDealMetalIntoMap,
  mergeMetalPositions,
  toMetalBalancePair,
}
