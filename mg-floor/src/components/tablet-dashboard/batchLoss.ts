type LineLike = { qty: number | string | null; purity: number | string | null }

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null
  const text = String(value).trim().replace(',', '.')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const round = (value: number, places: number) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

/** Purity may be typed as % (99.5) or per-mille (995); same rule as the workbook. */
export function purityPercent(value: number | string | null | undefined) {
  const p = toNumber(value)
  if (p == null || p <= 0) return null
  return p > 100 ? p / 10 : p
}

export type BatchTotals = { weight: number | null; fineGold: number | null }

/**
 * Total weight of the lines, plus fine gold from the lines that carry a purity (alloy adds weight
 * only) — the same totals the Operations → Production workbook stores.
 */
export function batchTotals(lines: LineLike[]): BatchTotals {
  let weight = 0
  let fine = 0
  let hasPurity = false
  for (const line of lines) {
    const qty = toNumber(line.qty)
    if (qty == null || qty <= 0) continue
    weight += qty
    const pct = purityPercent(line.purity)
    if (pct != null) {
      hasPurity = true
      fine += (qty * pct) / 100
    }
  }
  if (weight <= 0) return { weight: null, fineGold: null }
  return { weight: round(weight, 3), fineGold: hasPurity ? round(fine, 3) : null }
}

export type MetalOutCheck = {
  inWeight: number
  outWeight: number | null
  /** Metal In − Metal Out; negative when more came out than went in. */
  loss: number | null
  lossPct: number | null
  overLimit: boolean
  outMoreThanIn: boolean
  fineIn: number | null
  fineOut: number | null
  purityTooHigh: boolean
  /** Highest Metal Out purity (%) that keeps fine gold out at or below fine gold in. */
  maxPurity: number | null
}

/** Compares a Metal Out with its batch's Metal In; null when the Metal In has no weight. */
export function checkMetalOut(inLines: LineLike[], outLines: LineLike[], lossLimitPct: number | null): MetalOutCheck | null {
  const metalIn = batchTotals(inLines)
  if (metalIn.weight == null) return null
  const metalOut = batchTotals(outLines)
  const loss = metalOut.weight == null ? null : round(metalIn.weight - metalOut.weight, 3)
  const lossPct = loss == null ? null : round((loss / metalIn.weight) * 100, 2)
  const fineGap = metalIn.fineGold != null && metalOut.fineGold != null ? metalOut.fineGold - metalIn.fineGold : null
  const maxPurity = metalIn.fineGold != null && metalOut.weight
    ? Math.min(100, Math.floor((metalIn.fineGold / metalOut.weight) * 10000) / 100)
    : null
  return {
    inWeight: metalIn.weight,
    outWeight: metalOut.weight,
    loss,
    lossPct,
    overLimit: lossPct != null && lossLimitPct != null && lossPct > lossLimitPct,
    outMoreThanIn: loss != null && loss < 0,
    fineIn: metalIn.fineGold,
    fineOut: metalOut.fineGold,
    purityTooHigh: fineGap != null && fineGap > 0.0005,
    maxPurity,
  }
}
