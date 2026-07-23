const USE_SEED_DATA =
  !import.meta.env.PROD
  && import.meta.env.DEV
  && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

// ── Design tokens ─────────────────────────────────
const C = {
  acc:  'var(--purple)',
  accH: 'var(--purple-light)',
  accD: '#023430',
  grad: 'var(--grad-brand)',
}

function getProductionTabs(t) {
  return [
    { id: 'kpi',         label: `📊 ${t('kpiOverview')}` },
    { id: 'monitor',     label: `📺 ${t('liveMonitor')}` },
    { id: 'equipment',   label: `⚙️ ${t('equipment')}` },
    { id: 'maintenance', label: `🔧 ${t('maintenance')}` },
    { id: 'quality',     label: `🔍 ${t('qualityControl')}` },
    { id: 'shifts',      label: `👥 ${t('shiftManagement')}` },
    { id: 'planning',    label: `📅 ${t('planning')}` },
    { id: 'alerts',      label: `🚨 ${t('alertsReports')}` },
    { id: 'costs',       label: `💰 ${t('costTracking')}` },
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

function StatCard({ icon, label, value, sub, color = 'var(--purple)', trend }) {
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

// ── Seed data ─────────────────────────────────────
const LINES = [
  { id: 'L1', name: 'Line 1 — Gold Casting',    state: 'running',     oee: 84, output: 1240, target: 1400, quality: 98.2, speed: 94, temp: 1083, operator: 'Ahmed Karimi' },
  { id: 'L2', name: 'Line 2 — Silver Refinery', state: 'maintenance', oee: 0,  output: 890,  target: 1200, quality: 97.5, speed: 0,  temp: 961,  operator: 'Sara Nouri' },
  { id: 'L3', name: 'Line 3 — Alloy Pressing',  state: 'running',     oee: 71, output: 2100, target: 2600, quality: 96.8, speed: 82, temp: 450,  operator: 'Reza Ahmadi' },
  { id: 'L4', name: 'Line 4 — Finishing',       state: 'idle',        oee: 0,  output: 560,  target: 800,  quality: 99.1, speed: 0,  temp: 25,   operator: 'Mina Hosseini' },
]

const linesForUi = USE_SEED_DATA ? LINES : []

const STATE_COLORS = {
  running:     { badge: 'green',  label: '● Running' },
  maintenance: { badge: 'yellow', label: '⚠ Maintenance' },
  stopped:     { badge: 'red',    label: '● Stopped' },
  idle:        { badge: 'gray',   label: '○ Idle' },
}

const DEFAULT_EQUIPMENT = [
  { id: 1, name: 'Gold Refinery Unit A',    line: 'L1', type: 'Refinery',     status: 'operational', lastMaint: '2026-03-20', nextMaint: '2026-06-20', age: '2y 3m' },
  { id: 2, name: 'CNC Milling Machine #1',  line: 'L1', type: 'CNC',          status: 'operational', lastMaint: '2026-04-01', nextMaint: '2026-07-01', age: '1y 8m' },
  { id: 3, name: 'Silver Furnace B2',       line: 'L2', type: 'Furnace',       status: 'maintenance', lastMaint: '2026-04-10', nextMaint: '2026-04-17', age: '3y 1m' },
  { id: 4, name: 'Alloy Press P4',          line: 'L3', type: 'Press',         status: 'operational', lastMaint: '2026-03-15', nextMaint: '2026-06-15', age: '4y 0m' },
  { id: 5, name: 'Polishing Station #3',    line: 'L4', type: 'Polisher',      status: 'idle',        lastMaint: '2026-02-28', nextMaint: '2026-05-28', age: '1y 1m' },
  { id: 6, name: 'Quality Testing Bench',   line: 'L4', type: 'QC Equipment', status: 'operational', lastMaint: '2026-04-05', nextMaint: '2026-07-05', age: '0y 9m' },
]

const EQUIP_STATUS = {
  operational: { badge: 'green',  label: 'Operational' },
  maintenance: { badge: 'yellow', label: 'In Maintenance' },
  idle:        { badge: 'gray',   label: 'Idle' },
  decommissioned: { badge: 'red', label: 'Decommissioned' },
}

const DEFAULT_WORK_ORDERS = [
  { id: 'WO-001', equipment: 'Silver Furnace B2',     type: 'corrective', priority: 'high',   status: 'open',       assignee: 'Maint Team A', reported: '2026-04-10', scheduled: '2026-04-15', desc: 'Temperature fluctuation detected during shift 2.' },
  { id: 'WO-002', equipment: 'CNC Milling Machine #1', type: 'preventive', priority: 'medium', status: 'in-progress', assignee: 'Maint Team B', reported: '2026-04-08', scheduled: '2026-04-14', desc: 'Scheduled quarterly lubrication and calibration.' },
  { id: 'WO-003', equipment: 'Alloy Press P4',         type: 'predictive', priority: 'low',    status: 'approved',   assignee: 'Maint Team A', reported: '2026-04-05', scheduled: '2026-04-20', desc: 'Vibration sensor alert — bearing inspection.' },
  { id: 'WO-004', equipment: 'Gold Refinery Unit A',   type: 'preventive', priority: 'medium', status: 'closed',     assignee: 'Maint Team C', reported: '2026-03-28', scheduled: '2026-04-02', desc: 'Monthly filter replacement completed.' },
]

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

const DEFAULT_QC = [
  { id: 1, product: 'Gold Bar 99.99%',    line: 'L1', batch: 'B-2406-001', inspector: 'QC Team A', date: '2026-04-13', passed: 142, failed: 3,  defectRate: 2.1, status: 'approved' },
  { id: 2, product: 'Silver Grain 99.9%', line: 'L2', batch: 'B-2406-002', inspector: 'QC Team B', date: '2026-04-12', passed: 890, failed: 22, defectRate: 2.4, status: 'approved' },
  { id: 3, product: 'Alloy Rod 14K',      line: 'L3', batch: 'B-2406-003', inspector: 'QC Team A', date: '2026-04-13', passed: 510, failed: 18, defectRate: 3.4, status: 'review' },
  { id: 4, product: 'Polished Ring Blank', line: 'L4', batch: 'B-2406-004', inspector: 'QC Team C', date: '2026-04-11', passed: 200, failed: 1,  defectRate: 0.5, status: 'approved' },
]

const QC_STATUS = {
  approved: { badge: 'green',  label: 'Approved' },
  review:   { badge: 'yellow', label: 'Under Review' },
  rejected: { badge: 'red',    label: 'Rejected' },
}

const SHIFTS = ['Morning (06–14)', 'Afternoon (14–22)', 'Night (22–06)']
const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_SHIFT_GRID = {
  'L1': { Mon: 0, Tue: 0, Wed: 1, Thu: 0, Fri: 1, Sat: 2, Sun: null },
  'L2': { Mon: 1, Tue: 2, Wed: 0, Thu: 1, Fri: 0, Sat: null, Sun: null },
  'L3': { Mon: 0, Tue: 0, Wed: 0, Thu: 2, Fri: 0, Sat: 0, Sun: 1 },
  'L4': { Mon: null, Tue: 1, Wed: 1, Thu: null, Fri: 1, Sat: null, Sun: null },
}

const DEFAULT_ALERTS = [
  { id: 1, type: 'critical', category: 'equipment',   line: 'L2', title: 'Furnace B2 Temperature Spike', msg: 'Temperature exceeded 1050°C threshold. Line stopped automatically.', time: '2026-04-13 09:14', ack: false },
  { id: 2, type: 'warning',  category: 'quality',     line: 'L3', title: 'Defect Rate Above Target',     msg: 'Batch B-2406-003 defect rate at 3.4%, above 2.5% threshold.', time: '2026-04-13 08:50', ack: false },
  { id: 3, type: 'info',     category: 'maintenance', line: 'L1', title: 'Preventive Maintenance Due',    msg: 'CNC Machine #1 scheduled maintenance in 3 days.', time: '2026-04-13 07:00', ack: true },
  { id: 4, type: 'warning',  category: 'production',  line: 'L3', title: 'Output Below Target',           msg: 'Line 3 at 81% of daily target with 4 hours remaining.', time: '2026-04-12 18:30', ack: true },
  { id: 5, type: 'critical', category: 'quality',     line: 'L2', title: 'Batch Hold — Silver Grain',     msg: 'QC batch B-2406-002 placed on hold pending senior review.', time: '2026-04-12 15:45', ack: false },
]

const ALERT_TYPES = {
  critical: { badge: 'red',    icon: '🔴' },
  warning:  { badge: 'yellow', icon: '🟡' },
  info:     { badge: 'blue',   icon: '🔵' },
}

const DEFAULT_ORDERS = [
  { id: 'PO-2406-01', product: 'Gold Bar 99.99%',    quantity: 500,  unit: 'pcs', line: 'L1', startDate: '2026-04-14', dueDate: '2026-04-21', status: 'scheduled', progress: 0 },
  { id: 'PO-2406-02', product: 'Silver Grain 99.9%', quantity: 2000, unit: 'kg',  line: 'L2', startDate: '2026-04-08', dueDate: '2026-04-16', status: 'in-progress', progress: 62 },
  { id: 'PO-2406-03', product: 'Alloy Rod 14K',      quantity: 1200, unit: 'pcs', line: 'L3', startDate: '2026-04-10', dueDate: '2026-04-18', status: 'in-progress', progress: 79 },
  { id: 'PO-2406-04', product: 'Ring Blank Set',     quantity: 300,  unit: 'sets', line: 'L4', startDate: '2026-04-01', dueDate: '2026-04-10', status: 'completed',  progress: 100 },
]

const ORDER_STATUS = {
  scheduled:    { badge: 'violet', label: 'Scheduled' },
  'in-progress': { badge: 'blue',  label: 'In Progress' },
  completed:    { badge: 'green',  label: 'Completed' },
  on_hold:      { badge: 'yellow', label: 'On Hold' },
  cancelled:    { badge: 'red',    label: 'Cancelled' },
}

const NOTIFICATIONS_DATA = [
  {
    id: 'N001', level: 'crit', read: false,
    title: '🔴 Line 2 Stopped Unexpectedly',
    desc: 'Drive belt failure detected at 10:32 AM. Emergency work order WO-001 created. Maintenance team dispatched.',
    meta: 'Line 2 · Equipment · Work Order: WO-001',
    time: '5 min ago',
    roles: ['superadmin', 'prod_mgr', 'shift_sup', 'maint_eng'],
  },
  {
    id: 'N002', level: 'high', read: false,
    title: '🟠 Quality Score Alert — Line 3',
    desc: 'Quality score dropped to 91% on Line 3 (threshold: 95%). Batch B-2406-003 has been held for review.',
    meta: 'Line 3 · Quality · Inspector: QC Team A',
    time: '1 hr ago',
    roles: ['superadmin', 'prod_mgr', 'shift_sup', 'quality'],
  },
  {
    id: 'N003', level: 'med', read: false,
    title: '🟡 Spare Parts Critically Low — Drive Belt',
    desc: 'Drive Belt stock is at 2 units (minimum: 3). Automatic procurement request raised.',
    meta: 'Warehouse · Spare Parts · Part ID: SP-001',
    time: '2 hrs ago',
    roles: ['superadmin', 'prod_mgr', 'maint_eng'],
  },
  {
    id: 'N004', level: 'med', read: false,
    title: '🟡 Line 3 Output Below Target',
    desc: 'Line 3 output is at 81% of daily target due to maintenance downtime.',
    meta: 'Line 3 · Production · Shift 2',
    time: '3 hrs ago',
    roles: ['superadmin', 'prod_mgr', 'shift_sup'],
  },
  {
    id: 'N005', level: 'info', read: true,
    title: '🔵 Shift Handover Completed',
    desc: 'Shift 1 → Shift 2 handover logged at 14:00. All line statuses acknowledged.',
    meta: 'All Lines · Shift Handover',
    time: '4 hrs ago',
    roles: ['superadmin', 'prod_mgr', 'shift_sup', 'operator'],
  },
  {
    id: 'N006', level: 'success', read: true,
    title: '🟢 Production Order PO-2406-04 Completed',
    desc: '300 Ring Blank Sets completed. Final quality score: 99.1%. Delivered on schedule.',
    meta: 'Line 4 · Production Order PO-2406-04',
    time: 'Yesterday',
    roles: ['superadmin', 'prod_mgr'],
  },
  {
    id: 'N007', level: 'info', read: true,
    title: '🔵 Daily Cost Report Auto-Generated',
    desc: "Today's production cost summary is available in Cost Tracking tab.",
    meta: 'System · Scheduled Report · 08:00 AM',
    time: 'Yesterday',
    roles: ['superadmin', 'prod_mgr', 'finance'],
  },
  {
    id: 'N008', level: 'med', read: true,
    title: '🟡 Preventive Maintenance Due — Line 1',
    desc: 'Scheduled lubrication service for Line 1 is due on Apr 15. Work order should be created.',
    meta: 'Line 1 · Preventive Maintenance',
    time: '2 days ago',
    roles: ['superadmin', 'prod_mgr', 'maint_eng'],
  },
  {
    id: 'N009', level: 'crit', read: true,
    title: '🔴 Temperature Alert — Line 2 Resolved',
    desc: 'Temperature on Furnace B2 exceeded 1050°C threshold. Issue resolved after cooling cycle.',
    meta: 'Line 2 · Temperature · Resolved',
    time: '2 days ago',
    roles: ['superadmin', 'prod_mgr', 'shift_sup', 'maint_eng'],
  },
]

const COST_DATA = [
  { category: 'Raw Materials',    budget: 280000, actual: 263400, variance: -6.0 },
  { category: 'Labor',            budget: 95000,  actual: 97200,  variance:  2.3 },
  { category: 'Energy',           budget: 42000,  actual: 38750,  variance: -7.7 },
  { category: 'Maintenance',      budget: 28000,  actual: 31500,  variance: 12.5 },
  { category: 'Consumables',      budget: 15000,  actual: 14200,  variance: -5.3 },
  { category: 'Depreciation',     budget: 22000,  actual: 22000,  variance:  0.0 },
  { category: 'Overhead',         budget: 18000,  actual: 19400,  variance:  7.8 },
]

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
