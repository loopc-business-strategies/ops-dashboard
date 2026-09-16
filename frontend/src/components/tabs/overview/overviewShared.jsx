import { isPrimaryNavClick } from '../../../utils/dashboardNavigation'

export const DEPT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'hr', label: 'HR' },
  { value: 'government', label: 'Compliance' },
  { value: 'training', label: 'Training' },
]

export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', tone: 'text-gray-800 border-gray-300 bg-gray-100' },
  { value: 'medium', label: 'Medium', tone: 'text-yellow-900 border-yellow-300 bg-yellow-100' },
  { value: 'high', label: 'High', tone: 'text-red-800 border-red-300 bg-red-100' },
  { value: 'critical', label: 'Critical', tone: 'text-red-900 border-red-300 bg-red-100' },
]

export const TAB_BY_DEPT = {
  production: 'production',
  finance: 'finance',
  sales: 'sales',
  operations: 'operations',
  hr: 'hr',
  government: 'compliance',
  training: 'training',
}

export const QUICK_ACTIONS = {
  super_admin: ['Add Task', 'Create Voucher', 'Add Lead', 'Log Expense', 'Add Supplier', 'Add Customer', 'Add Employee', 'Open Production', 'Owner Exceptions', 'Generate Report', 'Global Search', 'Open Messages'],
  management: ['Owner Exceptions', 'Generate Report', 'Global Search', 'Open Production', 'Open Messages'],
  department_head: ['Add Task', 'Generate Report', 'Global Search', 'Open Production', 'Owner Exceptions', 'Open Messages'],
  department_user: ['Add Task', 'Global Search', 'Open Messages'],
  external: ['Global Search'],
}

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export function fmtDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function statusLabel(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}

export function priorityTone(priority) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.tone || PRIORITY_OPTIONS[1].tone
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

export function taskAssignedToCurrentUser(task, userId, userName) {
  const uid = userId != null ? String(userId) : ''
  const nameLow = (userName || '').toLowerCase()
  const idList =
    Array.isArray(task.assignedToIds) && task.assignedToIds.length ? task.assignedToIds.map((x) => String(x)) : []
  if (uid && idList.includes(uid)) return true
  if (uid && task.assignedToId && String(task.assignedToId) === uid) return true
  if (nameLow && String(task.assignedTo || '').toLowerCase() === nameLow) return true
  return false
}

export function getSeverityTone(severity) {
  if (severity === 'critical') return 'text-red-800 border-red-300 bg-red-100'
  if (severity === 'high') return 'text-orange-800 border-orange-300 bg-orange-100'
  return 'text-yellow-800 border-yellow-300 bg-yellow-100'
}

export function TabNavLink({ tabId, options, buildTabHref, onNavigate, className, style, children }) {
  const href = buildTabHref?.(tabId, options) || '#'
  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        if (!isPrimaryNavClick(event)) return
        event.preventDefault()
        onNavigate?.(tabId, options)
      }}
    >
      {children}
    </a>
  )
}

export function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2.5 text-xs rounded-lg border ${active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
    >
      {children}
    </button>
  )
}

export function KpiCard({ title, value, hint, onClick, href, loading }) {
  const cardClass = `h-full min-h-[88px] text-left bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-col justify-center transition-colors ${onClick || href ? 'hover:border-gray-300' : 'cursor-default'}`
  const content = (
    <>
      <p className="text-[11px] text-gray-500 tracking-[0.08em] uppercase">{title}</p>
      <p className="text-[28px] leading-tight font-semibold text-gray-900 mt-1 tabular-nums">
        {loading ? '—' : value}
      </p>
      {hint ? <p className="text-xs text-gray-600 mt-1">{hint}</p> : null}
    </>
  )

  if (href) {
    return (
      <a href={href} onClick={onClick} className={`${cardClass} block no-underline text-inherit`}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cardClass} disabled={!onClick}>
      {content}
    </button>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-gray-900">{title}</h2>
        {action ? <div className="w-full sm:w-auto flex flex-wrap justify-start sm:justify-end gap-1.5">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function EmptyPanel({ title, message }) {
  return (
    <div className="rounded-md px-1 py-3">
      <p className="text-sm font-medium text-gray-800">{title}</p>
      {message ? <p className="text-xs text-gray-500 mt-0.5">{message}</p> : null}
    </div>
  )
}

export function ErrorPanel({ title = 'Unable to load data', message = 'Please try again.', onRetry }) {
  return (
    <div className="rounded-md px-1 py-3">
      <p className="text-sm font-medium text-red-900">{title}</p>
      <p className="text-xs text-red-700 mt-0.5">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-2">
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function LoadingPanel({ label = 'Loading…' }) {
  return (
    <div className="px-1 py-3 text-sm text-gray-500" aria-busy="true">
      {label}
    </div>
  )
}
