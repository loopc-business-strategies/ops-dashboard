/**
 * Pure-conserving Metal Transfer weight helpers (Option A).
 */

export function purityToRatio(purity) {
  const value = Number(purity || 0)
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 1.2 ? value / 1000 : value
}

export function computePureWeight(grossWeight, purity) {
  const gross = Number(grossWeight || 0)
  const ratio = purityToRatio(purity)
  if (!(gross > 0) || !(ratio > 0)) return 0
  return Number((gross * ratio).toFixed(3))
}

/** To gross = From pure / To purity (conserves pure metal). */
export function computeConservedToGross(fromGrossWeight, fromPurity, toPurity) {
  const pure = computePureWeight(fromGrossWeight, fromPurity)
  const toRatio = purityToRatio(toPurity)
  if (!(pure > 0) || !(toRatio > 0)) return 0
  return Number((pure / toRatio).toFixed(3))
}

export function emptyMetalTransferSide(side = 'from') {
  return {
    transferSide: side,
    inventoryItemId: '',
    stockCode: '',
    productType: '',
    pcs: '',
    grossWeight: '',
    purity: '',
    pureWeight: '',
    narration: '',
    type: 'Cash',
    currCode: 'USD',
    currRate: '',
    amountFC: '',
    amountLC: '',
    amountWithVAT: '',
  }
}

export function emptyMetalTransferLines() {
  return [emptyMetalTransferSide('from'), emptyMetalTransferSide('to')]
}

export function getTransferSideLine(lineItems = [], side) {
  const list = Array.isArray(lineItems) ? lineItems : []
  const match = list.find((line) => String(line?.transferSide || '').toLowerCase() === side)
  if (match) return match
  return emptyMetalTransferSide(side)
}

export function upsertTransferSideLine(lineItems = [], side, patch) {
  const list = Array.isArray(lineItems) ? [...lineItems] : []
  const idx = list.findIndex((line) => String(line?.transferSide || '').toLowerCase() === side)
  const next = {
    ...(idx >= 0 ? list[idx] : emptyMetalTransferSide(side)),
    ...patch,
    transferSide: side,
  }
  if (idx >= 0) {
    list[idx] = next
    return list
  }
  return side === 'from' ? [next, ...list] : [...list, next]
}
