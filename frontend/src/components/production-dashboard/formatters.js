import { numOrNull } from './safeMath'

export function formatGrams(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
}

/** Clock time HH:MM for connection / last-update chrome. */
export function formatClock(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return '—'
  }
}

export function formatMinutes(mins) {
  const n = Number(mins)
  if (!Number.isFinite(n)) return '—'
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export function formatDateLong(d = new Date()) {
  try {
    return new Date(d).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function formatShiftClock(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—'
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function formatPct(value, digits = 0) {
  const n = numOrNull(value)
  if (n == null) return '—'
  return `${n.toFixed(digits)}%`
}

export function formatDelta(pct) {
  const n = numOrNull(pct)
  if (n == null) return { label: 'No comparison data', tone: 'muted' }
  if (Math.abs(n) < 0.05) return { label: '— No change', tone: 'muted' }
  if (n > 0) return { label: `↑ ${n.toFixed(0)}%`, tone: 'up' }
  return { label: `↓ ${Math.abs(n).toFixed(0)}%`, tone: 'down' }
}

export function formatEmployeeRange(codes) {
  const list = (codes || []).filter(Boolean)
  if (!list.length) return 'Employee not assigned'
  if (list.length === 1) return list[0]
  return `${list[0]} — ${list[list.length - 1]}`
}
