import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import projectsAPI from '../../api/projects'
import authAPI from '../../api/auth'
import hrAPI from '../../api/hr'
import attendanceAPI from '../../api/attendance'
import messagesAPI from '../../api/messages'
import axios, { API_ORIGIN } from '../../api/client'
import { ModuleTabColumn } from '../layout/ModuleTabChrome'
import { Modal } from '../ui-components'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'
import OverviewHeader from './overview/OverviewHeader'
import OverviewKpis from './overview/OverviewKpis'
import MyWorkPanel from './overview/MyWorkPanel'
import NotificationsPanel from './overview/NotificationsPanel'
import QuickActions from './overview/QuickActions'
import RecentActivity from './overview/RecentActivity'
import AttentionRequired from './overview/AttentionRequired'
import UpcomingDeadlines from './overview/UpcomingDeadlines'
import AttendanceSummary from './overview/AttendanceSummary'
import {
  DEPT_OPTIONS,
  EmptyPanel,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  endOfToday,
  fmtDate,
  fmtDateTime,
  startOfToday,
  statusLabel,
  taskAssignedToCurrentUser,
} from './overview/overviewShared'

const overviewConfig = {
  super_admin: 'executive dashboard',
  management: 'executive readonly',
  department_head: 'department dashboard',
  department_user: 'personal dashboard',
  external: 'partner dashboard',
}

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
  reminderAt: '',
}

function OverviewTab({ onNavigate, buildTabHref, isActive = true, onBindSearch }) {
  const { user, token } = useAuth()
  const perms = usePermissions()

  const [tasks, setTasks] = useState([])
  const [assignees, setAssignees] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [tasksError, setTasksError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [taskFilter, setTaskFilter] = useState('attention')
  const [showTaskCreate, setShowTaskCreate] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState('')
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM)
  const [toast, setToast] = useState('')
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [latestMessages, setLatestMessages] = useState([])
  const [messagesError, setMessagesError] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [attendanceSummaryApi, setAttendanceSummaryApi] = useState(null)
  const [myAttendance, setMyAttendance] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', leaveType: 'personal', reason: '' })
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [attendanceError, setAttendanceError] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [alertsError, setAlertsError] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [exceptionsOpen, setExceptionsOpen] = useState(false)
  const [exceptions, setExceptions] = useState([])
  const [liveAlerts, setLiveAlerts] = useState([])
  const [ackedAlerts, setAckedAlerts] = useState({})

  const role = user?.role || 'department_user'
  const roleView = overviewConfig[role] || overviewConfig.department_user
  const canCreateTasks = !perms.isManagement && !perms.isExternal
  const isReadOnlyExec = perms.isManagement
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const showToast = (msg) => {
    setToast(msg)
    window.clearTimeout(window.__overviewToastTimer)
    window.__overviewToastTimer = window.setTimeout(() => setToast(''), 2500)
  }

  const resetTaskComposer = () => {
    setShowTaskCreate(false)
    setEditingTaskId('')
    setTaskForm(DEFAULT_TASK_FORM)
  }

  const openTaskComposer = (task = null) => {
    if (!task) {
      setEditingTaskId('')
      setTaskForm({
        ...DEFAULT_TASK_FORM,
        department: perms.isDepartmentHead || perms.isDepartmentUser ? (user?.department || 'sales') : 'sales',
        assignedToId: perms.isDepartmentUser ? (user?.id || '') : '',
        assignedTo: perms.isDepartmentUser ? (user?.name || '') : '',
      })
      setShowTaskCreate(true)
      return
    }
    setEditingTaskId(task._id)
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      department: task.department || (user?.department || 'sales'),
      module: task.module || 'General',
      assignedToId: task.assignedToId || '',
      assignedTo: task.assignedTo || '',
      priority: task.priority || 'high',
      status: task.status || 'todo',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      linkedRecord: task.linkedRecord || '',
      notifyText: '',
      alsoNotify: [],
      reminderAt: task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : '',
    })
    setShowTaskCreate(true)
  }

  const loadTasks = useCallback(async () => {
    setLoadingTasks((prev) => (tasks.length === 0 ? true : prev))
    try {
      const data = await projectsAPI.getProjects(token)
      setTasks(data.projects || [])
      setTasksError(false)
    } catch {
      if (tasks.length === 0) {
        setTasks([])
        setTasksError(true)
      }
    } finally {
      setLoadingTasks(false)
    }
  }, [token, tasks.length])

  const loadAssignees = useCallback(async () => {
    try {
      const isSuperAdmin = user?.role === 'super_admin'
      const [usersRes, employeesRes] = await Promise.allSettled([
        isSuperAdmin ? authAPI.getUsers(token) : Promise.resolve({ users: [] }),
        hrAPI.getEmployees(token),
      ])
      const userList = usersRes.status === 'fulfilled'
        ? (usersRes.value.users || []).map((u) => ({ id: u.id || u._id, name: u.name, department: u.department || '' }))
        : []
      const employeeList = employeesRes.status === 'fulfilled'
        ? (employeesRes.value.employees || []).map((e) => ({ id: e._id, name: e.name, department: e.department || '' }))
        : []
      const merged = [...userList, ...employeeList]
      const uniqueByName = []
      const seen = new Set()
      merged.forEach((p) => {
        const key = (p.name || '').toLowerCase().trim()
        if (!key || seen.has(key)) return
        seen.add(key)
        uniqueByName.push(p)
      })
      setAssignees(uniqueByName)
    } catch {
      setAssignees([])
    }
  }, [token, user?.role])

  const loadMessages = useCallback(async () => {
    setLoadingMessages((prev) => (latestMessages.length === 0 ? true : prev))
    try {
      const messagesRes = await messagesAPI.getLatestMessages(token, 'all', 30)
      setLatestMessages((messagesRes.messages || []).map((m) => ({
        id: m._id,
        type: m.type,
        room: m.room,
        sender: m.senderName,
        text: m.text,
        ago: fmtDateTime(m.createdAt),
      })))
      setMessagesError(false)
    } catch {
      if (latestMessages.length === 0) {
        setLatestMessages([])
        setMessagesError(true)
      }
    } finally {
      setLoadingMessages(false)
    }
  }, [token, latestMessages.length])

  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true)
    try {
      const [summaryRes, meRes, leaveRes] = await Promise.allSettled([
        attendanceAPI.getSummary(token),
        attendanceAPI.getMyAttendance(token),
        attendanceAPI.getLeaveRequests(token),
      ])
      let anyOk = false
      if (summaryRes.status === 'fulfilled') {
        setAttendanceSummaryApi(summaryRes.value.summary || null)
        anyOk = true
      }
      if (meRes.status === 'fulfilled') {
        setMyAttendance(meRes.value.me || null)
        anyOk = true
      }
      if (leaveRes.status === 'fulfilled') {
        setLeaveRequests(leaveRes.value.requests || [])
        anyOk = true
      }
      setAttendanceError(!anyOk)
    } catch {
      setAttendanceError(true)
    } finally {
      setLoadingAttendance(false)
    }
  }, [token])

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts((prev) => (liveAlerts.length === 0 ? true : prev))
    try {
      const r = await axios.get(`${API_ORIGIN}/api/exceptions`)
      setLiveAlerts((r.data?.exceptions || []).slice(0, 8))
      setAlertsError(false)
    } catch {
      if (liveAlerts.length === 0) {
        setLiveAlerts([])
        setAlertsError(true)
      }
    } finally {
      setLoadingAlerts(false)
    }
  }, [liveAlerts.length])

  const refreshAll = async () => {
    setRefreshing(true)
    await Promise.all([loadTasks(), loadMessages(), loadAttendance(), loadAssignees(), loadAlerts()])
    setRefreshing(false)
    showToast('Overview refreshed')
  }

  useEffect(() => {
    if (!token) return
    loadTasks()
    loadAssignees()
    loadMessages()
    loadAttendance()
    loadAlerts()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !isActive) return undefined
    const id = window.setInterval(() => {
      loadTasks()
      loadMessages()
      loadAttendance()
      loadAlerts()
    }, 120000)
    return () => window.clearInterval(id)
  }, [token, isActive, loadTasks, loadMessages, loadAttendance, loadAlerts])

  useEffect(() => {
    if (!token) return undefined
    const tenant = user?.company || user?.tenant?.key || user?.tenant?.name
    const unsubs = [
      subscribeRealtimeEvents(tenant, ['task.created', 'task.updated', 'task.deleted', 'task.commented', 'task.reminder_due'], () => loadTasks()),
      subscribeRealtimeEvents(tenant, 'message.created', () => loadMessages()),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [token, user?.company, user?.tenant, loadTasks, loadMessages])

  useEffect(() => {
    if (!onBindSearch) return undefined
    onBindSearch(() => setSearchOpen(true))
    return () => onBindSearch(null)
  }, [onBindSearch])

  useEffect(() => {
    if (!exceptionsOpen || !token) return undefined
    let cancelled = false
    axios.get(`${API_ORIGIN}/api/exceptions`)
      .then((r) => { if (!cancelled) setExceptions(r.data?.exceptions || []) })
      .catch(() => { if (!cancelled) setExceptions([]) })
    return () => { cancelled = true }
  }, [exceptionsOpen, token])

  const scopedTasks = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.archivedAt)
    if (perms.isSuperAdmin || perms.isManagement) return activeTasks
    if (perms.isDepartmentHead) return activeTasks.filter((t) => (t.department || '').toLowerCase() === (user?.department || '').toLowerCase())
    if (perms.isDepartmentUser) {
      return activeTasks.filter(
        (t) =>
          taskAssignedToCurrentUser(t, user?.id, user?.name)
          || (t.createdBy || '').toLowerCase() === (user?.name || '').toLowerCase(),
      )
    }
    if (perms.isExternal) return activeTasks.filter((t) => (user?.allowedModules || []).includes(t.department))
    return []
  }, [tasks, perms, user])

  const taskStats = useMemo(() => {
    const source = scopedTasks
    const mine = source.filter((t) => taskAssignedToCurrentUser(t, user?.id, user?.name))
    const overdue = source.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
    const dueToday = source.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== 'done')
    const blocked = source.filter((t) => t.status === 'blocked')
    const completed = source.filter((t) => t.status === 'done')
    return {
      total: source.length,
      mine: mine.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      blocked: blocked.length,
      completed: completed.length,
    }
  }, [scopedTasks, user?.id, user?.name, todayStart, todayEnd])

  const attentionTasks = useMemo(() => {
    let list = [...scopedTasks]
    if (taskFilter === 'my') list = list.filter((t) => taskAssignedToCurrentUser(t, user?.id, user?.name))
    else if (taskFilter === 'overdue') list = list.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
    else if (taskFilter === 'due-today') list = list.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== 'done')
    else {
      list = list.filter((t) => {
        const overdue = t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done'
        const dueToday = t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== 'done'
        const blocked = t.status === 'blocked'
        const mineOpen = taskAssignedToCurrentUser(t, user?.id, user?.name) && t.status !== 'done' && t.status !== 'cancelled'
        return overdue || dueToday || blocked || mineOpen
      })
    }
    return list.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate) - new Date(b.dueDate)
    })
  }, [scopedTasks, taskFilter, user?.id, user?.name, todayStart, todayEnd])

  const kpiCards = useMemo(() => {
    const cards = [
      { id: 'my', title: 'My Tasks', value: String(taskStats.mine), hint: 'Assigned to me', onClick: () => setTaskFilter('my') },
      { id: 'overdue', title: 'Overdue', value: String(taskStats.overdue), hint: 'Need action', onClick: () => setTaskFilter('overdue') },
      { id: 'due', title: 'Due Today', value: String(taskStats.dueToday), hint: 'Act now', onClick: () => setTaskFilter('due-today') },
      { id: 'messages', title: 'Messages', value: String(latestMessages.length), hint: 'Recent', tab: 'chat' },
    ]
    if (liveAlerts.length) {
      cards.push({ id: 'exceptions', title: 'Open Exceptions', value: String(liveAlerts.length), hint: 'Owner center', onClick: () => setExceptionsOpen(true) })
    }
    if (attendanceSummaryApi) {
      cards.push({
        id: 'attendance',
        title: 'Present Today',
        value: `${attendanceSummaryApi.present ?? 0}/${attendanceSummaryApi.total ?? 0}`,
        hint: attendanceSummaryApi.percent != null ? `${attendanceSummaryApi.percent}% rate` : 'Attendance',
        tab: 'hr',
      })
    }
    return cards.slice(0, 6)
  }, [taskStats, latestMessages.length, liveAlerts.length, attendanceSummaryApi])

  const notificationRows = useMemo(() => {
    const taskNotifications = scopedTasks
      .filter((t) => t.createdAt || t.updatedAt)
      .slice(0, 6)
      .map((t) => ({
        id: `nt-${t._id}`,
        type: 'task',
        title: t.title,
        text: `${t.assignedTo || 'Team'} · ${statusLabel(t.status)} · ${t.priority || 'medium'} priority`,
        time: fmtDateTime(t.updatedAt || t.createdAt),
        task: t,
      }))
    const messageNotifications = latestMessages.map((m) => ({
      id: `nm-${m.id}`,
      type: 'message',
      title: `${m.sender} in ${m.room}`,
      text: m.text,
      time: m.ago,
    }))
    return [...taskNotifications, ...messageNotifications]
      .filter((item) => (notificationFilter === 'all' ? true : item.type === notificationFilter))
      .slice(0, 8)
  }, [latestMessages, notificationFilter, scopedTasks])

  const latestFeed = useMemo(() => (
    scopedTasks
      .filter((t) => t.updatedAt)
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8)
      .map((t) => ({
        id: `task-${t._id}`,
        text: `${t.assignedTo || 'Team'} updated ${t.title}`,
        dept: t.department || 'general',
        time: t.updatedAt,
      }))
  ), [scopedTasks])

  const alertRows = useMemo(() => {
    const fromApi = liveAlerts.map((a) => ({
      id: a.id,
      severity: a.severity === 'critical' ? 'critical' : 'high',
      text: a.title || a.message,
      dept: a.type || 'ops',
      age: a.createdAt ? fmtDate(a.createdAt) : '',
    }))
    const taskOverdues = scopedTasks
      .filter((t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'done')
      .slice(0, 5)
      .map((t) => ({
        id: `ot-${t._id}`,
        severity: 'high',
        text: `${t.title} overdue`,
        dept: t.department || 'general',
        age: fmtDate(t.dueDate),
      }))
    return [...fromApi, ...taskOverdues].slice(0, 7)
  }, [liveAlerts, scopedTasks, todayStart])

  const deadlineRows = useMemo(() => (
    scopedTasks
      .filter((t) => t.dueDate && t.status !== 'done' && t.status !== 'cancelled')
      .slice()
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 8)
      .map((t) => ({ id: `td-${t._id}`, when: fmtDate(t.dueDate), text: t.title, dept: t.department || 'general' }))
  ), [scopedTasks])

  const canUpdateTask = (task) => {
    if (perms.isManagement || perms.isExternal) return false
    if (perms.isSuperAdmin || perms.isDepartmentHead) return true
    const mine = taskAssignedToCurrentUser(task, user?.id, user?.name)
    const createdByMe = (task.createdById && task.createdById === user?.id) || (task.createdBy || '').toLowerCase() === (user?.name || '').toLowerCase()
    return perms.isDepartmentUser && (mine || createdByMe)
  }

  const onSaveTask = async () => {
    if (!taskForm.title.trim()) {
      showToast('Task title is required')
      return
    }
    if (!taskForm.assignedTo.trim()) {
      showToast('Task assignee is required')
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
        reminderAt: taskForm.reminderAt || undefined,
        notifyText: taskForm.notifyText,
        alsoNotifyNames: taskForm.alsoNotify,
      }
      if (editingTaskId) await projectsAPI.updateProject(token, editingTaskId, payload)
      else await projectsAPI.createProject(token, payload)
      await loadTasks()
      resetTaskComposer()
      showToast(editingTaskId ? 'Task updated' : 'Task created')
    } catch {
      showToast(`Failed to ${editingTaskId ? 'update' : 'create'} task`)
    }
  }

  const onTaskStatusChange = async (task, status) => {
    try {
      await projectsAPI.updateProject(token, task._id, {
        status,
        notifyText: `${user?.name || 'User'} changed task status to ${statusLabel(status)}`,
      })
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)))
      showToast('Task status updated')
    } catch {
      showToast('Unable to update task status')
    }
  }

  const onQuickAction = (name) => {
    const lower = name.toLowerCase()
    if (lower.includes('task')) { openTaskComposer(); return }
    if (lower.includes('employee')) { onNavigate?.('hr'); return }
    if (lower.includes('invoice') || lower.includes('expense')) { onNavigate?.('finance'); return }
    if (lower.includes('voucher')) { onNavigate?.('erp', { erpSub: 'vouchers' }); return }
    if (lower.includes('supplier')) { onNavigate?.('erp', { erpSub: 'vendors' }); return }
    if (lower.includes('customer')) { onNavigate?.('erp', { erpSub: 'customers' }); return }
    if (lower.includes('lead') || lower.includes('meeting')) { onNavigate?.('sales'); return }
    if (lower.includes('incident')) { onNavigate?.('operations'); return }
    if (lower.includes('production') || lower.includes('work order') || lower.includes('batch')) {
      window.location.assign('/production')
      return
    }
    if (lower.includes('report')) { onNavigate?.('erp', { erpSub: 'reports' }); return }
    if (lower.includes('message')) { onNavigate?.('chat'); return }
    if (lower.includes('search')) { setSearchOpen(true); return }
    if (lower.includes('exception')) { setExceptionsOpen(true); return }
    showToast(`${name} — use navigation if this action is unavailable`)
  }

  const submitLeaveRequest = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      showToast('Please set leave start and end dates')
      return
    }
    try {
      await attendanceAPI.createLeaveRequest(token, leaveForm)
      setLeaveForm({ startDate: '', endDate: '', leaveType: 'personal', reason: '' })
      setLeaveModalOpen(false)
      await loadAttendance()
      showToast('Leave request submitted')
    } catch {
      showToast('Failed to submit leave request')
    }
  }

  const runGlobalSearch = async (e) => {
    e?.preventDefault?.()
    const q = String(searchQuery || '').trim()
    if (q.length < 1) return
    setSearchLoading(true)
    try {
      const r = await axios.get(`${API_ORIGIN}/api/search`, { params: { q, limit: 8 } })
      setSearchResults(r.data?.results || [])
    } catch {
      setSearchResults([])
      showToast('Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  const visibleLeave = leaveRequests.filter((x) => {
    if (perms.isSuperAdmin || perms.isManagement) return true
    if (perms.isDepartmentHead) return (x.dept || x.department) === (user?.department || '').toLowerCase()
    return (x.name || x.employeeName || '').toLowerCase() === (user?.name || '').toLowerCase()
  })
  const pendingLeaveCount = visibleLeave.filter((x) => {
    const status = String(x.status || 'pending').toLowerCase()
    return status !== 'approved' && status !== 'rejected'
  }).length

  return (
    <ModuleTabColumn className="pb-2 space-y-4">
      {toast ? (
        <div className="fixed top-3 right-3 left-3 sm:left-auto sm:top-4 sm:right-4 z-50 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-800 text-sm">
          {toast}
        </div>
      ) : null}

      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-20" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Global Search</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setSearchOpen(false)}>Close</button>
            </div>
            <form onSubmit={runGlobalSearch} className="flex gap-2">
              <input
                className="input-field flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Customer, batch, voucher, employee…"
                autoFocus
              />
              <button type="submit" className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm">{searchLoading ? '…' : 'Search'}</button>
            </form>
            <ul className="max-h-80 overflow-auto divide-y divide-gray-100">
              {searchResults.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    className="w-full text-left py-2 px-1 hover:bg-gray-50"
                    onClick={() => {
                      setSearchOpen(false)
                      if (r.href?.startsWith('/production')) window.location.assign(r.href)
                      else if (r.href?.includes('tab=')) {
                        const tab = new URL(r.href, window.location.origin).searchParams.get('tab')
                        if (tab) onNavigate?.(tab)
                      }
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900">{r.label} <span className="text-xs text-gray-400">{r.type}</span></div>
                    <div className="text-xs text-gray-500">{r.subtitle}</div>
                  </button>
                </li>
              ))}
              {!searchLoading && searchQuery && searchResults.length === 0 ? (
                <li className="py-3 text-sm text-gray-500">No results</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {exceptionsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-16" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-4 space-y-3 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Owner Exception Center</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setExceptionsOpen(false)}>Close</button>
            </div>
            {!exceptions.length ? (
              <EmptyPanel title="No open exceptions" />
            ) : (
              <ul className="space-y-2">
                {exceptions.map((ex) => (
                  <li key={ex.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between gap-2">
                      <strong className="text-sm text-gray-900">{ex.title}</strong>
                      <span className="text-xs uppercase text-red-600">{ex.severity}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{ex.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{ex.type} · {ex.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <OverviewHeader
        userName={user?.name}
        lastLogin={user?.lastLogin}
        roleLabel={roleView}
        onRefresh={refreshAll}
        onSearch={() => setSearchOpen(true)}
        onExceptions={() => setExceptionsOpen(true)}
        refreshing={refreshing}
        showExceptions={perms.isSuperAdmin || perms.isManagement || perms.isDepartmentHead}
      />

      <OverviewKpis
        cards={kpiCards}
        loading={loadingTasks && tasks.length === 0}
        buildTabHref={buildTabHref}
        onNavigate={onNavigate}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-4">
        <MyWorkPanel
          loading={loadingTasks && tasks.length === 0}
          error={tasksError}
          onRetry={loadTasks}
          items={attentionTasks}
          taskFilter={taskFilter}
          setTaskFilter={setTaskFilter}
          canCreateTasks={canCreateTasks}
          onCreate={() => openTaskComposer()}
          onOpen={openTaskComposer}
          onStatusChange={onTaskStatusChange}
          canUpdateTask={canUpdateTask}
          todayStart={todayStart}
        />
        <QuickActions role={role} onAction={onQuickAction} isReadOnly={isReadOnlyExec} />
      </div>

      {showTaskCreate && canCreateTasks ? (
        <Modal
          title={editingTaskId ? 'Edit Task' : 'Create Task'}
          onClose={resetTaskComposer}
          width={640}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetTaskComposer} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={onSaveTask} className="btn btn-primary btn-sm">{editingTaskId ? 'Save' : 'Create'}</button>
            </div>
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Task Title *" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
            <input className="input-field" placeholder="Module / Section" value={taskForm.module} onChange={(e) => setTaskForm((p) => ({ ...p, module: e.target.value }))} />
            <textarea className="input-field md:col-span-2" rows={3} placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} />
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
          </div>
        </Modal>
      ) : null}

      {leaveModalOpen ? (
        <Modal
          title="Apply for Leave"
          onClose={() => setLeaveModalOpen(false)}
          width={480}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLeaveModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={submitLeaveRequest} className="btn btn-primary btn-sm">Submit</button>
            </div>
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))} className="input-field" aria-label="Leave start" />
            <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))} className="input-field" aria-label="Leave end" />
            <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveType: e.target.value }))} className="input-field sm:col-span-2" aria-label="Leave type">
              <option value="personal">Personal</option>
              <option value="medical">Medical</option>
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="other">Other</option>
            </select>
            <input value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason (optional)" className="input-field sm:col-span-2" />
          </div>
        </Modal>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <NotificationsPanel
          loading={loadingMessages && latestMessages.length === 0 && loadingTasks && tasks.length === 0}
          error={messagesError && notificationFilter === 'message'}
          onRetry={loadMessages}
          filter={notificationFilter}
          setFilter={setNotificationFilter}
          rows={notificationRows}
          onViewAll={() => onNavigate?.('chat')}
          onOpenItem={(item) => {
            if (item.type === 'message') onNavigate?.('chat')
            else if (item.task) openTaskComposer(item.task)
          }}
        />
        <RecentActivity
          items={latestFeed}
          loading={loadingTasks && tasks.length === 0}
          error={tasksError && latestFeed.length === 0}
          onRetry={loadTasks}
        />
      </div>

      <AttentionRequired
        loading={loadingAlerts && liveAlerts.length === 0 && loadingTasks && tasks.length === 0}
        error={alertsError && alertRows.length === 0}
        onRetry={() => { loadAlerts(); loadTasks() }}
        rows={alertRows}
        ackedAlerts={ackedAlerts}
        onAcknowledge={(id) => { setAckedAlerts((p) => ({ ...p, [id]: true })); showToast('Alert acknowledged') }}
        onViewAll={() => setExceptionsOpen(true)}
      />

      <UpcomingDeadlines
        loading={loadingTasks && tasks.length === 0}
        error={tasksError}
        onRetry={loadTasks}
        rows={deadlineRows}
      />

      <AttendanceSummary
        loading={loadingAttendance}
        error={attendanceError}
        onRetry={loadAttendance}
        myAttendance={myAttendance}
        attendanceSummaryApi={attendanceSummaryApi}
        pendingLeaveCount={pendingLeaveCount}
        onApplyLeave={() => setLeaveModalOpen(true)}
        onViewHr={() => onNavigate?.('hr')}
      />
    </ModuleTabColumn>
  )
}

export default OverviewTab
