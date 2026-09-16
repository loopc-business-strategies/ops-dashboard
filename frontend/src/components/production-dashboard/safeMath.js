/** Safe numeric helpers — never return NaN/Infinity for display math. */

export function numOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function metalLoss(metalIn, metalOut) {
  const inn = numOrNull(metalIn)
  const out = numOrNull(metalOut)
  if (inn == null || out == null) return null
  return inn - out
}

export function lossPercent(metalIn, metalOut) {
  const inn = numOrNull(metalIn)
  const loss = metalLoss(metalIn, metalOut)
  if (inn == null || inn === 0 || loss == null) return null
  const pct = (loss / inn) * 100
  return Number.isFinite(pct) ? pct : null
}

export function completionPercent(completed, target) {
  const c = numOrNull(completed)
  const t = numOrNull(target)
  if (c == null || t == null || t <= 0) return null
  const pct = (c / t) * 100
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null
}

export function percentChange(current, previous) {
  const cur = numOrNull(current)
  const prev = numOrNull(previous)
  if (cur == null || prev == null) return null
  if (prev === 0) {
    if (cur === 0) return 0
    return null
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  return Number.isFinite(pct) ? pct : null
}

export function shiftProgressPercent(elapsedMin, remainingMin) {
  const e = numOrNull(elapsedMin)
  const r = numOrNull(remainingMin)
  if (e == null || r == null) return null
  const total = e + r
  if (total <= 0) return null
  const pct = (e / total) * 100
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null
}

export function elapsedMinutes(start, end = new Date()) {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return null
  const ms = e - s
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

export function dayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
