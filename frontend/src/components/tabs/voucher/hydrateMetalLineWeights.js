import { resolveVoucherLinePurityFromProduct } from './voucherLinePurity'

const TROY_OZ_GRAMS = 31.1034768

function parsePositive(value) {
  const n = Number.parseFloat(String(value ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

function normalizePurityRatio(purityValue) {
  if (!(purityValue > 0)) return 0
  return purityValue > 1.2 ? purityValue / 1000 : purityValue
}

function pureWeightFromMetalAmount(line, gross) {
  const metalAmount = parsePositive(line.metalAmount)
  const metalRate = parsePositive(line.metalRate)
  if (!(metalAmount > 0) || !(metalRate > 0) || !(gross > 0)) return 0

  const rateType = String(line.rateType || 'OZ').trim().toUpperCase()
  if (rateType === 'GRAM') return metalAmount / metalRate
  if (rateType === 'KG') return (metalAmount / metalRate) * 1000
  return (metalAmount / metalRate) * TROY_OZ_GRAMS
}

/**
 * Fill missing purity / pureWeight on a saved metal line for display and re-save.
 * Prefer product karat / catalog purity; fall back to reversing metalAmount × rate.
 * Does not overwrite existing positive purity or pureWeight.
 */
export function hydrateMetalLineWeights(line = {}) {
  const gross = parsePositive(line.grossWeight)
  const existingPurityRatio = normalizePurityRatio(parsePositive(line.purity))
  const existingPure = parsePositive(line.pureWeight)

  let purityRatio = existingPurityRatio
  if (!(purityRatio > 0)) {
    const inferred = resolveVoucherLinePurityFromProduct({
      productName: line.productType || '',
      productPurity: line.purity || '',
    })
    purityRatio = normalizePurityRatio(parsePositive(inferred))
  }

  if (!(purityRatio > 0) && !(existingPure > 0)) {
    const pureFromAmount = pureWeightFromMetalAmount(line, gross)
    if (pureFromAmount > 0 && gross > 0) {
      purityRatio = pureFromAmount / gross
    }
  }

  const pureWeight = existingPure > 0
    ? existingPure
    : (gross > 0 && purityRatio > 0 ? Number((gross * purityRatio).toFixed(3)) : 0)

  if (!(purityRatio > 0) && !(pureWeight > 0)) return line

  return {
    ...line,
    purity: purityRatio > 0 ? String(Number(purityRatio.toFixed(6))) : line.purity,
    pureWeight: pureWeight > 0 ? String(Number(pureWeight.toFixed(3))) : line.pureWeight,
  }
}
