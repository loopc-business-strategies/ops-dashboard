// FILE: src/components/tabs/ProductionTab.jsx
// Production Control Center — 9 sub-tabs, role-based access

import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import workOrdersApi from '../../api/production/workOrders'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModulePageHeading, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'

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

// ── KPI Overview ──────────────────────────────────
function KPIOverview() {
  const totalOutput = linesForUi.reduce((s, l) => s + l.output, 0)
  const totalTarget = linesForUi.reduce((s, l) => s + l.target, 0)
  const activeLines = linesForUi.filter((l) => l.state === 'running').length
  const oeePositive = linesForUi.filter((l) => l.oee > 0)
  const avgOEE = oeePositive.length
    ? Math.round(oeePositive.reduce((s, l) => s + l.oee, 0) / oeePositive.length)
    : 0
  const avgQuality = linesForUi.length
    ? (linesForUi.reduce((s, l) => s + l.quality, 0) / linesForUi.length).toFixed(1)
    : '0.0'
  const seedWorkOpen = USE_SEED_DATA ? DEFAULT_WORK_ORDERS.filter((w) => w.status !== 'closed').length : 0
  const seedAlertsOpen = USE_SEED_DATA ? DEFAULT_ALERTS.filter((a) => !a.ack).length : 0
  const seedOrdersActive = USE_SEED_DATA ? DEFAULT_ORDERS.filter((o) => o.status === 'in-progress').length : 0

  return (
    <div className="space-y-6">
      <SectionHeader title="KPI Overview" sub="Real-time status across all production lines" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="🏭" label="Lines Running"    value={`${activeLines}/${linesForUi.length}`} color="#22c55e" trend={0} />
        <StatCard icon="📦" label="Total Output"     value={totalOutput.toLocaleString()} sub={`Target: ${totalTarget.toLocaleString()}`} color="var(--purple)" trend={-4} />
        <StatCard icon="⚡" label="Avg OEE"          value={`${avgOEE}%`}  sub="Overall Equipment Effectiveness" color="#3b82f6" trend={2} />
        <StatCard icon="🎯" label="Quality Rate"     value={`${avgQuality}%`} color="#22c55e" trend={1} />
        <StatCard icon="🔧" label="Open Work Orders" value={seedWorkOpen} color="#eab308" />
      </div>

      {USE_SEED_DATA ? (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="⚠️" label="Active Alerts"   value={seedAlertsOpen} color="#ef4444" />
        <StatCard icon="📋" label="Active Orders"    value={seedOrdersActive} color="var(--purple)" />
        <StatCard icon="🕐" label="Downtime Today"   value="2h 14m"  sub="Line 2 maintenance" color="#f59e0b" />
        <StatCard icon="📈" label="Efficiency"       value="81.4%" sub="vs 79.2% last week" color="#22c55e" trend={2.8} />
        <StatCard icon="🔄" label="Shift Changes"    value="3"  sub="Next: 14:00" color="#3b82f6" />
      </div>
      ) : (
      <p className="text-sm text-gray-500 px-1">
        Connect production data sources to populate KPIs; demo metrics are hidden outside local seed mode.
      </p>
      )}

      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(17, 24, 39, 0.96)',
          border: '1px solid rgba(55, 65, 81, 0.95)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.02), 0 12px 24px rgba(0, 0, 0, 0.16)',
        }}
      >
        <h4 className="text-sm font-semibold text-white mb-4 leading-tight">Production Line Status</h4>
        <div className="space-y-3">
          {linesForUi.length === 0 ? (
            <p className="text-sm text-gray-400">No line data yet. Enable local demo data with VITE_ENABLE_SEED_DATA=true or connect production feeds.</p>
          ) : (
          linesForUi.map(line => {
            const pct = Math.round((line.output / line.target) * 100)
            const sc  = STATE_COLORS[line.state]
            return (
              <div
                key={line.id}
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(17, 24, 39, 0.92)',
                  border: '1px solid rgba(55, 65, 81, 0.9)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-white leading-tight truncate">{line.name}</span>
                    <Badge color={sc.badge}>{sc.label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400 lg:text-right">
                    <span className="whitespace-nowrap">OEE: <span className="text-white font-medium">{line.oee || '—'}%</span></span>
                    <span className="whitespace-nowrap">Quality: <span className="text-white font-medium">{line.quality}%</span></span>
                    <span className="whitespace-nowrap">Operator: <span className="text-white font-medium">{line.operator}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? '#22c55e' : pct >= 70 ? '#eab308' : '#ef4444' }} />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {line.output.toLocaleString()} / {line.target.toLocaleString()} ({pct}%)
                  </span>
                </div>
              </div>
            )
          })
          )}
        </div>
      </div>
      </div>
   
  )
}

// ── Live Monitor ──────────────────────────────────
function LiveMonitor({ canEdit: _canEdit, showToast: _showToast }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="space-y-5">
      <SectionHeader title="Live Production Monitor" sub="Real-time status across all production lines" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linesForUi.map(line => {
          const sc = STATE_COLORS[line.state]
          const pct = Math.round((line.output / line.target) * 100)
          return (
            <div key={line.id}
                 className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-violet-500/30 transition-all cursor-pointer"
                 onClick={() => setSelected(line)}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{line.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">Operator: {line.operator}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={sc.badge}>{sc.label}</Badge>
                  <span className="text-xs text-gray-500">Click for details</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <OEEGauge value={line.oee} size={72} />
                <div className="flex-1 grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <p className="text-gray-500">Output Today</p>
                    <p className="text-white font-semibold">{line.output.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Target</p>
                    <p className="text-white font-semibold">{line.target.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quality</p>
                    <p className="text-green-400 font-semibold">{line.quality}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Speed</p>
                    <p className="text-white font-semibold">{line.speed > 0 ? `${line.speed}%` : '—'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                       style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? '#22c55e' : pct >= 70 ? '#eab308' : '#ef4444' }} />
                </div>
                <span className="text-xs text-gray-500">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4 leading-tight">Today's Production Timeline</h4>
        <div className="space-y-3">
          {linesForUi.map(line => (
            <div key={line.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{line.id}</span>
              <div className="flex-1 h-6 bg-gray-800 rounded-md overflow-hidden flex">
                {line.state === 'running' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '72%' }} title="Running" />
                  <div className="h-full bg-gray-700/50" style={{ width: '28%' }} title="Idle" />
                </>}
                {line.state === 'maintenance' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '38%' }} title="Running" />
                  <div className="h-full bg-yellow-500/60" style={{ width: '30%' }} title="Maintenance" />
                  <div className="h-full bg-gray-700/50" style={{ width: '32%' }} title="Idle" />
                </>}
                {line.state === 'idle' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '55%' }} title="Running" />
                  <div className="h-full bg-gray-700/50" style={{ width: '45%' }} title="Idle" />
                </>}
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600/70 inline-block" />Run</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/60 inline-block" />Maint</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-700/80 inline-block" />Idle</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line Detail Modal */}
      <Modal open={!!selected} title={selected ? `${selected.name} — Details` : ''} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Current State</p>
                <Badge color={STATE_COLORS[selected.state].badge}>{STATE_COLORS[selected.state].label}</Badge>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
                <OEEGauge value={selected.oee} size={60} />
                <div>
                  <p className="text-xs text-gray-500">OEE Score</p>
                  <p className="text-xl font-bold text-white">{selected.oee}%</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['Output Today', `${selected.output.toLocaleString()} pcs`],
                ['Target', `${selected.target.toLocaleString()} pcs`],
                ['Quality', `${selected.quality}%`],
                ['Speed', `${selected.speed || 0}%`],
                ['Temperature', `${selected.temp}°C`],
                ['Operator', selected.operator],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-900 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="text-sm font-semibold text-white mt-1">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">7-Day Performance Trend</p>
              <div className="flex items-end gap-2 h-20">
                {[72, 81, 78, 85, 82, 79, selected.oee].map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm transition-all"
                         style={{ height: `${(v / 100) * 72}px`, background: i === 6 ? C.acc : '#374151' }} />
                    <span className="text-xs text-gray-600">{['M','T','W','T','F','S','T'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Equipment ─────────────────────────────────────
function Equipment({ canEdit, showToast }) {
  const [equipment, setEquipment] = useState(USE_SEED_DATA ? DEFAULT_EQUIPMENT : [])
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', line: 'L1', type: '', status: 'operational', lastMaint: '', nextMaint: '', age: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => { setForm({ name: '', line: 'L1', type: '', status: 'operational', lastMaint: '', nextMaint: '', age: '' }); setEditItem(null); setModal(true) }
  const openEdit = item => { setForm({ name: item.name, line: item.line, type: item.type, status: item.status, lastMaint: item.lastMaint, nextMaint: item.nextMaint, age: item.age }); setEditItem(item.id); setModal(true) }
  const removeItem = item => {
    if (!window.confirm(`Delete equipment "${item.name}"?`)) return
    setEquipment(p => p.filter(eq => eq.id !== item.id))
    showToast('Equipment Deleted', `${item.name} removed from registry.`)
  }

  const handleSave = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editItem) {
      setEquipment(p => p.map(eq => eq.id === editItem ? { ...eq, ...form } : eq))
      showToast('Equipment Updated', `${form.name} has been updated.`)
    } else {
      setEquipment(p => [...p, { ...form, id: Date.now() }])
      showToast('Equipment Added', `${form.name} added to registry.`)
    }
    setModal(false)
  }

  return (
    <div>
      <SectionHeader
        title="Equipment Registry"
        sub={`${equipment.length} pieces of equipment tracked`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: C.grad }}>+ Add Equipment</button>
        )}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Equipment', 'Line', 'Type', 'Status', 'Last Maint.', 'Next Maint.', 'Age', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 leading-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {equipment.map(eq => {
              const st = EQUIP_STATUS[eq.status] || EQUIP_STATUS.idle
              return (
                <tr key={eq.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white leading-tight">{eq.name}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.line}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.type}</td>
                  <td className="py-3 pr-4"><Badge color={st.badge}>{st.label}</Badge></td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.lastMaint || '—'}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.nextMaint || '—'}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.age}</td>
                  {canEdit && (
                    <td className="py-3">
                      <button onClick={() => openEdit(eq)}
                              className="text-xs px-3 py-1 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => removeItem(eq)}
                              className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editItem ? 'Edit Equipment' : 'Add Equipment'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment Name" required>
            <input className="input-field" value={form.name} onChange={set('name')} placeholder="e.g. Gold Refinery Unit A" />
          </Field>
          <Field label="Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id} — {l.name.split('—')[1]?.trim()}</option>)}
            </select>
          </Field>
          <Field label="Equipment Type">
            <input className="input-field" value={form.type} onChange={set('type')} placeholder="e.g. Furnace, CNC, Press" />
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              {Object.entries(EQUIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Last Maintenance">
            <input type="date" className="input-field" value={form.lastMaint} onChange={set('lastMaint')} />
          </Field>
          <Field label="Next Maintenance">
            <input type="date" className="input-field" value={form.nextMaint} onChange={set('nextMaint')} />
          </Field>
          <Field label="Equipment Age">
            <input className="input-field" value={form.age} onChange={set('age')} placeholder="e.g. 2y 3m" />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
                    style={{ background: C.grad }}>
              {editItem ? 'Update Equipment' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Maintenance ───────────────────────────────────
function Maintenance({ canEdit, showToast }) {
  const [orders, setOrders] = useState(USE_SEED_DATA ? DEFAULT_WORK_ORDERS : [])
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ equipment: '', type: 'preventive', priority: 'medium', status: 'open', assignee: '', scheduled: '', desc: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const approve = id => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status: 'approved' } : o))
    showToast('Work Order Approved', `WO ${id} has been approved.`)
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ equipment: '', type: 'preventive', priority: 'medium', status: 'open', assignee: '', scheduled: '', desc: '' })
    setModal(true)
  }

  const openEdit = order => {
    setEditId(order.id)
    setForm({
      equipment: order.equipment,
      type: order.type,
      priority: order.priority,
      status: order.status,
      assignee: order.assignee,
      scheduled: order.scheduled || '',
      desc: order.desc || '',
    })
    setModal(true)
  }

  const deleteOrder = order => {
    if (!window.confirm(`Delete work order ${order.id}?`)) return
    setOrders(p => p.filter(x => x.id !== order.id))
    showToast('Work Order Deleted', `${order.id} removed.`)
  }

  const handleCreate = e => {
    e.preventDefault()
    if (!form.equipment.trim()) return
    if (editId) {
      setOrders(p => p.map(o => o.id === editId ? { ...o, ...form } : o))
      showToast('Work Order Updated', `${editId} has been updated.`)
    } else {
      const id = `WO-${String(orders.length + 1).padStart(3, '0')}`
      setOrders(p => [...p, { ...form, id, reported: new Date().toISOString().slice(0, 10) }])
      showToast('Work Order Created', `${id} has been created.`)
    }
    setEditId(null)
    setModal(false)
  }

  const MAINT_CAL = [
    { date: '2026-04-14', label: 'CNC #1 Lube', type: 'preventive' },
    { date: '2026-04-15', label: 'Furnace B2', type: 'corrective' },
    { date: '2026-04-17', label: 'Press P4', type: 'predictive' },
    { date: '2026-04-20', label: 'Filter Replace', type: 'preventive' },
    { date: '2026-04-22', label: 'Full Inspection', type: 'preventive' },
  ]

  const typeColor = { preventive: 'blue', corrective: 'red', predictive: 'violet' }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Maintenance Management"
        sub={`${orders.filter(o => o.status !== 'closed').length} open work orders`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: C.grad }}>+ Create Work Order</button>
        )}
      />

      {/* Work Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['ID', 'Equipment', 'Type', 'Priority', 'Status', 'Assignee', 'Scheduled', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 leading-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-mono text-xs text-violet-400 leading-tight">{o.id}</td>
                <td className="py-3 pr-4 font-medium text-white max-w-[180px] truncate leading-tight">{o.equipment}</td>
                <td className="py-3 pr-4"><Badge color={typeColor[o.type] || 'gray'}>{o.type}</Badge></td>
                <td className="py-3 pr-4"><Badge color={WO_PRIORITY[o.priority]?.badge || 'gray'}>{WO_PRIORITY[o.priority]?.label}</Badge></td>
                <td className="py-3 pr-4"><Badge color={WO_STATUS[o.status]?.badge || 'gray'}>{WO_STATUS[o.status]?.label}</Badge></td>
                <td className="py-3 pr-4 text-gray-400 leading-tight">{o.assignee}</td>
                <td className="py-3 pr-4 text-gray-400 leading-tight">{o.scheduled || '—'}</td>
                {canEdit && (
                  <td className="py-3">
                    {o.status === 'open' && (
                      <button onClick={() => approve(o.id)}
                              className="text-xs px-3 py-1 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                        Approve
                      </button>
                    )}
                    <button onClick={() => openEdit(o)}
                            className="text-xs px-3 py-1 ml-2 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => deleteOrder(o)}
                            className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Maintenance Calendar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Upcoming Maintenance — April 2026</h4>
        <div className="grid grid-cols-7 gap-2 text-center">
          {['14', '15', '16', '17', '18', '19', '20'].map((d) => {
            const events = MAINT_CAL.filter(e => e.date.endsWith(`-${d}`))
            return (
              <div key={d} className="bg-gray-800/50 rounded-lg p-2 min-h-[72px]">
                <p className="text-xs text-gray-500 mb-1">Apr {d}</p>
                {events.map(ev => (
                  <div key={ev.label} className={`text-xs rounded px-1 py-0.5 mb-1 ${
                    ev.type === 'corrective' ? 'bg-red-500/20 text-red-400' :
                    ev.type === 'predictive' ? 'bg-violet-500/20 text-violet-400' :
                    'bg-blue-500/20 text-blue-400'}`}>{ev.label}</div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3">
          {[['blue', 'Preventive'], ['red', 'Corrective'], ['violet', 'Predictive']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-sm bg-${c}-500/40 inline-block`} />{l}
            </span>
          ))}
        </div>
      </div>

      <Modal open={modal} title={editId ? 'Edit Work Order' : 'Create Work Order'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment" required>
            <select className="input-field" value={form.equipment} onChange={set('equipment')}>
              <option value="">Select equipment…</option>
              {DEFAULT_EQUIPMENT.map(eq => <option key={eq.id} value={eq.name}>{eq.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="input-field" value={form.type} onChange={set('type')}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
              <option value="predictive">Predictive</option>
            </select>
          </Field>
          <Field label="Priority">
            <select className="input-field" value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Assignee">
            <input className="input-field" value={form.assignee} onChange={set('assignee')} placeholder="e.g. Maint Team A" />
          </Field>
          <Field label="Scheduled Date">
            <input type="date" className="input-field" value={form.scheduled} onChange={set('scheduled')} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea className="input-field resize-none" rows={3} value={form.desc} onChange={set('desc')} placeholder="Describe the maintenance task…" />
            </Field>
          </div>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Work Order' : 'Create Work Order'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Quality Control ───────────────────────────────
function QualityControl({ canEdit, showToast }) {
  const [checks, setChecks] = useState(USE_SEED_DATA ? DEFAULT_QC : [])
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ product: '', line: 'L1', batch: '', inspector: '', passed: '', failed: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => {
    setEditId(null)
    setForm({ product: '', line: 'L1', batch: '', inspector: '', passed: '', failed: '' })
    setModal(true)
  }

  const openEdit = item => {
    setEditId(item.id)
    setForm({ product: item.product, line: item.line, batch: item.batch, inspector: item.inspector, passed: String(item.passed), failed: String(item.failed) })
    setModal(true)
  }

  const deleteCheck = item => {
    if (!window.confirm(`Delete QC check for batch ${item.batch}?`)) return
    setChecks(p => p.filter(x => x.id !== item.id))
    showToast('QC Check Deleted', `Batch ${item.batch} removed.`)
  }

  const handleLog = e => {
    e.preventDefault()
    if (!form.product.trim() || !form.batch.trim()) return
    const passed = parseInt(form.passed) || 0
    const failed = parseInt(form.failed) || 0
    const total  = passed + failed
    const defectRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0'
    const payload = {
      id: editId || Date.now(),
      ...form,
      passed,
      failed,
      defectRate: parseFloat(defectRate),
      status: parseFloat(defectRate) < 2.5 ? 'approved' : 'review',
      date: new Date().toISOString().slice(0, 10),
    }
    if (editId) {
      setChecks(p => p.map(x => x.id === editId ? payload : x))
      showToast('QC Check Updated', `Batch ${form.batch} updated.`)
    } else {
      setChecks(p => [payload, ...p])
      showToast('Quality Check Logged', `Batch ${form.batch} recorded.`)
    }
    setEditId(null)
    setModal(false)
  }

  const avgDefect = (checks.reduce((s, c) => s + c.defectRate, 0) / checks.length).toFixed(1)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quality Control"
        sub={`Avg defect rate: ${avgDefect}% — Target: < 2.5%`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Log QC Check</button>
        )}
      />

      {/* Defect Rate Bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Defect Rate by Batch</h4>
        <div className="space-y-3">
          {checks.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-36 shrink-0 truncate">{c.batch}</span>
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${Math.min(100, c.defectRate * 10)}%`,
                              background: c.defectRate < 2.5 ? '#22c55e' : c.defectRate < 4 ? '#eab308' : '#ef4444' }} />
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">{c.defectRate}%</span>
              <Badge color={c.defectRate < 2.5 ? 'green' : 'yellow'}>{c.defectRate < 2.5 ? '✓' : '!'}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-red-500/30 relative">
            <span className="absolute right-0 -top-4 text-xs text-red-400">2.5% limit</span>
          </div>
        </div>
      </div>

      {/* QC Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Product', 'Batch', 'Line', 'Inspector', 'Date', 'Passed', 'Failed', 'Defect %', 'Status', ...(canEdit ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {checks.map(c => (
              <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-medium text-white">{c.product}</td>
                <td className="py-3 pr-4 font-mono text-xs text-violet-400">{c.batch}</td>
                <td className="py-3 pr-4 text-gray-400">{c.line}</td>
                <td className="py-3 pr-4 text-gray-400">{c.inspector}</td>
                <td className="py-3 pr-4 text-gray-400">{c.date}</td>
                <td className="py-3 pr-4 text-green-400">{c.passed.toLocaleString()}</td>
                <td className="py-3 pr-4 text-red-400">{c.failed}</td>
                <td className="py-3 pr-4">
                  <span className={c.defectRate < 2.5 ? 'text-green-400' : c.defectRate < 4 ? 'text-yellow-400' : 'text-red-400'}>
                    {c.defectRate}%
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <Badge color={QC_STATUS[c.status]?.badge || 'gray'}>{QC_STATUS[c.status]?.label}</Badge>
                </td>
                {canEdit && (
                  <td className="py-3 pr-4">
                    <button onClick={() => openEdit(c)} className="text-xs px-3 py-1 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">Edit</button>
                    <button onClick={() => deleteCheck(c)} className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editId ? 'Edit Quality Check' : 'Log Quality Check'} onClose={() => setModal(false)}>
        <form onSubmit={handleLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product" required>
            <input className="input-field" value={form.product} onChange={set('product')} placeholder="e.g. Gold Bar 99.99%" />
          </Field>
          <Field label="Batch ID" required>
            <input className="input-field" value={form.batch} onChange={set('batch')} placeholder="e.g. B-2406-005" />
          </Field>
          <Field label="Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
            </select>
          </Field>
          <Field label="Inspector">
            <input className="input-field" value={form.inspector} onChange={set('inspector')} placeholder="e.g. QC Team A" />
          </Field>
          <Field label="Units Passed">
            <input type="number" min="0" className="input-field" value={form.passed} onChange={set('passed')} />
          </Field>
          <Field label="Units Failed">
            <input type="number" min="0" className="input-field" value={form.failed} onChange={set('failed')} />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update QC Check' : 'Log QC Check'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Shift Management ──────────────────────────────
function ShiftManagement({ canEdit, showToast }) {
  const [grid, setGrid] = useState(USE_SEED_DATA ? DEFAULT_SHIFT_GRID : {})

  const shiftColor = s => s === 0 ? 'bg-blue-500/20 text-blue-400' : s === 1 ? 'bg-green-500/20 text-green-400' : s === 2 ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-800/50 text-gray-600'
  const shiftLabel = s => s === null ? 'Off' : SHIFTS[s].split(' ')[0]
  const cycleShift = (lineId, day) => {
    if (!canEdit) return
    setGrid(p => {
      const cur = p[lineId]?.[day]
      const next = cur === null ? 0 : cur === 0 ? 1 : cur === 1 ? 2 : null
      return { ...p, [lineId]: { ...p[lineId], [day]: next } }
    })
  }

  const autoBalance = () => {
    if (!canEdit) return
    const rows = {}
    linesForUi.forEach((line, li) => {
      rows[line.id] = {}
      DAYS.forEach((d, di) => {
        rows[line.id][d] = di === 6 ? null : (li + di) % 3
      })
    })
    setGrid(rows)
    showToast('Shifts Rebalanced', 'Weekly assignments auto-balanced.')
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Shift Management" sub="Weekly schedule — 3 shifts per line" />

      {canEdit && (
        <div className="flex gap-2">
          <button onClick={autoBalance} className="px-3 py-1.5 text-xs rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">Auto-balance Week</button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-40">Line</th>
              {DAYS.map(d => (
                <th key={d} className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 px-2">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {linesForUi.map(line => (
              <tr key={line.id}>
                <td className="py-3 pr-4">
                  <p className="text-xs font-medium text-white">{line.id}</p>
                  <p className="text-xs text-gray-500">{line.operator}</p>
                </td>
                {DAYS.map(d => {
                  const s = grid[line.id]?.[d]
                  return (
                    <td key={d} className="py-3 px-2 text-center">
                      <button
                        onClick={() => cycleShift(line.id, d)}
                        className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${shiftColor(s)} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
                        {shiftLabel(s)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4">
        {[['blue', 'Morning (06–14)'], ['green', 'Afternoon (14–22)'], ['violet', 'Night (22–06)'], ['gray', 'Off / No Shift']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-3 h-3 rounded bg-${c}-500/30 inline-block`} />{l}
          </span>
        ))}
      </div>

      {/* Shift Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SHIFTS.map((shift, i) => {
          const count = Object.values(grid).reduce((s, days) => s + Object.values(days).filter(v => v === i).length, 0)
          const colors = ['text-blue-400', 'text-green-400', 'text-violet-400']
          return (
            <div key={shift} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500">{shift}</p>
              <p className={`text-2xl font-bold mt-1 ${colors[i]}`}>{count}</p>
              <p className="text-xs text-gray-600 mt-0.5">scheduled assignments this week</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Planning ──────────────────────────────────────
function Planning({ canEdit, showToast }) {
  const { token } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ product: '', quantity: '', unit: 'pcs', line: 'L1', startDate: '', dueDate: '', status: 'scheduled', progress: 0 })

  const toRow = wo => ({
    id:        wo._id,
    woNumber:  wo.woNumber,
    product:   wo.product || wo.woNumber || '',
    quantity:  wo.quantity || 0,
    unit:      wo.unit || 'pcs',
    line:      wo.line || '',
    startDate: wo.startDate ? wo.startDate.slice(0, 10) : '',
    dueDate:   wo.targetDate ? wo.targetDate.slice(0, 10) : '',
    status:    wo.status || 'scheduled',
    progress:  wo.progress || 0,
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await workOrdersApi.getWorkOrders()
        if (mounted) setOrders((res.workOrders || res.data || []).map(toRow))
      } catch (e) {
        if (mounted) showToast?.(e?.response?.data?.message || 'Failed to load work orders')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [token, showToast])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => {
    setEditId(null)
    setForm({ product: '', quantity: '', unit: 'pcs', line: 'L1', startDate: '', dueDate: '', status: 'scheduled', progress: 0 })
    setModal(true)
  }

  const openEdit = order => {
    setEditId(order.id)
    setForm({ product: order.product, quantity: order.quantity, unit: order.unit, line: order.line, startDate: order.startDate, dueDate: order.dueDate, status: order.status, progress: order.progress })
    setModal(true)
  }

  const deleteOrder = async order => {
    if (!window.confirm(`Delete order ${order.product || order.id}?`)) return
    try {
      await workOrdersApi.deleteWorkOrder(order.id)
      setOrders(p => p.filter(x => x.id !== order.id))
      showToast('Order Deleted', `Order removed.`)
    } catch { showToast('Error', 'Failed to delete order.') }
  }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.product.trim() || !form.quantity) return
    const payload = {
      woNumber: form.product.replace(/\s+/g, '-').toUpperCase() + '-' + Date.now(),
      product: form.product.trim(),
      quantity: parseInt(form.quantity, 10) || 1,
      unit: form.unit,
      line: form.line,
      startDate: form.startDate || null,
      targetDate: form.dueDate || null,
      status: form.status,
      progress: parseInt(form.progress, 10) || 0,
    }
    try {
      if (editId) {
        const res = await workOrdersApi.updateWorkOrder(editId, { ...payload })
        const updated = toRow(res.workOrder || res.data || { ...payload, _id: editId })
        setOrders(p => p.map(x => x.id === editId ? updated : x))
        showToast('Production Order Updated', `${form.product} updated.`)
      } else {
        const res = await workOrdersApi.createWorkOrder(payload)
        setOrders(p => [...p, toRow(res.workOrder || res.data || { ...payload, _id: Date.now() })])
        showToast('Production Order Created', `${form.product} scheduled.`)
      }
      setEditId(null)
      setModal(false)
    } catch (err) { showToast('Error', err?.response?.data?.message || 'Failed to save order.') }
  }

  // Forecast banner data
  const forecast = [
    { week: 'W15 (Apr 7–13)',  actual: 4790, plan: 5000 },
    { week: 'W16 (Apr 14–20)', actual: null, plan: 5200 },
    { week: 'W17 (Apr 21–27)', actual: null, plan: 5100 },
    { week: 'W18 (Apr 28–30)', actual: null, plan: 2400 },
  ]
  const maxPlan = Math.max(...forecast.map(f => f.plan))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Production Planning"
        sub="Production orders and weekly forecast"
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Create Order</button>
        )}
      />

      {/* Forecast Banner */}
        {loading && <p className="text-sm text-gray-500">Loading orders...</p>}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Weekly Forecast</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {forecast.map(f => {
            const pct = f.actual ? Math.round((f.actual / f.plan) * 100) : null
            return (
              <div key={f.week} className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-2">{f.week}</p>
                <div className="h-16 bg-gray-700/50 rounded-lg flex items-end overflow-hidden mb-2">
                  <div className="w-full rounded-t-sm"
                       style={{ height: `${((f.actual || f.plan) / maxPlan) * 100}%`,
                                background: f.actual ? (pct >= 90 ? '#22c55e' : '#eab308') : '#374151' }} />
                </div>
                <p className="text-sm font-semibold text-white">{(f.actual || f.plan).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Plan: {f.plan.toLocaleString()}</p>
                {pct !== null && (
                  <span className={`text-xs font-medium ${pct >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {pct}% achieved
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Order ID', 'Product', 'Qty', 'Line', 'Start', 'Due', 'Progress', 'Status', ...(canEdit ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-mono text-xs text-violet-400">{o.id}</td>
                <td className="py-3 pr-4 font-medium text-white">{o.product}</td>
                <td className="py-3 pr-4 text-gray-400">{o.quantity.toLocaleString()} {o.unit}</td>
                <td className="py-3 pr-4 text-gray-400">{o.line}</td>
                <td className="py-3 pr-4 text-gray-400">{o.startDate}</td>
                <td className="py-3 pr-4 text-gray-400">{o.dueDate}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500"
                           style={{ width: `${o.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{o.progress}%</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <Badge color={ORDER_STATUS[o.status]?.badge || 'gray'}>{ORDER_STATUS[o.status]?.label}</Badge>
                </td>
                {canEdit && (
                  <td className="py-3 pr-4">
                    <button onClick={() => openEdit(o)} className="text-xs px-3 py-1 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">Edit</button>
                    <button onClick={() => deleteOrder(o)} className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editId ? 'Edit Production Order' : 'Create Production Order'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product Name" required>
            <input className="input-field" value={form.product} onChange={set('product')} placeholder="e.g. Gold Bar 99.99%" />
          </Field>
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Quantity" required>
                <input type="number" min="1" className="input-field" value={form.quantity} onChange={set('quantity')} />
              </Field>
            </div>
            <div className="w-24">
              <Field label="Unit">
                <select className="input-field" value={form.unit} onChange={set('unit')}>
                  {['pcs', 'kg', 'g', 'sets', 'bars'].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Production Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id} — {l.name.split('—')[1]?.trim()}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Start Date">
            <input type="date" className="input-field" value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="Due Date">
            <input type="date" className="input-field" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Progress %">
            <input type="number" min="0" max="100" className="input-field" value={form.progress} onChange={set('progress')} />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Order' : 'Create Order'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Alerts & Reports ──────────────────────────────
function AlertsReports({ canEdit, showToast }) {
  const [alerts, setAlerts] = useState(USE_SEED_DATA ? DEFAULT_ALERTS : [])
  const [filter, setFilter] = useState('all')
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ type: 'warning', category: 'production', line: 'L1', title: '', msg: '' })
  const openAdd = () => {
    setEditId(null)
    setForm({ type: 'warning', category: 'production', line: 'L1', title: '', msg: '' })
    setModal(true)
  }

  const openEdit = alert => {
    setEditId(alert.id)
    setForm({ type: alert.type, category: alert.category, line: alert.line, title: alert.title, msg: alert.msg })
    setModal(true)
  }

  const deleteAlert = alert => {
    if (!window.confirm('Delete this alert?')) return
    setAlerts(p => p.filter(x => x.id !== alert.id))
    showToast('Alert Deleted', 'Alert removed from list.')
  }


  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const ack = id => {
    setAlerts(p => p.map(a => a.id === id ? { ...a, ack: true } : a))
    showToast('Alert Acknowledged', 'Alert has been acknowledged.')
  }

  const handleReport = e => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (editId) {
      setAlerts(p => p.map(a => a.id === editId ? { ...a, ...form } : a))
      showToast('Alert Updated', `Alert "${form.title}" updated.`)
    } else {
      setAlerts(p => [{ ...form, id: Date.now(), time: new Date().toISOString().slice(0, 16).replace('T', ' '), ack: false }, ...p])
      showToast('Issue Reported', `Alert "${form.title}" created.`)
    }
    setEditId(null)
    setModal(false)
  }

  const filtered = filter === 'all' ? alerts : filter === 'unacked' ? alerts.filter(a => !a.ack) : alerts.filter(a => a.type === filter)

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Alerts & Reports"
        sub={`${alerts.filter(a => !a.ack).length} unacknowledged alerts`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Report Issue</button>
        )}
      />

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {[['all', 'All'], ['unacked', 'Unacknowledged'], ['critical', '🔴 Critical'], ['warning', '🟡 Warning'], ['info', '🔵 Info']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    filter === v
                      ? 'text-violet-400 border-violet-500 border-b-2'
                      : 'text-gray-400 border-gray-700 hover:text-white hover:border-gray-600'
                  }`}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">No alerts matching this filter</div>
        )}
        {filtered.map(a => {
          const at = ALERT_TYPES[a.type] || ALERT_TYPES.info
          return (
            <div key={a.id} className={`bg-gray-900 border rounded-xl p-4 transition-all ${a.ack ? 'border-gray-800 opacity-60' : 'border-gray-700'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{at.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-white">{a.title}</span>
                    <Badge color={at.badge}>{a.type}</Badge>
                    <Badge color="gray">{a.category}</Badge>
                    <Badge color="violet">{a.line}</Badge>
                    {a.ack && <Badge color="gray">Acknowledged</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">{a.msg}</p>
                  <p className="text-xs text-gray-600 mt-1">{a.time}</p>
                </div>
                {!a.ack && canEdit && (
                  <button onClick={() => ack(a.id)}
                          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors shrink-0">
                    Acknowledge
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => openEdit(a)}
                          className="text-xs px-3 py-1.5 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0">
                    Edit
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => deleteAlert(a)}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={modal} title={editId ? 'Edit Alert' : 'Report Issue'} onClose={() => setModal(false)}>
        <form onSubmit={handleReport} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Alert Type">
              <select className="input-field" value={form.type} onChange={set('type')}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Category">
              <select className="input-field" value={form.category} onChange={set('category')}>
                {['production', 'equipment', 'quality', 'maintenance', 'safety'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Production Line">
              <select className="input-field" value={form.line} onChange={set('line')}>
                {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Issue Title" required>
            <input className="input-field" value={form.title} onChange={set('title')} placeholder="Brief description of the issue" />
          </Field>
          <Field label="Details">
            <textarea className="input-field resize-none" rows={3} value={form.msg} onChange={set('msg')} placeholder="Full description…" />
          </Field>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Alert' : 'Submit Report'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Cost Tracking ─────────────────────────────────
function CostTracking({ canViewCosts }) {
  if (!canViewCosts) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
             style={{ background: 'rgba(var(--purple-rgb),0.1)' }}>🔒</div>
        <h3 className="text-base font-semibold text-white mb-2">Access Restricted</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Cost tracking is available to Finance, Management, and Admin roles only.
          Contact your administrator if you need access.
        </p>
      </div>
    )
  }

  const costRows = USE_SEED_DATA ? COST_DATA : []
  const totalBudget = costRows.reduce((s, c) => s + c.budget, 0)
  const totalActual = costRows.reduce((s, c) => s + c.actual, 0)
  const totalVar = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <SectionHeader title="Cost Tracking" sub={USE_SEED_DATA ? 'April 2026 — Budget vs. Actual' : 'Budget vs. actual (connect data)'} />

      {!USE_SEED_DATA ? (
        <p className="text-sm text-gray-500">No cost data loaded. Demo cost rows are available only with VITE_ENABLE_SEED_DATA=true in local dev.</p>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon="📊" label="Total Budget"  value={`$${(totalBudget/1000).toFixed(0)}K`} color="var(--purple)" />
        <StatCard icon="💵" label="Total Actual"  value={`$${(totalActual/1000).toFixed(0)}K`} color={totalActual > totalBudget ? '#ef4444' : '#22c55e'} />
        <StatCard icon="📉" label="Variance"      value={`${parseFloat(totalVar) >= 0 ? '+' : ''}${totalVar}%`} color={parseFloat(totalVar) > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Budget Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/30">
              {['Category', 'Budget', 'Actual', 'Variance', 'Usage'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {costRows.map(c => {
              const varPct = c.variance
              const usagePct = Math.round((c.actual / c.budget) * 100)
              return (
                <tr key={c.category} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-white">{c.category}</td>
                  <td className="px-5 py-3.5 text-gray-400">${c.budget.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-white">${c.actual.toLocaleString()}</td>
                  <td className={`px-5 py-3.5 font-medium ${varPct > 5 ? 'text-red-400' : varPct < -3 ? 'text-green-400' : 'text-gray-400'}`}>
                    {varPct > 0 ? '+' : ''}{varPct}%
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                             style={{ width: `${Math.min(100, usagePct)}%`,
                                      background: usagePct > 105 ? '#ef4444' : usagePct > 95 ? '#eab308' : '#22c55e' }} />
                      </div>
                      <span className="text-xs text-gray-400">{usagePct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/20">
              <td className="px-5 py-3.5 font-semibold text-white">Total</td>
              <td className="px-5 py-3.5 font-semibold text-gray-300">${totalBudget.toLocaleString()}</td>
              <td className="px-5 py-3.5 font-semibold text-white">${totalActual.toLocaleString()}</td>
              <td className={`px-5 py-3.5 font-semibold ${parseFloat(totalVar) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {parseFloat(totalVar) >= 0 ? '+' : ''}{totalVar}%
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                         style={{ width: `${Math.min(100, Math.round((totalActual / totalBudget) * 100))}%`,
                                  background: totalActual > totalBudget ? '#ef4444' : '#22c55e' }} />
                  </div>
                  <span className="text-xs text-gray-400">{Math.round((totalActual / totalBudget) * 100)}%</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cost Per Unit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { product: 'Gold Bar 99.99%', cost: '$18.40', target: '$17.50', variance: '+5.1%', bad: true },
          { product: 'Silver Grain 99.9%', cost: '$2.14', target: '$2.20', variance: '-2.7%', bad: false },
          { product: 'Alloy Rod 14K', cost: '$4.82', target: '$5.00', variance: '-3.6%', bad: false },
          { product: 'Ring Blank Set', cost: '$9.15', target: '$8.90', variance: '+2.8%', bad: true },
        ].map(item => (
          <div key={item.product} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-1">{item.product}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Cost/Unit</p>
                <p className="text-lg font-bold text-white">{item.cost}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-sm text-gray-400">{item.target}</p>
              </div>
              <span className={`text-sm font-semibold ${item.bad ? 'text-red-400' : 'text-green-400'}`}>{item.variance}</span>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}

// ── Notifications Panel ───────────────────────────
function NotificationsPanel({ open, onClose, notifications, onAcknowledge, onEscalate, onDismiss, onMarkAllRead, onClearRead, filter, onFilterChange }) {
  const unread = notifications.filter(n => !n.read).length
  const filtered = (() => {
    if (filter === 'unread')  return notifications.filter(n => !n.read)
    if (filter === 'crit')    return notifications.filter(n => n.level === 'crit')
    if (filter === 'high')    return notifications.filter(n => n.level === 'high')
    if (filter === 'med')     return notifications.filter(n => n.level === 'med')
    if (filter === 'info')    return notifications.filter(n => ['info', 'success'].includes(n.level))
    return notifications
  })()

  return (
    <>
      <div className={`notif-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`notif-panel ${open ? 'open' : ''}`}>
        <div className="np-header">
          <div className="np-title">
            🔔 Notifications
            {unread > 0 && <span className="np-title-badge">{unread} new</span>}
          </div>
          <button className="np-close" onClick={onClose}>✕</button>
        </div>

        <div className="np-filters">
          {[
            { key: 'all',    label: `All (${notifications.length})` },
            { key: 'unread', label: `Unread (${unread})` },
            { key: 'crit',   label: '🔴 Critical' },
            { key: 'high',   label: '🟠 High' },
            { key: 'med',    label: '🟡 Medium' },
            { key: 'info',   label: '🔵 Info' },
          ].map(f => (
            <button key={f.key} className={`np-filter-btn ${filter === f.key ? 'active' : ''}`}
                    onClick={() => onFilterChange(f.key)}>{f.label}</button>
          ))}
        </div>

        <div className="np-body">
          {filtered.length === 0 ? (
            <div className="np-empty">
              <div className="np-empty-icon">🔕</div>
              <div>No notifications</div>
            </div>
          ) : filtered.map(n => (
            <div key={n.id} className={`np-item ${n.level} ${n.read ? 'read' : ''}`}>
              <div className="np-item-head">
                <div className="np-item-title">{n.title}</div>
                <div className="np-item-time">{n.time}</div>
              </div>
              <div className="np-item-desc">{n.desc}</div>
              <div className="np-item-meta">📍 {n.meta}</div>
              <div className="np-item-actions">
                {!n.read && (
                  <button className="np-action-btn np-btn-ack" onClick={() => onAcknowledge(n.id)}>
                    ✓ Acknowledge
                  </button>
                )}
                {(n.level === 'crit' || n.level === 'high') && !n.acked && (
                  <button className="np-action-btn np-btn-esc" onClick={() => onEscalate(n.id)}>
                    ↑ Escalate
                  </button>
                )}
                <button className="np-action-btn np-btn-dis" onClick={() => onDismiss(n.id)}>
                  × Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="np-footer">
          <button className="np-footer-btn pri" onClick={onMarkAllRead}>✓ Mark all read</button>
          <button className="np-footer-btn sec" onClick={onClearRead}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────
export default function ProductionTab() {
  const { user, company } = useAuth()
  const { isSuperAdmin, isManagement, isDepartmentHead, isReadOnly } = usePermissions()
  const { t } = useLanguage()
  const SUB_TABS = useMemo(() => getProductionTabs(t), [t])
  const allowedSubIds = useMemo(() => SUB_TABS.map((tab) => tab.id), [SUB_TABS])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'production',
    allowedSubIds,
    'kpi',
    company,
  )

  const [toast, setToast] = useState(null)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [notifications, setNotifications] = useState(USE_SEED_DATA ? NOTIFICATIONS_DATA : [])
  const [notifFilter, setNotifFilter]     = useState('all')

  // Edit access: super_admin and department_head can edit all production modules.
  // department_user can edit most operational tabs but not KPI/Cost.
  const deptUserEditableTabs = ['monitor', 'equipment', 'maintenance', 'quality', 'shifts', 'planning', 'alerts']
  const canEdit = isSuperAdmin || isDepartmentHead || (user?.role === 'department_user' && deptUserEditableTabs.includes(activeTab))
  // Cost Tracking: only super_admin and management (finance/exec level)
  const canViewCosts = isSuperAdmin || isManagement

  // Map dashboard role → production notification roles
  const prodRoles = isSuperAdmin ? null
    : isManagement   ? ['superadmin', 'prod_mgr', 'finance']
    : isDepartmentHead ? ['superadmin', 'prod_mgr', 'shift_sup']
    : ['operator', 'shift_sup', 'quality', 'maint_eng']

  const roleNotifs   = prodRoles === null ? notifications : notifications.filter(n => n.roles.some(r => prodRoles.includes(r)))
  const unreadCount  = roleNotifs.filter(n => !n.read).length

  const acknowledgeNotif = id => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true, acked: true } : n))
  const dismissNotif     = id => setNotifications(p => p.filter(n => n.id !== id))
  const escalateNotif    = id => {
    acknowledgeNotif(id)
    showToast('Alert Escalated', 'Notification escalated to Production Manager.')
  }

  const showToast = (title, msg) => {
    setToast({ title, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const renderTab = () => {
    const props = { canEdit, showToast }
    switch (activeTab) {
      case 'kpi':         return <KPIOverview />
      case 'monitor':     return <LiveMonitor {...props} />
      case 'equipment':   return <Equipment {...props} />
      case 'maintenance': return <Maintenance {...props} />
      case 'quality':     return <QualityControl {...props} />
      case 'shifts':      return <ShiftManagement {...props} />
      case 'planning':    return <Planning {...props} />
      case 'alerts':      return <AlertsReports {...props} />
      case 'costs':       return <CostTracking canViewCosts={canViewCosts} />
      default:            return null
    }
  }

  return (
    <>
    <ModuleTabColumn>
      <ModulePageHeading
        title="Production Control Center"
        subtitle={`${linesForUi.filter((l) => l.state === 'running').length} lines running${USE_SEED_DATA ? ` · ${DEFAULT_ALERTS.filter((a) => !a.ack).length} active alerts` : ''}`}
        right={(
          <div className="flex items-center gap-3">
            {isReadOnly && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs font-medium">
                🔒 Read-only view
              </div>
            )}
            <div className="notif-bell" onClick={() => setNotifOpen(true)} title={`${unreadCount} unread notifications`}>
              🔔
              {unreadCount > 0 && (
                <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </div>
          </div>
        )}
      />

      <ModuleSubTabRow>
        {SUB_TABS.map((tab) => (
          <ErpSubTabButton
            key={tab.id}
            active={activeTab === tab.id}
            href={buildSubHref(tab.id)}
            onClick={(event) => handleSubTabClick(tab.id, event)}
          >
            {tab.label}
          </ErpSubTabButton>
        ))}
      </ModuleSubTabRow>

      <div className="min-h-[400px]">
        {renderTab()}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </ModuleTabColumn>

    <NotificationsPanel
      open={notifOpen}
      onClose={() => setNotifOpen(false)}
      notifications={roleNotifs}
      onAcknowledge={acknowledgeNotif}
      onEscalate={escalateNotif}
      onDismiss={dismissNotif}
      onMarkAllRead={() => setNotifications(p => p.map(n => ({ ...n, read: true })))}
      onClearRead={() => setNotifications(p => p.filter(n => !n.read))}
      filter={notifFilter}
      onFilterChange={setNotifFilter}
    />
    </>
  )
}
