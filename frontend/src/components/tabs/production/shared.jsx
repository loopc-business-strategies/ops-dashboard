/** Seed/demo business data is disabled in all environments. */
const USE_SEED_DATA = false

// ── Design tokens ─────────────────────────────────
const C = {
  acc:  'var(--brand-primary)',
  accH: 'var(--brand-light)',
  accD: 'var(--brand-dark)',
  grad: 'var(--brand-primary)',
}

function getProductionTabs(t) {
  return [
    { id: 'kpi',         label: t('kpiOverview'), group: 'command' },
    { id: 'monitor',     label: t('liveMonitor'), group: 'command' },
    { id: 'alerts',      label: t('alertsReports'), group: 'command' },
    { id: 'planning',    label: t('planning'), group: 'work' },
    { id: 'equipment',   label: t('equipment'), group: 'factory' },
    { id: 'maintenance', label: t('maintenance'), group: 'factory' },
    { id: 'quality',     label: t('qualityControl'), group: 'quality' },
    { id: 'shifts',      label: t('shiftManagement'), group: 'factory' },
    { id: 'costs',       label: t('costTracking'), group: 'reporting' },
  ]
}

// ── Helpers ───────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const map = {
    green:  'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    red:    'text-red-400 bg-red-500/10 border-red-500/30',
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/30',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    gray:   'text-gray-400 bg-gray-700/50 border-gray-600',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${map[color] || map.gray}`}>
      {children}
    </span>
  )
}

function StatCard({ icon, label, value, sub, color = 'var(--brand-primary)', trend }) {
  return (
    <div
      className="rounded-2xl p-5 hover:-translate-y-0.5 transition-all"
      style={{
        background: 'rgba(17, 24, 39, 0.96)',
        border: '1px solid rgba(55, 65, 81, 0.95)',
        boxShadow: '0 1px 0 rgba(255, 255, 255, 0.02), 0 12px 24px rgba(0, 0, 0, 0.16)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
             style={{ background: `${color}22` }}>{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white leading-none tracking-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-1.5 leading-snug">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{sub}</p>}
    </div>
  )
}

function OEEGauge({ value = 78, size = 80 }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value)) / 100
  const dash = circ * pct
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#eab308' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth={size * 0.09} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={size * 0.2} fontWeight="bold">{value}%</text>
      <text x={cx} y={cy + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fill="#9ca3af" fontSize={size * 0.12}>OEE</text>
    </svg>
  )
}

function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between mb-7 gap-4">
      <div>
        <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
        {sub && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 bg-gray-900 border border-violet-500/40 rounded-2xl shadow-2xl min-w-[260px] animate-fade-in">
      <span className="text-lg">✅</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        <p className="text-xs text-gray-400">{toast.msg}</p>
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
    </div>
  )
}

function Modal({ open, title, onClose, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className={`bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white leading-tight">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider leading-none">
        {label} {required && <span className="text-violet-400">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Seed data (purged — live/API only; keep empty shells for exports) ──
const LINES = []
const linesForUi = []

const STATE_COLORS = {
  running:     { badge: 'green',  label: '● Running' },
  maintenance: { badge: 'yellow', label: '⚠ Maintenance' },
  stopped:     { badge: 'red',    label: '● Stopped' },
  idle:        { badge: 'gray',   label: '○ Idle' },
}

const DEFAULT_EQUIPMENT = []

const EQUIP_STATUS = {
  operational: { badge: 'green',  label: 'Operational' },
  maintenance: { badge: 'yellow', label: 'In Maintenance' },
  idle:        { badge: 'gray',   label: 'Idle' },
  decommissioned: { badge: 'red', label: 'Decommissioned' },
}

const DEFAULT_WORK_ORDERS = []

const WO_STATUS = {
  open:        { badge: 'violet', label: 'Open' },
  'in-progress': { badge: 'blue', label: 'In Progress' },
  approved:    { badge: 'green',  label: 'Approved' },
  closed:      { badge: 'gray',   label: 'Closed' },
}

const WO_PRIORITY = {
  high:   { badge: 'red',    label: 'High' },
  medium: { badge: 'yellow', label: 'Medium' },
  low:    { badge: 'gray',   label: 'Low' },
}

const DEFAULT_QC = []

const QC_STATUS = {
  approved: { badge: 'green',  label: 'Approved' },
  review:   { badge: 'yellow', label: 'Under Review' },
  rejected: { badge: 'red',    label: 'Rejected' },
}

const SHIFTS = ['Morning (06–14)', 'Afternoon (14–22)', 'Night (22–06)']
const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_SHIFT_GRID = {}

const DEFAULT_ALERTS = []

const ALERT_TYPES = {
  critical: { badge: 'red',    icon: '🔴' },
  warning:  { badge: 'yellow', icon: '🟡' },
  info:     { badge: 'blue',   icon: '🔵' },
}

const DEFAULT_ORDERS = []

const ORDER_STATUS = {
  scheduled:    { badge: 'violet', label: 'Scheduled' },
  'in-progress': { badge: 'blue',  label: 'In Progress' },
  completed:    { badge: 'green',  label: 'Completed' },
  on_hold:      { badge: 'yellow', label: 'On Hold' },
  cancelled:    { badge: 'red',    label: 'Cancelled' },
}

const NOTIFICATIONS_DATA = []

const COST_DATA = []

export {
  USE_SEED_DATA,
  C,
  getProductionTabs,
  Badge,
  StatCard,
  OEEGauge,
  SectionHeader,
  Toast,
  Modal,
  Field,
  LINES,
  linesForUi,
  STATE_COLORS,
  DEFAULT_EQUIPMENT,
  EQUIP_STATUS,
  DEFAULT_WORK_ORDERS,
  WO_STATUS,
  WO_PRIORITY,
  DEFAULT_QC,
  QC_STATUS,
  SHIFTS,
  DAYS,
  DEFAULT_SHIFT_GRID,
  DEFAULT_ALERTS,
  ALERT_TYPES,
  DEFAULT_ORDERS,
  ORDER_STATUS,
  NOTIFICATIONS_DATA,
  COST_DATA,
}
