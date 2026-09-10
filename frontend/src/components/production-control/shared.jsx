/** Shared production-control constants and helpers */

export const SECTIONS = [
  { id: 'live', label: 'Live Floor' },
  { id: 'overview', label: 'Overview' },
  { id: 'work-orders', label: 'Work Orders' },
  { id: 'batches', label: 'Batches' },
  { id: 'movements', label: 'Material / Movements' },
  { id: 'passes', label: 'Passes' },
  { id: 'processes', label: 'Processes' },
  { id: 'qc', label: 'QC' },
  { id: 'machines', label: 'Machines' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'audit', label: 'Audit' },
]

export const BOARD_COLUMNS = [
  { id: 'QUEUED', label: 'QUEUED', statuses: ['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'WAITING'] },
  { id: 'IN_PROGRESS', label: 'IN PROGRESS', statuses: ['IN_TRANSIT', 'RECEIVED', 'IN_PROCESS'] },
  { id: 'QC', label: 'QC', statuses: ['QC'] },
  { id: 'REWORK', label: 'REWORK', statuses: ['REWORK'] },
  { id: 'HOLD', label: 'HOLD', statuses: ['HOLD'] },
  { id: 'COMPLETED', label: 'COMPLETED', statuses: ['COMPLETED', 'RETURNED_TO_VAULT'] },
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
  if (['RUNNING', 'RECEIVED', 'COMPLETED', 'PASS', 'ISSUED', 'APPROVED', 'RETURNED_TO_VAULT'].includes(s)) return 'ok'
  if (['HOLD', 'FAULT', 'FAIL', 'CANCELLED', 'CRITICAL', 'ERROR', 'OFFLINE'].includes(s)) return 'bad'
  if (['WAITING', 'QC', 'REWORK', 'IN_TRANSIT', 'REQUESTED', 'MAINTENANCE', 'PENDING', 'AWAITING_ISSUE'].includes(s)) return 'warn'
  if (['IN_PROCESS', 'ACTIVE', 'OPEN'].includes(s)) return 'active'
  return 'muted'
}

export function boardColumnForStatus(status) {
  const s = String(status || '').toUpperCase()
  const col = BOARD_COLUMNS.find((c) => c.statuses.includes(s))
  return col?.id || 'QUEUED'
}

/** @deprecated prefer PccEmptyState / PccStatusBadge / PccKpiCard */
export function EmptyState({ message }) {
  return <div className="pcc-empty">{message || 'No records'}</div>
}

/** @deprecated prefer PccKpiCard */
export function KpiTile({ label, value }) {
  return (
    <div className="pcc-kpi">
      <div className="pcc-kpi-value">{value}</div>
      <div className="pcc-kpi-label">{label}</div>
    </div>
  )
}

/** @deprecated prefer PccStatusBadge */
export function StatusPill({ status }) {
  const tone = statusTone(status)
  return <span className={`pcc-pill pcc-pill-${tone}`}>{status || '—'}</span>
}
