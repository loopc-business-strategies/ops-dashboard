const METAL_STOCK_IN_TYPES = ['purchase', 'metal_receipt']
const METAL_STOCK_OUT_TYPES = ['sale', 'metal_payment']
const METAL_STOCK_TYPES = [...METAL_STOCK_IN_TYPES, ...METAL_STOCK_OUT_TYPES]
const METAL_TRANSFER_TYPES = ['metal_receipt', 'metal_payment']

const isMetalStockInType = (type) => METAL_STOCK_IN_TYPES.includes(String(type || '').toLowerCase())
const isMetalStockOutType = (type) => METAL_STOCK_OUT_TYPES.includes(String(type || '').toLowerCase())
const isMetalStockType = (type) => METAL_STOCK_TYPES.includes(String(type || '').toLowerCase())
const isMetalTransferType = (type) => METAL_TRANSFER_TYPES.includes(String(type || '').toLowerCase())

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Human-readable voucher kind for stock movement reason text. */
const stockMovementReferenceType = (type) => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'metal_receipt') return 'metal receipt'
  if (normalized === 'metal_payment') return 'metal payment'
  return isMetalStockInType(normalized) ? 'purchase' : 'sale'
}

/** Build StockMovement.reason for a posted metal voucher. */
const buildStockMovementReason = (tx, type) => {
  const transactionType = String(type || tx?.type || '').toLowerCase()
  const kind = stockMovementReferenceType(transactionType)
  const vocSuffix = tx?.voucherMeta?.vocNo ? ` #${tx.voucherMeta.vocNo}` : ''

  if (isMetalTransferType(transactionType)) {
    return `Voucher ${kind}${vocSuffix}`
  }

  const fixingType = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || 'fixed').toLowerCase()
  const isUnfixed = ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(fixingType)
  const fixLabel = isUnfixed ? 'UNFIXED' : 'FIXED'
  return `Voucher ${kind} (${fixLabel})${vocSuffix}`
}

/** Match stock movements for void/reversal (supports legacy purchase/sale labels). */
const stockMovementReasonPattern = (type, vocNo) => {
  const normalized = String(type || '').toLowerCase()
  const escapedVoc = escapeRegExp(String(vocNo || '').trim())
  let kindAlternatives
  if (normalized === 'metal_receipt') {
    kindAlternatives = '(?:metal\\s+receipt|purchase)'
  } else if (normalized === 'metal_payment') {
    kindAlternatives = '(?:metal\\s+payment|sale)'
  } else {
    kindAlternatives = escapeRegExp(stockMovementReferenceType(normalized))
  }
  return new RegExp(
    `Voucher\\s+${kindAlternatives}\\s*(?:\\([^)]*\\))?\\s*#\\s*${escapedVoc}(?:\\s|$)`,
    'i',
  )
}

const linePureWeight = (line = {}) => {
  const explicitPureWeight = Number(line?.pureWeight || 0)
  const grossWeight = Number(line?.grossWeight || 0)
  const purityValue = Number(line?.purity || 0)
  const purityRatio = purityValue > 1.2 ? (purityValue / 1000) : purityValue
  const derivedPureWeight = grossWeight > 0 && purityRatio > 0 ? (grossWeight * purityRatio) : 0
  const pw = explicitPureWeight > 0 ? explicitPureWeight : derivedPureWeight
  return Number.isFinite(pw) && pw > 0 ? pw : 0
}

const sumVoucherLinePureWeight = (lines = []) => {
  const arr = Array.isArray(lines) ? lines : []
  return arr.reduce((sum, line) => sum + linePureWeight(line), 0)
}

const resolveTransferSignedPureWeight = (txType, lines = []) => {
  const type = String(txType || '').toLowerCase()
  const gross = sumVoucherLinePureWeight(lines)
  if (!gross) return 0
  if (type === 'metal_receipt') return -gross
  if (type === 'metal_payment') return gross
  return 0
}

module.exports = {
  METAL_STOCK_IN_TYPES,
  METAL_STOCK_OUT_TYPES,
  METAL_STOCK_TYPES,
  METAL_TRANSFER_TYPES,
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  isMetalTransferType,
  stockMovementReferenceType,
  buildStockMovementReason,
  stockMovementReasonPattern,
  sumVoucherLinePureWeight,
  resolveTransferSignedPureWeight,
}
