const GRAMS_PER_TROY_OUNCE = 31.1034768

export const DIRECT_DEAL_PRICE_WARN_RATIO = 0.1

export function resolveSpotPricePerOz(snapshot, metal) {
  const key = String(metal || 'XAU').trim().toUpperCase() === 'XAG' ? 'silver' : 'gold'
  const price = Number(snapshot?.[key] || 0)
  if (!Number.isFinite(price) || price <= 0) return 0
  return String(snapshot?.unit || 'TOZ').trim().toUpperCase() === 'G' ? price * GRAMS_PER_TROY_OUNCE : price
}

/**
 * Compare a deal line's per-oz price with live spot. Returns null when there is
 * nothing to compare (no price, no spot, or the deal is not in the spot currency)
 * or when the price is within DIRECT_DEAL_PRICE_WARN_RATIO of spot.
 */
export function checkDirectDealPriceAgainstSpot({ price, metal, currency, snapshot }) {
  const entered = Number(price || 0)
  if (!Number.isFinite(entered) || entered <= 0) return null
  const spotCurrency = String(snapshot?.currency || 'USD').trim().toUpperCase()
  if (spotCurrency !== String(currency || '').trim().toUpperCase()) return null
  const spot = resolveSpotPricePerOz(snapshot, metal)
  if (spot <= 0) return null
  const deviation = (entered - spot) / spot
  if (Math.abs(deviation) < DIRECT_DEAL_PRICE_WARN_RATIO) return null
  return { spot, deviation }
}

export function describeDirectDealPriceDeviation({ spot, deviation }, formatPrice = (v) => String(v)) {
  const pct = Math.round(Math.abs(deviation) * 100)
  return `${pct}% ${deviation < 0 ? 'below' : 'above'} live ${formatPrice(spot)} / oz`
}
