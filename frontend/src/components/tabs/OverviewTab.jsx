import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import tasksAPI from '../../api/tasks'
import authAPI from '../../api/auth'
import hrAPI from '../../api/hr'
import attendanceAPI from '../../api/attendance'
import messagesAPI from '../../api/messages'

const overviewConfig = {
  super_admin: 'executive_dashboard',
  management: 'executive_readonly',
  department_head: 'dept_dashboard',
  department_user: 'personal_dashboard',
  external: 'partner_dashboard',
}

const DEPT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'hr', label: 'HR' },
  { value: 'government', label: 'Compliance' },
  { value: 'training', label: 'Training' },
]

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', tone: 'text-gray-300 border-gray-700 bg-gray-800/70' },
  { value: 'medium', label: 'Medium', tone: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' },
  { value: 'high', label: 'High', tone: 'text-red-300 border-red-500/30 bg-red-500/10' },
  { value: 'critical', label: 'Critical', tone: 'text-red-200 border-red-500/40 bg-red-600/20' },
]

const TAB_BY_DEPT = {
  production: 'production',
  finance: 'finance',
  sales: 'sales',
  operations: 'operations',
  hr: 'hr',
  government: 'compliance',
  training: 'training',
}

const QUICK_ACTIONS = {
  super_admin: ['Add Task', 'Add Lead', 'Log Expense', 'Add Supplier', 'Schedule Meeting', 'Add Employee', 'Create Invoice', 'Log Incident', 'Generate Report', 'Global Search'],
  management: ['Generate Report', 'Global Search'],
  department_head: ['Add Task', 'Generate Report', 'Schedule Meeting'],
  department_user: ['Add Task', 'Global Search'],
  external: ['Global Search'],
}

const STATIC_ALERTS = [
  { id: 'a1', severity: 'critical', text: 'Line-C vibration spike above threshold', dept: 'production', age: '2 hrs ago' },
  { id: 'a2', severity: 'critical', text: 'Quality sample mismatch on Line-B', dept: 'production', age: '3 hrs ago' },
  { id: 'a3', severity: 'high', text: 'Hydraulic pressure calibration overdue', dept: 'production', age: 'Due Apr 17, 2026' },
  { id: 'a4', severity: 'medium', text: 'SecureLine contract expiring in 30 days', dept: 'operations', age: 'Expiry Nov 09, 2026' },
  { id: 'a5', severity: 'medium', text: 'Invoice INV-042 overdue by 8 days', dept: 'finance', age: 'Mercury Metals - $84,000' },
]

const FALLBACK_LEAVE_REQUESTS = [
  { id: 'l1', name: 'Jane Smith', dept: 'hr', dates: 'Apr 15-16', days: 2, reason: 'Medical', age: '1 day ago' },
  { id: 'l2', name: 'Tariq Khan', dept: 'sales', dates: 'Apr 20-22', days: 3, reason: 'Personal', age: '3 hrs ago' },
]

const FALLBACK_LATEST_MESSAGES = [
  { id: 'm1', type: 'group', room: 'All Departments', sender: 'John Doe', text: 'Maintenance task completed on Line-B.', ago: '2 min' },
  { id: 'm2', type: 'dm', room: 'Anna Reed', sender: 'Anna Reed', text: 'I shared the contract draft update.', ago: '15 min' },
  { id: 'm3', type: 'group', room: 'Sales Team', sender: 'Tariq Khan', text: 'Partner call moved to tomorrow morning.', ago: '1 hr' },
]

const DEFAULT_TASK_FORM = {
  title: '',
  description: '',
  department: 'sales',
  module: 'General',
  assignedToId: '',
  assignedTo: '',
  priority: 'high',
  status: 'todo',
  dueDate: '',
  linkedRecord: '',
  notifyText: '',
  alsoNotify: [],
}

const DEPT_STATUS = {
  healthy: 'border-green-500/40',
  attention: 'border-yellow-500/40',
  critical: 'border-red-500/40',
}

const DEMO_DEPT_METRICS = [
  { dept: 'production', title: 'PRODUCTION', status: 'healthy', line1: 'OEE: 91%', line2: '4 lines active', line3: '1 active alert' },
  { dept: 'finance', title: 'FINANCE', status: 'healthy', line1: 'Revenue: $2.45M', line2: 'Profit: $1.13M', line3: 'Cash flow: $890K' },
  { dept: 'sales', title: 'SALES', status: 'healthy', line1: 'Pipeline: 6', line2: 'Deals closed: 2', line3: 'Conv rate: 29%' },
  { dept: 'government', title: 'COMPLIANCE', status: 'attention', line1: 'Score: 87%', line2: '3 frameworks done', line3: 'SOC2 pending' },
  { dept: 'operations', title: 'OPERATIONS', status: 'critical', line1: 'Readiness: 9%', line2: '3 suppliers', line3: '2 routes active' },
  { dept: 'hr', title: 'HR', status: 'healthy', line1: 'Staff: 225', line2: 'Present: 198/225', line3: '2 leaves pending' },
]

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function fmtDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}

function priorityTone(priority) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.tone || PRIORITY_OPTIONS[1].tone
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function hashNumber(input = '') {
  let h = 0
  for (let i = 0; i < input.length; i += 1) h = (h << 5) - h + input.charCodeAt(i)
  return Math.abs(h)
}

function attendanceOf(name = '') {
  const n = hashNumber(name) % 10
  if (n <= 5) return { status: 'present', checkIn: '08:55 AM', shift: 'Shift 1' }
  if (n === 6) return { status: 'late', checkIn: '09:20 AM', shift: 'Shift 1' }
  if (n === 7) return { status: 'leave', checkIn: '-', shift: '-' }
  if (n === 8) return { status: 'wfh', checkIn: '08:40 AM', shift: '-' }
  return { status: 'absent', checkIn: '-', shift: 'Shift 1' }
}

function roleQuickCreates(role) {
  if (role === 'super_admin') {
    return ['New Task', 'New Employee', 'New Invoice', 'New Lead', 'New Maintenance Task', 'New Compliance Issue', 'New Announcement']
  }
  if (role === 'department_head') {
    return ['New Task', 'New Announcement']
  }
  return []
}

function getSeverityTone(severity) {
  if (severity === 'critical') return 'text-red-300 border-red-500/40 bg-red-600/10'
  if (severity === 'high') return 'text-orange-300 border-orange-500/30 bg-orange-500/10'
  return 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
}

function KpiCard({ title, value, hint, tone = 'green', onClick, readOnly }) {
  const borderClass = tone === 'red' ? 'border-red-500/40' : tone === 'yellow' ? 'border-yellow-500/40' : 'border-emerald-500/40'
  return (
    <button
      onClick={onClick}
      className={`text-left bg-gray-950 border rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${borderClass} ${onClick ? '' : 'cursor-default'}`}
      style={{ borderTopWidth: 2 }}
      disabled={!onClick}
    >
      <p className="text-xs text-gray-400 tracking-wider uppercase">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}{readOnly ? ' - read only' : ''}</p>
    </button>
  )
}

function Section({ title, action, children }) {
  return (
    <section className="bg-gray-950 border border-gray-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm sm:text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function OverviewTab({ onNavigate }) {
  const { user, token } = useAuth()
  const perms = usePermissions()

  const [tasks, setTasks] = useState([])
  const [assignees, setAssignees] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [taskView, setTaskView] = useState('list')
  const [taskFilter, setTaskFilter] = useState('all')
  const [taskDeptFilter, setTaskDeptFilter] = useState('all')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
  const [taskAssignedFilter, setTaskAssignedFilter] = useState('any')
  const [taskSearch, setTaskSearch] = useState('')
  const [expandedTaskId, setExpandedTaskId] = useState('')
  const [showTaskCreate, setShowTaskCreate] = useState(false)
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM)
  const [commentText, setCommentText] = useState({})
  const [toast, setToast] = useState('')
  const [messageFilter, setMessageFilter] = useState('all')
  const [latestMessages, setLatestMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [attendanceRowsApi, setAttendanceRowsApi] = useState([])
  const [attendanceByDeptApi, setAttendanceByDeptApi] = useState([])
  const [attendanceSummaryApi, setAttendanceSummaryApi] = useState(null)
  const [myAttendance, setMyAttendance] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', leaveType: 'personal', reason: '' })
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('all')
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('all')
  const [attendanceSearch, setAttendanceSearch] = useState('')

  const role = user?.role || 'department_user'
  const roleView = overviewConfig[role] || overviewConfig.department_user
  const today = new Date()

  const canCreateTasks = perms.isSuperAdmin || perms.isDepartmentHead
  const isReadOnlyExec = perms.isManagement
  const isPersonalView = perms.isDepartmentUser
  const canViewExecutiveCharts = perms.isSuperAdmin || perms.isManagement

  const showToast = (msg) => {
    setToast(msg)
    window.clearTimeout(window.__overviewToastTimer)
    window.__overviewToastTimer = window.setTimeout(() => setToast(''), 2500)
  }

  const loadTasks = async () => {
    setLoadingTasks(true)
    try {
      const data = await tasksAPI.getTasks(token)
      setTasks(data.tasks || [])
    } catch {
      setTasks([])
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadAssigneesAndEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const [usersRes, employeesRes] = await Promise.allSettled([
        authAPI.getUsers(token),
        hrAPI.getEmployees(token),
      ])

      const userList = usersRes.status === 'fulfilled' ? (usersRes.value.users || []).map((u) => ({ id: u.id || u._id, name: u.name, department: u.department || '' })) : []
      const employeeList = employeesRes.status === 'fulfilled' ? (employeesRes.value.employees || []).map((e) => ({ id: e._id, name: e.name, department: e.department || '' })) : []

      const taskNames = Array.from(new Set(tasks.map((t) => t.assignedTo).filter(Boolean))).map((name) => ({ id: name, name, department: '' }))

      const merged = [...userList, ...employeeList, ...taskNames]
      const uniqueByName = []
      const seen = new Set()
      merged.forEach((p) => {
        const key = (p.name || '').toLowerCase().trim()
        if (!key || seen.has(key)) return
        seen.add(key)
        uniqueByName.push(p)
      })

      setAssignees(uniqueByName)
      setEmployees(employeeList)
    } catch {
      setAssignees([])
      setEmployees([])
    } finally {
      setLoadingEmployees(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [token])

  useEffect(() => {
    loadAssigneesAndEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tasks.length])

  const loadAttendanceAndMessages = async () => {
    try {
      const [summaryRes, meRes, leaveRes, messagesRes] = await Promise.allSettled([
        attendanceAPI.getSummary(token),
        attendanceAPI.getMyAttendance(token),
        attendanceAPI.getLeaveRequests(token),
        messagesAPI.getLatestMessages(token, 'all', 30),
      ])

      if (summaryRes.status === 'fulfilled') {
        setAttendanceRowsApi(summaryRes.value.rows || [])
        setAttendanceByDeptApi(summaryRes.value.byDepartment || [])
        setAttendanceSummaryApi(summaryRes.value.summary || null)
      }

      if (meRes.status === 'fulfilled') {
        setMyAttendance(meRes.value.me || null)
      }

      if (leaveRes.status === 'fulfilled') {
        setLeaveRequests(leaveRes.value.requests || [])
      }

      if (messagesRes.status === 'fulfilled') {
        const rows = (messagesRes.value.messages || []).map((m) => ({
          id: m._id,
          type: m.type,
          room: m.room,
          sender: m.senderName,
          text: m.text,
          ago: fmtDateTime(m.createdAt),
        }))
        setLatestMessages(rows)
      }
    } catch {
      // Keep UI fallback values if APIs fail.
    }
  }

  useEffect(() => {
    if (!token) return
    loadAttendanceAndMessages()
    const id = window.setInterval(() => {
      loadAttendanceAndMessages()
    }, 20000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const scopedTasks = useMemo(() => {
    if (perms.isSuperAdmin || perms.isManagement) return tasks
    if (perms.isDepartmentHead) return tasks.filter((t) => (t.department || '').toLowerCase() === (user?.department || '').toLowerCase())
    if (perms.isDepartmentUser) return tasks.filter((t) => t.assignedToId === user?.id || (t.assignedTo || '').toLowerCase() === (user?.name || '').toLowerCase())
    if (perms.isExternal) return tasks.filter((t) => (user?.allowedModules || []).includes(t.department))
    return []
  }, [tasks, perms.isSuperAdmin, perms.isManagement, perms.isDepartmentHead, perms.isDepartmentUser, perms.isExternal, user?.department, user?.id, user?.name, user?.allowedModules])

  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const taskStats = useMemo(() => {
    const source = scopedTasks
    const mine = source.filter((t) => t.assignedToId === user?.id || (t.assignedTo || '').toLowerCase() === (user?.name || '').toLowerCase())
    const overdue = source.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
    const dueToday = source.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== 'done')
    const completed = source.filter((t) => t.status === 'done')
    const updated = source.filter((t) => t.updatedAt && (Date.now() - new Date(t.updatedAt).getTime()) <= 24 * 60 * 60 * 1000)
    return {
      total: source.length,
      mine: mine.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completed: completed.length,
      updated: updated.length,
    }
  }, [scopedTasks, user?.id, user?.name, todayStart, todayEnd])

  const filteredTasks = useMemo(() => {
    let list = [...scopedTasks]

    if (taskFilter === 'my') list = list.filter((t) => t.assignedToId === user?.id || (t.assignedTo || '').toLowerCase() === (user?.name || '').toLowerCase())
    if (taskFilter === 'overdue') list = list.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
    if (taskFilter === 'due-today') list = list.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== 'done')
    if (taskFilter === 'this-week') {
      const weekEnd = new Date(todayStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      list = list.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= weekEnd)
    }

    if (taskDeptFilter !== 'all') list = list.filter((t) => t.department === taskDeptFilter)
    if (taskPriorityFilter !== 'all') list = list.filter((t) => t.priority === taskPriorityFilter)
    if (taskAssignedFilter !== 'any') list = list.filter((t) => (t.assignedTo || '').toLowerCase() === taskAssignedFilter.toLowerCase())
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase()
      list = list.filter((t) =>
        [t.title, t.description, t.module, t.linkedRecord, t.assignedTo].join(' ').toLowerCase().includes(q)
      )
    }

    return list.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return new Date(b.updatedAt) - new Date(a.updatedAt)
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate) - new Date(b.dueDate)
    })
  }, [scopedTasks, taskFilter, taskDeptFilter, taskPriorityFilter, taskAssignedFilter, taskSearch, user?.id, user?.name, todayStart, todayEnd])

  const attendanceRows = useMemo(() => {
    if (attendanceRowsApi.length) return attendanceRowsApi

    const source = employees.length ? employees : [
      { id: 's1', name: 'Alice Brown', department: 'finance' },
      { id: 's2', name: 'Bob Johnson', department: 'management' },
      { id: 's3', name: 'Charlie Wilson', department: 'sales' },
      { id: 's4', name: 'John Doe', department: 'production' },
      { id: 's5', name: 'Jane Smith', department: 'hr' },
      { id: 's6', name: 'Tariq Khan', department: 'sales' },
      { id: 's7', name: 'Anna Reed', department: 'sales' },
    ]

    return source.map((e) => ({ ...e, ...attendanceOf(e.name) }))
  }, [attendanceRowsApi, employees])

  const attendanceScopedRows = useMemo(() => {
    if (perms.isSuperAdmin || perms.isManagement || ((user?.department || '').toLowerCase() === 'hr')) return attendanceRows
    if (perms.isDepartmentHead) return attendanceRows.filter((r) => (r.department || '').toLowerCase() === (user?.department || '').toLowerCase())
    if (perms.isDepartmentUser || perms.isExternal) {
      return attendanceRows.filter((r) => (r.name || '').toLowerCase() === (user?.name || '').toLowerCase())
    }
    return attendanceRows
  }, [attendanceRows, perms.isSuperAdmin, perms.isManagement, perms.isDepartmentHead, perms.isDepartmentUser, perms.isExternal, user?.department, user?.name])

  const attendanceFilteredRows = useMemo(() => {
    return attendanceScopedRows.filter((r) => {
      const deptOk = attendanceDeptFilter === 'all' ? true : (r.department || '').toLowerCase() === attendanceDeptFilter
      const statusOk = attendanceStatusFilter === 'all' ? true : r.status === attendanceStatusFilter
      const searchOk = attendanceSearch.trim() ? (r.name || '').toLowerCase().includes(attendanceSearch.trim().toLowerCase()) : true
      return deptOk && statusOk && searchOk
    })
  }, [attendanceScopedRows, attendanceDeptFilter, attendanceStatusFilter, attendanceSearch])

  const attendanceStats = useMemo(() => {
    if (attendanceSummaryApi) {
      return {
        total: attendanceSummaryApi.total || 1,
        present: attendanceSummaryApi.present || 0,
        absent: attendanceSummaryApi.absent || 0,
        onLeave: attendanceSummaryApi.onLeave || 0,
        late: attendanceSummaryApi.late || 0,
        percent: attendanceSummaryApi.percent || 0,
      }
    }

    const total = attendanceScopedRows.length || 1
    const present = attendanceScopedRows.filter((r) => r.status === 'present').length
    const absent = attendanceScopedRows.filter((r) => r.status === 'absent').length
    const onLeave = attendanceScopedRows.filter((r) => r.status === 'leave').length
    const late = attendanceScopedRows.filter((r) => r.status === 'late').length
    const percent = Math.round((present / total) * 100)
    return { total, present, absent, onLeave, late, percent }
  }, [attendanceScopedRows, attendanceSummaryApi])

  const deptAttendanceBars = useMemo(() => {
    const group = {}
    attendanceScopedRows.forEach((r) => {
      const key = (r.department || 'unknown').toLowerCase()
      if (!group[key]) group[key] = { present: 0, total: 0 }
      group[key].total += 1
      if (r.status === 'present' || r.status === 'late' || r.status === 'wfh') group[key].present += 1
    })

    return Object.entries(group).map(([dept, v]) => {
      const pct = v.total ? Math.round((v.present / v.total) * 100) : 0
      return { dept, ...v, pct }
    }).sort((a, b) => b.pct - a.pct)
  }, [attendanceScopedRows])

  const roleCreateOptions = roleQuickCreates(role)

  const executiveCards = useMemo(() => {
    const cards = [
      { id: 'revenue', title: 'Revenue', value: '$2.45M', hint: '12% YoY', tone: 'green', tab: 'finance' },
      { id: 'ops', title: 'Ops Readiness', value: '9%', hint: 'Needs action', tone: 'red', tab: 'operations' },
      { id: 'pipeline', title: 'Pipeline', value: '6 active', hint: 'Deals', tone: 'yellow', tab: 'sales' },
      { id: 'compliance', title: 'Compliance', value: '87%', hint: 'Score', tone: 'yellow', tab: 'compliance' },
      { id: 'production', title: 'Production', value: '8,520', hint: '91% healthy', tone: 'green', tab: 'production' },
      { id: 'alerts', title: 'Critical Alerts', value: `${STATIC_ALERTS.filter((a) => a.severity === 'critical').length}`, hint: 'Open', tone: 'red', tab: 'overview' },
      { id: 'employees', title: 'Employees', value: `${attendanceStats.total}`, hint: 'On roster', tone: 'green', tab: 'hr' },
      { id: 'approvals', title: 'Pending Approvals', value: '5', hint: 'Awaiting decisions', tone: 'yellow', tab: 'compliance' },
    ]

    if (perms.isDepartmentHead) return cards.filter((c) => ['ops', 'production', 'employees', 'alerts'].includes(c.id))
    if (perms.isDepartmentUser) {
      return [
        { id: 'my', title: 'My Tasks', value: `${taskStats.mine}`, hint: 'Assigned to me', tone: 'green', tab: 'overview' },
        { id: 'due', title: 'Due Today', value: `${taskStats.dueToday}`, hint: 'Act now', tone: 'yellow', tab: 'overview' },
        { id: 'overdue', title: 'Overdue', value: `${taskStats.overdue}`, hint: 'Need action', tone: 'red', tab: 'overview' },
        { id: 'done', title: 'Completed', value: `${taskStats.completed}`, hint: 'This week', tone: 'green', tab: 'overview' },
      ]
    }
    return cards
  }, [attendanceStats.total, perms.isDepartmentHead, perms.isDepartmentUser, taskStats.mine, taskStats.dueToday, taskStats.overdue, taskStats.completed])

  const visibleDeptMetrics = useMemo(() => {
    if (perms.isSuperAdmin || perms.isManagement) return DEMO_DEPT_METRICS
    if (perms.isDepartmentHead || perms.isDepartmentUser) return DEMO_DEPT_METRICS.filter((m) => m.dept === (user?.department || '').toLowerCase())
    if (perms.isExternal) return DEMO_DEPT_METRICS.filter((m) => (user?.allowedModules || []).includes(m.dept))
    return DEMO_DEPT_METRICS
  }, [perms.isSuperAdmin, perms.isManagement, perms.isDepartmentHead, perms.isDepartmentUser, perms.isExternal, user?.department, user?.allowedModules])

  const canUpdateTask = (task) => {
    if (perms.isManagement || perms.isExternal) return false
    if (perms.isSuperAdmin || perms.isDepartmentHead) return true
    const mine = task.assignedToId === user?.id || (task.assignedTo || '').toLowerCase() === (user?.name || '').toLowerCase()
    return perms.isDepartmentUser && mine
  }

  const onCreateTask = async () => {
    if (!taskForm.title.trim()) {
      showToast('Task title is required')
      return
    }

    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        assignedToId: taskForm.assignedToId || undefined,
        assignedTo: taskForm.assignedTo || undefined,
        department: taskForm.department,
        module: taskForm.module,
        linkedRecord: taskForm.linkedRecord,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
      }

      await tasksAPI.createTask(token, payload)
      await loadTasks()
      setShowTaskCreate(false)
      setTaskForm(DEFAULT_TASK_FORM)

      const assignee = taskForm.assignedTo || 'assignee'
      const notifyCount = taskForm.alsoNotify.length
      showToast(`Task created and ${assignee} notified${notifyCount ? ` (+${notifyCount})` : ''}`)
    } catch {
      showToast('Failed to create task')
    }
  }

  const onTaskStatusChange = async (task, status) => {
    try {
      await tasksAPI.updateTask(token, task._id, { status })
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)))
      showToast('Task status updated')
    } catch {
      showToast('Unable to update task status')
    }
  }

  const onTaskMarkDone = async (task) => {
    await onTaskStatusChange(task, 'done')
  }

  const onTaskComment = async (task) => {
    const text = (commentText[task._id] || '').trim()
    if (!text) return
    try {
      await tasksAPI.addComment(token, task._id, text)
      setCommentText((prev) => ({ ...prev, [task._id]: '' }))
      await loadTasks()
      showToast('Message added to task')
    } catch {
      showToast('Failed to post message')
    }
  }

  const onQuickAction = (name) => {
    const lower = name.toLowerCase()
    if (lower.includes('task')) {
      setShowTaskCreate(true)
      return
    }
    if (lower.includes('employee')) {
      onNavigate?.('hr')
      return
    }
    if (lower.includes('invoice') || lower.includes('expense')) {
      onNavigate?.('finance')
      return
    }
    if (lower.includes('supplier')) {
      onNavigate?.('erp')
      return
    }
    if (lower.includes('lead') || lower.includes('meeting')) {
      onNavigate?.('sales')
      return
    }
    if (lower.includes('incident')) {
      onNavigate?.('operations')
      return
    }
    showToast(`${name} opened`)
  }

  const latestFeed = useMemo(() => {
    const taskEvents = scopedTasks
      .slice(0, 6)
      .map((t) => ({
        id: `task-${t._id}`,
        text: `${t.assignedTo || 'Team'} updated ${t.title}`,
        dept: t.department || 'general',
        time: t.updatedAt,
      }))

    const staticFeed = [
      { id: 'f1', text: 'Invoice INV-043 sent to Gulf Secure Trade', dept: 'finance', time: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { id: 'f2', text: 'New trainee enrolled: Batch A', dept: 'training', time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 'f3', text: 'ISO 9001 audit scheduled for May 2026', dept: 'government', time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    ]

    return [...taskEvents, ...staticFeed].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)
  }, [scopedTasks])

  const deadlineRows = useMemo(() => {
    const base = [
      { id: 'd1', when: 'TODAY', text: 'Follow-up call - South Africa', dept: 'sales' },
      { id: 'd2', when: 'APR 15', text: 'Proposal to Nigeria partner', dept: 'sales' },
      { id: 'd3', when: 'APR 19', text: 'Sensor replacement - Line-A', dept: 'production' },
      { id: 'd4', when: 'APR 22', text: 'Quarterly tax filing deadline', dept: 'finance' },
    ]

    const taskDeadlines = scopedTasks
      .filter((t) => t.dueDate)
      .slice(0, 6)
      .map((t) => ({ id: `td-${t._id}`, when: fmtDate(t.dueDate), text: t.title, dept: t.department || 'general' }))

    return [...taskDeadlines, ...base].slice(0, 10)
  }, [scopedTasks])

  const alertRows = useMemo(() => {
    const byRole = perms.isSuperAdmin || perms.isManagement
      ? STATIC_ALERTS
      : perms.isDepartmentHead
      ? STATIC_ALERTS.filter((a) => a.dept === (user?.department || '').toLowerCase())
      : perms.isDepartmentUser
      ? STATIC_ALERTS.filter((a) => a.dept === (user?.department || '').toLowerCase()).slice(0, 2)
      : STATIC_ALERTS

    const taskOverdues = scopedTasks
      .filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
      .slice(0, 3)
      .map((t) => ({ id: `ot-${t._id}`, severity: 'high', text: `${t.title} overdue`, dept: t.department || 'general', age: fmtDate(t.dueDate) }))

    return [...taskOverdues, ...byRole].slice(0, 7)
  }, [perms.isSuperAdmin, perms.isManagement, perms.isDepartmentHead, perms.isDepartmentUser, scopedTasks, user?.department, todayStart])

  const attendanceByDept = attendanceByDeptApi.length
    ? attendanceByDeptApi
        .map((r) => ({
          value: r.dept,
          label: (DEPT_OPTIONS.find((x) => x.value === r.dept)?.label || r.dept || 'Unassigned'),
          total: r.total,
          present: r.present,
          pct: r.pct,
        }))
        .filter((d) => d.total > 0)
    : DEPT_OPTIONS.map((d) => {
        const rows = attendanceScopedRows.filter((r) => (r.department || '').toLowerCase() === d.value)
        const total = rows.length
        const present = rows.filter((r) => ['present', 'late', 'wfh'].includes(r.status)).length
        const pct = total ? Math.round((present / total) * 100) : 0
        return { ...d, total, present, pct }
      }).filter((d) => d.total > 0)

  const messageRows = (latestMessages.length ? latestMessages : FALLBACK_LATEST_MESSAGES).filter((m) => (messageFilter === 'all' ? true : m.type === messageFilter))

  const visibleLeaveRequests = (leaveRequests.length ? leaveRequests : FALLBACK_LEAVE_REQUESTS)

  const submitLeaveRequest = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      showToast('Please set leave start and end dates')
      return
    }

    try {
      await attendanceAPI.createLeaveRequest(token, leaveForm)
      setLeaveForm({ startDate: '', endDate: '', leaveType: 'personal', reason: '' })
      await loadAttendanceAndMessages()
      showToast('Leave request submitted')
    } catch {
      showToast('Failed to submit leave request')
    }
  }

  const reviewLeaveRequest = async (requestId, nextStatus) => {
    try {
      await attendanceAPI.reviewLeaveRequest(token, requestId, { status: nextStatus })
      await loadAttendanceAndMessages()
      showToast(`Leave request ${nextStatus}`)
    } catch {
      showToast('Unable to update leave request')
    }
  }

  const sendQuickMessage = async () => {
    if (!newMessage.trim()) return
    try {
      await messagesAPI.createMessage(token, {
        type: 'group',
        room: 'All Departments',
        department: user?.department || 'management',
        text: newMessage.trim(),
      })
      setNewMessage('')
      await loadAttendanceAndMessages()
      showToast('Message sent')
    } catch {
      showToast('Failed to send message')
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 text-sm">
          {toast}
        </div>
      )}

      <Section
        title={`Operational Command Center - ${roleView.replace(/_/g, ' ')}`}
        action={<p className="text-xs text-gray-500">{today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-white">Good day, {user?.name || 'User'}</p>
            <p className="text-sm text-gray-400">Last login: {user?.lastLogin ? fmtDateTime(user.lastLogin) : '2 hrs ago'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Quick Search"
              className="input-field w-44"
            />
            {roleCreateOptions.length > 0 && !isReadOnlyExec && (
              <select className="input-field w-44" onChange={(e) => e.target.value && onQuickAction(e.target.value)} value="">
                <option value="">+ Quick Create</option>
                {roleCreateOptions.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
            <button className="px-3 py-2 text-xs rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-200">Alerts {alertRows.length}</button>
            {perms.isSuperAdmin && <button className="px-3 py-2 text-xs rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-200">Export Board Report</button>}
            {isReadOnlyExec && <span className="px-3 py-2 text-xs rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200">Read only</span>}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {executiveCards.map((card) => (
          <KpiCard
            key={card.id}
            title={card.title}
            value={card.value}
            hint={card.hint}
            tone={card.tone}
            readOnly={isReadOnlyExec}
            onClick={card.tab && card.tab !== 'overview' ? () => onNavigate?.(card.tab) : undefined}
          />
        ))}
      </div>

      <Section title="Executive Summary by Department">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleDeptMetrics.map((m) => (
            <div key={m.dept} className={`bg-gray-950 border rounded-xl p-4 ${DEPT_STATUS[m.status] || DEPT_STATUS.attention}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-white">{m.title}</p>
                <span className="text-xs text-gray-400">{m.status}</span>
              </div>
              <p className="text-sm text-gray-300">{m.line1}</p>
              <p className="text-xs text-gray-500 mt-1">{m.line2}</p>
              <p className="text-xs text-gray-500">{m.line3}</p>
              <button onClick={() => onNavigate?.(TAB_BY_DEPT[m.dept])} className="mt-3 text-xs text-emerald-300 hover:text-emerald-200">
                View {'->'}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Tasks Command Center"
        action={
          <div className="flex gap-2">
            <button onClick={() => setTaskView('list')} className={`px-2 py-1 text-xs rounded ${taskView === 'list' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>List</button>
            <button onClick={() => setTaskView('kanban')} className={`px-2 py-1 text-xs rounded ${taskView === 'kanban' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>Kanban</button>
            <button onClick={() => setTaskView('calendar')} className={`px-2 py-1 text-xs rounded ${taskView === 'calendar' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>Calendar</button>
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <KpiCard title="Total Tasks" value={taskStats.total} hint="All visible" tone="green" />
          <KpiCard title="My Tasks" value={taskStats.mine} hint="Assigned to me" tone="green" />
          <KpiCard title="Overdue" value={taskStats.overdue} hint="Need action" tone="red" />
          <KpiCard title="Due Today" value={taskStats.dueToday} hint="Act now" tone="yellow" />
          <KpiCard title="Completed" value={taskStats.completed} hint="This cycle" tone="green" />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ['all', 'All Tasks'],
            ['my', 'My Tasks'],
            ['overdue', 'Overdue'],
            ['due-today', 'Due Today'],
            ['this-week', 'This Week'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTaskFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs ${taskFilter === id ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>
              {label}
            </button>
          ))}
          <select className="input-field w-36" value={taskDeptFilter} onChange={(e) => setTaskDeptFilter(e.target.value)}>
            <option value="all">All Depts</option>
            {DEPT_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select className="input-field w-36" value={taskAssignedFilter} onChange={(e) => setTaskAssignedFilter(e.target.value)}>
            <option value="any">Anyone</option>
            {assignees.map((p) => <option key={`${p.id}-${p.name}`} value={p.name}>{p.name}</option>)}
          </select>
          <select className="input-field w-32" value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value)}>
            <option value="all">All Priority</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input className="input-field flex-1 min-w-[180px]" placeholder="Search tasks" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
          {canCreateTasks && (
            <button onClick={() => setShowTaskCreate((v) => !v)} className="px-3 py-2 text-xs rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
              + Create Task
            </button>
          )}
        </div>

        {showTaskCreate && canCreateTasks && (
          <div className="mb-5 p-4 rounded-xl border border-gray-700 bg-gray-900/70 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Quick Create Task</p>
              <button onClick={() => setShowTaskCreate(false)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="input-field" placeholder="Task Title *" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
              <input className="input-field" placeholder="Module / Section" value={taskForm.module} onChange={(e) => setTaskForm((p) => ({ ...p, module: e.target.value }))} />
              <textarea className="input-field md:col-span-2" rows={3} placeholder="Description / Notes" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} />
              <select className="input-field" value={taskForm.department} onChange={(e) => setTaskForm((p) => ({ ...p, department: e.target.value }))}>
                {DEPT_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select
                className="input-field"
                value={taskForm.assignedTo}
                onChange={(e) => {
                  const pick = assignees.find((x) => x.name === e.target.value)
                  setTaskForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: pick?.id || '' }))
                }}
              >
                <option value="">Assign To *</option>
                {assignees.map((a) => <option key={`${a.id}-${a.name}`} value={a.name}>{a.name}</option>)}
              </select>
              <select className="input-field" value={taskForm.priority} onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}>
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select className="input-field" value={taskForm.status} onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input type="date" className="input-field" value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} />
              <input className="input-field" placeholder="Linked record" value={taskForm.linkedRecord} onChange={(e) => setTaskForm((p) => ({ ...p, linkedRecord: e.target.value }))} />
              <select
                multiple
                className="input-field md:col-span-2 min-h-24"
                value={taskForm.alsoNotify}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value)
                  setTaskForm((p) => ({ ...p, alsoNotify: values }))
                }}
              >
                {assignees.map((a) => <option key={`notify-${a.name}`} value={a.name}>{a.name}</option>)}
              </select>
              <textarea className="input-field md:col-span-2" rows={2} placeholder="Message to assignee (optional)" value={taskForm.notifyText} onChange={(e) => setTaskForm((p) => ({ ...p, notifyText: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTaskCreate(false)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs">Cancel</button>
              <button onClick={onCreateTask} className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs">Create & Notify</button>
            </div>
          </div>
        )}

        {loadingTasks ? (
          <div className="text-sm text-gray-400 py-6">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 border border-dashed border-gray-700 rounded-xl text-center">No tasks match current filters</div>
        ) : taskView === 'list' ? (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isExpanded = expandedTaskId === task._id
              const overdue = task.dueDate && new Date(task.dueDate) < todayStart && task.status !== 'done'
              return (
                <div key={task._id} className="border border-gray-800 rounded-xl bg-gray-950">
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{task.department || 'General'} {'->'} {task.module || 'General'}</p>
                        <p className="text-xs text-gray-400 mt-1">{task.assignedTo || 'Unassigned'} · Due: {fmtDate(task.dueDate)} {overdue ? '· OVERDUE' : ''}</p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className={`text-xs px-2 py-0.5 rounded border ${priorityTone(task.priority)}`}>{(task.priority || 'medium').toUpperCase()}</span>
                        <select
                          disabled={!canUpdateTask(task)}
                          value={task.status}
                          onChange={(e) => onTaskStatusChange(task, e.target.value)}
                          className="input-field text-xs w-36"
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => setExpandedTaskId(isExpanded ? '' : task._id)} className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300">Open</button>
                      <button onClick={() => onTaskMarkDone(task)} disabled={!canUpdateTask(task)} className="px-2 py-1 text-xs rounded bg-emerald-700 text-white disabled:opacity-40">Mark Done</button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Details</p>
                        <p className="text-sm text-gray-300">{task.description || 'No description provided.'}</p>
                        <div className="text-xs text-gray-500 mt-3 space-y-1">
                          <p>Priority: {task.priority}</p>
                          <p>Status: {statusLabel(task.status)}</p>
                          <p>Created: {fmtDateTime(task.createdAt)}</p>
                          <p>Linked: {task.linkedRecord || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Activity & Messages</p>
                        <div className="space-y-2 max-h-44 overflow-auto pr-1">
                          {(task.comments || []).length === 0 && <p className="text-xs text-gray-600">No comments yet.</p>}
                          {(task.comments || []).map((c, idx) => (
                            <div key={`${task._id}-c-${idx}`} className="rounded-lg border border-gray-800 p-2 bg-gray-900">
                              <p className="text-xs text-gray-300"><span className="font-semibold">{c.author}</span> - {fmtDateTime(c.createdAt)}</p>
                              <p className="text-xs text-gray-400 mt-1">{c.text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            className="input-field flex-1"
                            placeholder="Write a message or update"
                            value={commentText[task._id] || ''}
                            onChange={(e) => setCommentText((p) => ({ ...p, [task._id]: e.target.value }))}
                          />
                          <button onClick={() => onTaskComment(task)} className="px-3 py-2 text-xs rounded bg-emerald-700 text-white">Send</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : taskView === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {['todo', 'in-progress', 'blocked', 'done'].map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col)
              return (
                <div key={col} className="border border-gray-800 rounded-xl p-3 bg-gray-950">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{statusLabel(col)} ({colTasks.length})</p>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div key={`${col}-${t._id}`} className="border border-gray-800 rounded-lg p-2 bg-gray-900">
                        <p className="text-sm text-gray-200 font-medium">{t.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{t.assignedTo || 'Unassigned'} · {fmtDate(t.dueDate)}</p>
                      </div>
                    ))}
                    {canCreateTasks && (
                      <button onClick={() => setShowTaskCreate(true)} className="w-full py-2 text-xs rounded border border-dashed border-gray-700 text-gray-500 hover:text-gray-300">
                        + Add Task
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {[...Array(31)].map((_, idx) => {
              const day = idx + 1
              const onDay = filteredTasks.filter((t) => t.dueDate && new Date(t.dueDate).getDate() === day)
              return (
                <div key={`day-${day}`} className="min-h-20 border border-gray-800 rounded-lg p-1 bg-gray-950">
                  <p className="text-[10px] text-gray-500">{day}</p>
                  <div className="space-y-1 mt-1">
                    {onDay.slice(0, 2).map((t) => (
                      <p key={`cal-${t._id}`} className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 truncate">
                        {t.title}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Attendance Command Center">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <KpiCard title="Present Today" value={`${attendanceStats.present}/${attendanceStats.total}`} hint={`${attendanceStats.percent}% rate`} tone={attendanceStats.percent < 80 ? 'red' : attendanceStats.percent < 90 ? 'yellow' : 'green'} />
          <KpiCard title="Absent Today" value={attendanceStats.absent} hint="Needs follow-up" tone={attendanceStats.absent > 5 ? 'red' : 'yellow'} />
          <KpiCard title="On Leave" value={attendanceStats.onLeave} hint="Approved leave" tone="yellow" />
          <KpiCard title="Late Check-ins" value={attendanceStats.late} hint="After 9:00 AM" tone={attendanceStats.late > 3 ? 'yellow' : 'green'} />
        </div>

        {!isPersonalView && (
          <div className="mb-4 border border-gray-800 rounded-xl p-3 bg-gray-950">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Attendance by Department</p>
            <div className="space-y-2">
              {attendanceByDept.map((row) => (
                <div key={`bar-${row.value}`} className="grid grid-cols-[90px_1fr_90px] gap-2 items-center">
                  <span className="text-xs text-gray-300 capitalize">{row.label}</span>
                  <div className="h-2 rounded bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full ${row.pct >= 90 ? 'bg-emerald-500' : row.pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{row.present}/{row.total} ({row.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <select className="input-field w-36" value={attendanceDeptFilter} onChange={(e) => setAttendanceDeptFilter(e.target.value)}>
            <option value="all">All Depts</option>
            {DEPT_OPTIONS.map((d) => <option key={`ad-${d.value}`} value={d.value}>{d.label}</option>)}
          </select>
          <select className="input-field w-36" value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">On Leave</option>
            <option value="late">Late</option>
            <option value="wfh">Work From Home</option>
          </select>
          <input className="input-field flex-1 min-w-[180px]" placeholder="Search name" value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto border border-gray-800 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-gray-900">
              <tr>
                {['AVT', 'Name', 'Dept', 'Check-in', 'Status', 'Shift', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendanceFilteredRows.map((r) => (
                <tr key={r.id} className="border-t border-gray-800">
                  <td className="px-3 py-2 text-gray-400">{initials(r.name)}</td>
                  <td className="px-3 py-2 text-gray-200">{r.name}</td>
                  <td className="px-3 py-2 text-gray-400 capitalize">{r.department || '-'}</td>
                  <td className="px-3 py-2 text-gray-400">{r.checkIn}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded border text-[11px] ${
                      r.status === 'present'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : r.status === 'absent'
                        ? 'border-red-500/30 bg-red-500/10 text-red-200'
                        : r.status === 'leave'
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                        : r.status === 'late'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
                        : 'border-purple-500/30 bg-purple-500/10 text-purple-200'
                    }`}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{r.shift}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {(perms.isSuperAdmin || perms.isDepartmentHead || (user?.department || '').toLowerCase() === 'hr') ? 'Mark · History · Remind' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="border border-gray-800 rounded-xl p-3 bg-gray-950">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">My Attendance - April 2026</p>
              <button className="text-xs text-emerald-300">View Full History</button>
            </div>
            <p className="text-xs text-gray-400">This Month: {myAttendance?.presentDays ?? 20}/{myAttendance?.totalDays ?? 22} days ({myAttendance?.attendancePct ?? 91}%)</p>
            <p className="text-xs text-gray-500 mt-1">Today: {String(myAttendance?.todayStatus || 'absent').toUpperCase()} at {myAttendance?.todayCheckIn || '-'}</p>
            <p className="text-xs text-gray-500 mt-1">Leaves taken: {myAttendance?.leaveDays ?? 2} days</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))} className="input-field" />
              <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))} className="input-field" />
              <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveType: e.target.value }))} className="input-field sm:col-span-2">
                <option value="personal">Personal</option>
                <option value="medical">Medical</option>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="other">Other</option>
              </select>
              <input value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason (optional)" className="input-field sm:col-span-2" />
            </div>
            <button onClick={submitLeaveRequest} className="mt-3 px-3 py-2 text-xs rounded-lg bg-emerald-700 text-white">Apply for Leave</button>
          </div>

          <div className="border border-gray-800 rounded-xl p-3 bg-gray-950">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Leave Requests</p>
              <button className="text-xs text-emerald-300">View All</button>
            </div>
            <div className="space-y-2">
              {visibleLeaveRequests
                .filter((x) => perms.isSuperAdmin || perms.isManagement || (perms.isDepartmentHead && (x.dept || x.department) === (user?.department || '').toLowerCase()) || (!perms.isDepartmentHead && !perms.isSuperAdmin && !perms.isManagement && (x.name || x.employeeName || '').toLowerCase() === (user?.name || '').toLowerCase()))
                .map((x) => (
                  <div key={x.id || x._id} className="border border-gray-800 rounded-lg p-2">
                    <p className="text-xs text-gray-200">{x.name || x.employeeName} ({x.dept || x.department})</p>
                    <p className="text-xs text-gray-500">{x.dates || `${fmtDate(x.startDate)} - ${fmtDate(x.endDate)}`} · {x.days} days · {x.reason}</p>
                    <div className="mt-2 text-xs text-gray-400 flex gap-2">
                      {(perms.isSuperAdmin || perms.isDepartmentHead || (user?.department || '').toLowerCase() === 'hr') && x.status !== 'approved' && (
                        <button onClick={() => reviewLeaveRequest(x.id || x._id, 'approved')} className="text-emerald-300">Approve</button>
                      )}
                      {(perms.isSuperAdmin || perms.isDepartmentHead || (user?.department || '').toLowerCase() === 'hr') && x.status !== 'rejected' && (
                        <button onClick={() => reviewLeaveRequest(x.id || x._id, 'rejected')} className="text-red-300">Reject</button>
                      )}
                      <span>View</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Critical Alerts" action={<button className="text-xs text-emerald-300">View All Alerts</button>}>
        <div className="space-y-2">
          {alertRows.map((a) => (
            <div key={a.id} className="border border-gray-800 rounded-xl p-3 bg-gray-950 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-200">{a.text}</p>
                <p className="text-xs text-gray-500 mt-1 capitalize">{a.dept} · {a.age}</p>
              </div>
              <span className={`px-2 py-1 rounded border text-[11px] uppercase ${getSeverityTone(a.severity)}`}>{a.severity}</span>
            </div>
          ))}
        </div>
      </Section>

      {canViewExecutiveCharts && (
        <Section title="Charts & Analytics">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border border-gray-800 rounded-xl p-3 bg-gray-950">
              <p className="text-xs text-gray-400 mb-2">Revenue Trend</p>
              <svg viewBox="0 0 240 120" className="w-full h-32">
                <polyline fill="none" stroke="#00ED64" strokeWidth="3" points="0,90 25,78 50,80 75,70 100,75 125,62 150,55 175,58 200,45 225,35 240,38" />
                <line x1="0" y1="52" x2="240" y2="52" stroke="#64748b" strokeDasharray="4 4" />
              </svg>
            </div>
            <div className="border border-gray-800 rounded-xl p-3 bg-gray-950">
              <p className="text-xs text-gray-400 mb-2">Department Health Radar (summary)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DEMO_DEPT_METRICS.map((m) => (
                  <button key={`rad-${m.dept}`} onClick={() => onNavigate?.(TAB_BY_DEPT[m.dept])} className="text-left p-2 rounded border border-gray-800 bg-gray-900 text-gray-300 hover:text-white">
                    {m.title}: {m.status}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-gray-800 rounded-xl p-3 bg-gray-950">
              <p className="text-xs text-gray-400 mb-2">Sales Pipeline Funnel</p>
              {[
                ['Prospect', 42],
                ['Contacted', 31],
                ['Qualified', 21],
                ['Negotiating', 12],
                ['Signed', 6],
                ['Active', 4],
              ].map(([name, v]) => (
                <div key={name} className="mb-1">
                  <p className="text-[11px] text-gray-400">{name} ({v})</p>
                  <div className="h-2 rounded bg-gray-800 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.max(8, Number(v) * 2)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {canViewExecutiveCharts && (
        <Section title="Gold Operations Snapshot">
          <p className="text-sm text-gray-300">Gold sourced this month: 430kg / 500kg target (86%)</p>
          <div className="h-2 rounded bg-gray-800 mt-2 overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: '86%' }} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs text-gray-400">
            <p>Channels: GCH-01 active, GCH-04 due diligence</p>
            <p>Security vendors: Titan Secure approved, Shield Response pending</p>
            <p>Routes: Primary Corridor A active, Alternate Air Link hold</p>
            <p>Markets: UAE active, ZA meeting, IN contacted, UK negotiating, NG qualified</p>
          </div>
        </Section>
      )}

      <Section title="Upcoming Deadlines - Next 14 days" action={<button className="text-xs text-emerald-300">View Calendar</button>}>
        <div className="space-y-2">
          {deadlineRows.map((d) => (
            <div key={d.id} className="flex items-center justify-between border border-gray-800 rounded-lg p-2 bg-gray-950">
              <p className="text-xs text-gray-200">{d.when} · {d.text}</p>
              <button className="text-xs text-gray-400 capitalize" onClick={() => onNavigate?.(TAB_BY_DEPT[d.dept] || 'overview')}>{d.dept}</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {(QUICK_ACTIONS[role] || QUICK_ACTIONS.department_user).map((action) => (
            <button key={action} onClick={() => onQuickAction(action)} className="px-3 py-2 text-xs rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:text-white hover:border-emerald-500/30">
              {action}
            </button>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Live Activity Feed" action={<button className="text-xs text-emerald-300">View Full Log</button>}>
          <div className="space-y-2">
            {latestFeed.map((f) => (
              <div key={f.id} className="border border-gray-800 rounded-lg p-2 bg-gray-950">
                <p className="text-xs text-gray-200">{f.text}</p>
                <p className="text-[11px] text-gray-500 mt-1">{f.dept} · {fmtDateTime(f.time)}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Latest Messages (Group & DM)"
          action={
            <div className="flex gap-2">
              <button onClick={() => setMessageFilter('all')} className={`px-2 py-1 text-xs rounded ${messageFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>All</button>
              <button onClick={() => setMessageFilter('group')} className={`px-2 py-1 text-xs rounded ${messageFilter === 'group' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>Group</button>
              <button onClick={() => setMessageFilter('dm')} className={`px-2 py-1 text-xs rounded ${messageFilter === 'dm' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-300'}`}>DM</button>
            </div>
          }
        >
          <div className="space-y-2">
            {messageRows.map((m) => (
              <div key={m.id} className="border border-gray-800 rounded-lg p-2 bg-gray-950">
                <p className="text-xs text-gray-500 uppercase">{m.type} · {m.room}</p>
                <p className="text-xs text-gray-200 mt-1"><span className="font-semibold">{m.sender}:</span> {m.text}</p>
                <p className="text-[11px] text-gray-500 mt-1">{m.ago}</p>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Send quick group update..." className="input-field flex-1" />
              <button onClick={sendQuickMessage} className="px-3 py-2 text-xs rounded bg-emerald-700 text-white">Send</button>
            </div>
          </div>
        </Section>
      </div>

      {(loadingEmployees || loadingTasks) && (
        <p className="text-xs text-gray-500">Syncing live data...</p>
      )}
    </div>
  )
}

export default OverviewTab
