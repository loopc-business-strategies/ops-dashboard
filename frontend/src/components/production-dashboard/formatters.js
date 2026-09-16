import { formatGrams, formatMinutes, formatClock } from '../production-control/shared'
import { numOrNull } from './safeMath'

export { formatGrams, formatMinutes, formatClock }

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

export function pccHref(section, extra = {}) {
  const params = new URLSearchParams()
  if (section) params.set('section', section)
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, String(v))
  })
  const q = params.toString()
  return q ? `/production?${q}` : '/production'
}
