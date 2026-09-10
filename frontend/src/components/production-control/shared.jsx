/** Shared presentation helpers for Production Control Center */

export const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'live', label: 'Live Floor' },
  { id: 'batches', label: 'Batches' },
  { id: 'movements', label: 'Metal Movement' },
  { id: 'passes', label: 'Passes & Handovers' },
  { id: 'processes', label: 'Processes' },
  { id: 'qc', label: 'Quality Control' },
  { id: 'machines', label: 'Machines' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'audit', label: 'Audit Log' },
]

export function formatGrams(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
}

export function formatKg(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} KG`
}

export function formatTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

export function statusTone(status) {
  const s = String(status || '').toUpperCase()
  if (['RUNNING', 'RECEIVED', 'COMPLETED', 'PASS', 'ISSUED', 'APPROVED'].includes(s)) return 'ok'
  if (['HOLD', 'FAULT', 'FAIL', 'CANCELLED', 'CRITICAL'].includes(s)) return 'bad'
  if (['WAITING', 'QC', 'REWORK', 'IN_TRANSIT', 'REQUESTED', 'MAINTENANCE'].includes(s)) return 'warn'
  return 'muted'
}

export function EmptyState({ message }) {
  return (
    <div className="pcc-empty">
      {message || 'No records'}
    </div>
  )
}

export function KpiTile({ label, value }) {
  return (
    <div className="pcc-kpi">
      <div className="pcc-kpi-value">{value}</div>
      <div className="pcc-kpi-label">{label}</div>
    </div>
  )
}

export function StatusPill({ status }) {
  const tone = statusTone(status)
  return <span className={`pcc-pill pcc-pill-${tone}`}>{status || '—'}</span>
}
