/** Shared production-control constants and helpers */

export const SECTION_GROUPS = [
  {
    id: 'command',
    label: 'COMMAND',
    sections: [
      { id: 'live', label: 'Live Floor' },
      { id: 'overview', label: 'Production Overview' },
      { id: 'my-tasks', label: 'My Tasks' },
      { id: 'alerts', label: 'Alerts' },
      { id: 'delay-monitor', label: 'Delays' },
    ],
  },
  {
    id: 'production',
    label: 'PRODUCTION',
    sections: [
      { id: 'work-orders', label: 'Work Orders' },
      { id: 'planning', label: 'Planning' },
      { id: 'batches', label: 'Batches' },
      { id: 'processes', label: 'Processes' },
      { id: 'dept-flow', label: 'Department Flow' },
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
    id: 'material',
    label: 'MATERIAL',
    sections: [
      { id: 'stock-overview', label: 'Stock Overview' },
      { id: 'stock-in', label: 'New Stock In' },
      { id: 'stock-selection', label: 'Stock Selection' },
      { id: 'stock-processing', label: 'Under Processing' },
      { id: 'stock-finished', label: 'Finished Stock' },
      { id: 'stock-history', label: 'Stock History' },
      { id: 'stock-adjustments', label: 'Stock Adjustments' },
      { id: 'movements', label: 'Metal Movement' },
      { id: 'passes', label: 'Passes / Handovers' },
      { id: 'metal-custody', label: 'Metal Custody' },
    ],
  },
  {
    id: 'quality',
    label: 'QUALITY',
    sections: [
      { id: 'qc', label: 'QC' },
      { id: 'rework', label: 'Rework' },
    ],
  },
  {
    id: 'factory',
    label: 'FACTORY',
    sections: [
      { id: 'machines', label: 'Machines' },
      { id: 'maintenance', label: 'Maintenance' },
      { id: 'floor-manager', label: 'Floor Manager' },
      { id: 'floor-attendance', label: 'Floor Attendance' },
    ],
  },
  {
    id: 'reporting',
    label: 'REPORTING',
    sections: [
      { id: 'reports', label: 'Reports' },
      { id: 'audit', label: 'Audit' },
    ],
  },
  {
    id: 'admin',
    label: 'ADMIN',
    sections: [
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
  { id: 'PACKAGING', label: 'PACKAGING', statuses: [] },
  { id: 'QC', label: 'QC', statuses: ['QC', 'QC_FAILED'] },
  { id: 'REWORK', label: 'REWORK', statuses: ['REWORK'] },
  { id: 'HOLD', label: 'HOLD', statuses: ['HOLD'] },
  { id: 'COMPLETED', label: 'COMPLETED', statuses: ['COMPLETED', 'RETURNED_TO_VAULT'] },
]

/** Frontend permission helpers mirroring backend productionRole matrix (UX only — backend enforces). */
export const PCC_PERMISSIONS = {
  view: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  createBatch: ['production_manager', 'floor_manager'],
  issueMetal: ['production_manager', 'floor_manager', 'vault_officer'],
  approvePass: ['production_manager', 'floor_manager'],
  createPass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer'],
  receivePass: ['production_manager', 'floor_manager', 'department_head', 'operator', 'vault_officer', 'qc_inspector'],
  startProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  completeProcess: ['production_manager', 'floor_manager', 'department_head', 'operator'],
  submitQc: ['production_manager', 'qc_inspector', 'floor_manager'],
  adjustWeight: ['production_manager'],
  holdRelease: ['production_manager', 'floor_manager'],
  returnToVault: ['production_manager', 'floor_manager', 'vault_officer'],
  manageMachines: ['production_manager', 'floor_manager'],
  manageFlow: ['production_manager'],
  resolveAlert: ['production_manager', 'floor_manager'],
  raiseAlert: ['production_manager', 'floor_manager', 'department_head', 'operator', 'qc_inspector', 'vault_officer'],
  splitMergeBatch: ['production_manager', 'floor_manager'],
  manageMaintenance: ['production_manager', 'floor_manager'],
  viewAudit: ['production_manager', 'floor_manager'],
  viewReports: ['production_manager', 'floor_manager'],
  manageShifts: ['production_manager'],
}

export function canPcc(role, permission) {
  if (!role) return false
  if (role === 'production_manager' || role === 'super_admin' || role === 'demo') return true
  const allowed = PCC_PERMISSIONS[permission] || []
  return allowed.includes(role)
}

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

export function na(value, fallback = 'N/A') {
  if (value == null || value === '') return fallback
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback
  return value
}

export function rowsToCsv(rows, columns) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))
  return [header, ...lines].join('\n')
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
