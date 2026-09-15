/** Shared production-control constants and helpers */

export const SECTION_GROUPS = [
  {
    id: 'primary',
    label: 'PRIMARY',
    sections: [
      { id: 'live', label: 'Live Floor' },
      { id: 'overview', label: 'Overview' },
      { id: 'work-orders', label: 'Work Orders' },
      { id: 'batches', label: 'Batches' },
      { id: 'processes', label: 'Processes' },
      { id: 'qc', label: 'QC' },
    ],
  },
  {
    id: 'stock',
    label: 'STOCK',
    sections: [
      { id: 'stock-overview', label: 'Stock Overview' },
      { id: 'stock-in', label: 'New Stock In' },
      { id: 'stock-selection', label: 'Stock Selection' },
      { id: 'stock-processing', label: 'Under Processing' },
      { id: 'stock-finished', label: 'Finished Stock' },
      { id: 'stock-history', label: 'Stock History' },
      { id: 'stock-adjustments', label: 'Stock Adjustments' },
    ],
  },
  {
    id: 'departments',
    label: 'DEPARTMENTS',
    sections: [
      { id: 'dept-melting', label: 'Melting', deptKey: 'melting' },
      { id: 'dept-casting', label: 'Casting', deptKey: 'casting' },
      { id: 'dept-rolling', label: 'Rolling', deptKey: 'rolling' },
      { id: 'dept-bangle_division', label: 'Bangle Division', deptKey: 'bangle_division' },
      { id: 'dept-stamping', label: 'Stamping', deptKey: 'stamping' },
      { id: 'dept-polishing', label: 'Polishing', deptKey: 'polishing' },
      { id: 'dept-quality_control', label: 'Quality Control', deptKey: 'quality_control' },
      { id: 'dept-packing', label: 'Packaging', deptKey: 'packing' },
    ],
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    sections: [
      { id: 'movements', label: 'Material / Movements' },
      { id: 'passes', label: 'Passes' },
      { id: 'machines', label: 'Machines' },
    ],
  },
  {
    id: 'floor',
    label: 'FLOOR',
    sections: [
      { id: 'floor-manager', label: 'Floor Manager' },
      { id: 'floor-attendance', label: 'FM Attendance' },
    ],
  },
  {
    id: 'control',
    label: 'CONTROL',
    sections: [
      { id: 'alerts', label: 'Alerts' },
      { id: 'audit', label: 'Audit' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ],
  },
]

export const SECTIONS = SECTION_GROUPS.flatMap((g) => g.sections)

export const SECTION_IDS = new Set(SECTIONS.map((s) => s.id))

export const DEPT_SECTION_MAP = Object.fromEntries(
  SECTIONS.filter((s) => s.deptKey).map((s) => [s.id, s.deptKey]),
)

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

export function formatMinutes(mins) {
  const n = Number(mins)
  if (!Number.isFinite(n)) return '—'
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export function statusTone(status) {
  const s = String(status || '').toUpperCase()
  if (['RUNNING', 'RECEIVED', 'COMPLETED', 'PASS', 'ISSUED', 'APPROVED', 'RETURNED_TO_VAULT', 'AVAILABLE', 'FINISHED', 'QC_PASSED', 'OK'].includes(s)) return 'ok'
  if (['HOLD', 'FAULT', 'FAIL', 'CANCELLED', 'CRITICAL', 'ERROR', 'OFFLINE', 'QC_FAILED', 'DELAYED'].includes(s)) return 'bad'
  if (['WAITING', 'QC', 'REWORK', 'IN_TRANSIT', 'REQUESTED', 'MAINTENANCE', 'PENDING', 'AWAITING_ISSUE', 'NEW_STOCK', 'SELECTED', 'PACKAGING', 'QC_PENDING'].includes(s)) return 'warn'
  if (['IN_PROCESS', 'ACTIVE', 'OPEN', 'IN_PROGRESS', 'UNDER_PROCESSING', 'DEPARTMENT_PROCESSING', 'ALLOCATED'].includes(s)) return 'active'
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
