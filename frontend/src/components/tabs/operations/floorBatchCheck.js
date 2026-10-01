/** A pending batch waiting longer than this is highlighted for the Floor Manager. */
export const OLD_PENDING_MINUTES = 60

const round = (value, places) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

const positive = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Compares a Metal Out batch's totals with its Metal In totals (both from the batch list API,
 * { weight, fineGold }). Null when the Metal In has no weight. Same rules as the tablet popup.
 */
export function compareMetalOut(inTotals, outTotals, lossLimitPct) {
  const inWeight = positive(inTotals?.weight)
  if (inWeight == null) return null
  const outWeight = positive(outTotals?.weight)
  const loss = outWeight == null ? null : round(inWeight - outWeight, 3)
  const lossPct = loss == null ? null : round((loss / inWeight) * 100, 2)
  const fineIn = positive(inTotals?.fineGold)
  const fineOut = positive(outTotals?.fineGold)
  const limit = Number.isFinite(Number(lossLimitPct)) && lossLimitPct != null ? Number(lossLimitPct) : null
  return {
    inWeight,
    outWeight,
    loss,
    lossPct,
    overLimit: lossPct != null && limit != null && lossPct > limit,
    outMoreThanIn: loss != null && loss < 0,
    fineIn,
    fineOut,
    purityTooHigh: fineIn != null && fineOut != null && fineOut - fineIn > 0.0005,
    maxPurity: fineIn != null && outWeight ? Math.min(100, Math.floor((fineIn / outWeight) * 10000) / 100) : null,
  }
}

/** Minutes since the batch was sent, or null for a bad date. */
export function minutesWaiting(submittedAt, now = Date.now()) {
  const t = new Date(submittedAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((now - t) / 60000))
}

/** Minutes left to undo an approval, or null once the window has passed. */
export function undoMinutesLeft(entry, windowHours, now = Date.now()) {
  if (entry?.status !== 'APPROVED' || !windowHours) return null
  const decided = new Date(entry.decidedAt).getTime()
  if (!Number.isFinite(decided)) return null
  const left = Math.floor((decided + windowHours * 3600000 - now) / 60000)
  return left > 0 ? left : null
}

/** 95 -> "1h 35m", 20 -> "20m". */
export function formatWait(minutes) {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export const formatGrams = (value) => (value == null ? '—' : `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 })} g`)
