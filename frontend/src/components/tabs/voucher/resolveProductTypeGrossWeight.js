/**
 * Resolve gross weight when a catalog product is applied to a metal line.
 * - PCS > 0 + unit weight → unitWeight × pcs (intentional piece count)
 * - Else keep existing line gross (do not wipe saved weights on edit open)
 * - Else fall back to catalog unit weight (new empty line)
 */
export function resolveProductTypeGrossWeight({ unitWeight = 0, pcs = 0, existingGrossWeight = 0 } = {}) {
  const unit = Number(unitWeight) || 0
  const pieceCount = Math.max(0, Number(pcs) || 0)
  const existing = Number(existingGrossWeight) || 0

  if (unit > 0 && pieceCount > 0) return unit * pieceCount
  if (existing > 0) return existing
  if (unit > 0) return unit
  return 0
}
