const GRAMS_PER_TROY_OUNCE = 31.1034768
const FIXING_WEIGHT_EPSILON = 0.0005

export const VOUCHER_FIXING_RATE_TYPES = ['OZ', 'GRAM', 'KG']

const isUnfixedFixingType = (value) => ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix']
  .includes(String(value || '').trim().toLowerCase())

function resolveLinePureWeight(line = {}) {
  const explicit = Number(line?.pureWeight || 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const gross = Number(line?.grossWeight || 0)
  const purity = Number(line?.purity || 0)
  const purityRatio = purity > 1.2 ? purity / 1000 : purity
  const derived = gross * purityRatio
  return Number.isFinite(derived) && derived > 0 ? derived : 0
}

export function normalizeVoucherFixingRateType(value) {
  const normalized = String(value || 'OZ').trim().toUpperCase()
  if (normalized === 'G' || normalized === 'GM' || normalized === 'GRAMS') return 'GRAM'
  return VOUCHER_FIXING_RATE_TYPES.includes(normalized) ? normalized : 'OZ'
}

export function resolveVoucherFixingRateQuantity(pureWeight, rateType) {
  const grams = Number(pureWeight || 0)
  const type = normalizeVoucherFixingRateType(rateType)
  if (type === 'GRAM') return grams
  if (type === 'KG') return grams / 1000
  return grams / GRAMS_PER_TROY_OUNCE
}

/** Converts a rate quoted per `rateType` unit to a per-troy-ounce rate. */
export function toPerOunceRate(rate, rateType) {
  const value = Number(rate || 0)
  const type = normalizeVoucherFixingRateType(rateType)
  if (type === 'GRAM') return value * GRAMS_PER_TROY_OUNCE
  if (type === 'KG') return (value / 1000) * GRAMS_PER_TROY_OUNCE
  return value
}

export function fromPerOunceRate(ratePerOz, rateType) {
  const value = Number(ratePerOz || 0)
  const type = normalizeVoucherFixingRateType(rateType)
  if (type === 'GRAM') return value / GRAMS_PER_TROY_OUNCE
  if (type === 'KG') return (value / GRAMS_PER_TROY_OUNCE) * 1000
  return value
}

export function computeVoucherFixingAmount({ pureWeight, rate, rateType }) {
  const value = resolveVoucherFixingRateQuantity(pureWeight, rateType) * Number(rate || 0)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export function summarizeVoucherFixing(voucher = {}) {
  const meta = voucher?.voucherMeta || {}
  const lines = Array.isArray(meta.lineItems) ? meta.lineItems : []
  const metals = new Set()
  let totalWeight = 0
  lines.forEach((line) => {
    const grams = resolveLinePureWeight(line)
    if (grams <= 0) return
    totalWeight += grams
    const stockCode = String(line?.stockCode || '').toUpperCase()
    metals.add(stockCode.includes('XAG') || stockCode.includes('SILV') ? 'XAG' : 'XAU')
  })
  const fixings = (Array.isArray(meta.fixings) ? meta.fixings : [])
    .filter((fixing) => fixing && fixing.isDeleted !== true && Number(fixing.pureWeight || 0) > 0)
  const fixedWeight = fixings.reduce((sum, fixing) => sum + Number(fixing.pureWeight || 0), 0)
  const rawOpen = Math.max(totalWeight - fixedWeight, 0)
  const pricedLine = lines.find((line) => resolveLinePureWeight(line) > 0) || lines[0] || {}
  const isUnfixed = isUnfixedFixingType(meta.fixingType)
  const openWeight = rawOpen < FIXING_WEIGHT_EPSILON ? 0 : Number(rawOpen.toFixed(6))
  return {
    isUnfixed,
    totalWeight: Number(totalWeight.toFixed(6)),
    fixedWeight: Number(fixedWeight.toFixed(6)),
    openWeight,
    metalCode: metals.size === 1 ? Array.from(metals)[0] : '',
    mixedMetals: metals.size > 1,
    rateType: normalizeVoucherFixingRateType(pricedLine.rateType),
    fixings,
    allFixings: Array.isArray(meta.fixings) ? meta.fixings : [],
  }
}

/** List badge: Fixed, Unfixed, Part fixed, or Fixed later (all grams closed by fixings). */
export function resolveVoucherFixingBadge(voucher = {}) {
  const state = summarizeVoucherFixing(voucher)
  if (!state.isUnfixed) return { label: 'Fixed', tone: 'fixed' }
  if (state.fixedWeight <= 0) return { label: 'Unfixed', tone: 'unfixed' }
  if (state.openWeight <= 0) return { label: 'Fixed later', tone: 'fixed' }
  return { label: `Part fixed (${state.openWeight.toFixed(2)} g open)`, tone: 'partial' }
}

export function canFixVoucher(voucher = {}) {
  const type = String(voucher?.type || '').toLowerCase()
  if (type !== 'sale' && type !== 'purchase') return false
  if (voucher?.status !== 'posted') return false
  const state = summarizeVoucherFixing(voucher)
  return state.isUnfixed && !state.mixedMetals && state.openWeight > 0
}
