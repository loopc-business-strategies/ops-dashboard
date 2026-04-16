// FILE: src/components/tabs/OverviewTab.jsx
// 7-section enterprise Overview with full role-based access

import { useState, useEffect } from 'react'
import { useAuth }        from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import tasksAPI           from '../../api/tasks'
import authAPI            from '../../api/auth'

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const DEPT_META = [
  { id: 'production', label: 'Production & Factory',   icon: '🏭', tabId: 'production' },
  { id: 'hr',         label: 'Hiring & HR',            icon: '👥', tabId: 'hr'         },
  { id: 'finance',    label: 'Finance & Accounts',     icon: '💰', tabId: 'finance'    },
  { id: 'government', label: 'Govt. & Compliance',     icon: '🏛️', tabId: 'compliance' },
  { id: 'sales',      label: 'Sales & Marketing',      icon: '📈', tabId: 'sales'      },
  { id: 'operations', label: 'Operations & Logistics', icon: '🚛', tabId: 'operations' },
  { id: 'training',   label: 'Training & Dev.',        icon: '🎓', tabId: 'training'   },
]

const DEPTS = [
  { value: '',           label: 'None'                  },
  { value: 'production', label: 'Production & Factory'  },
  { value: 'hr',         label: 'Hiring & HR'           },
  { value: 'finance',    label: 'Finance & Accounts'    },
  { value: 'government', label: 'Govt. & Compliance'    },
  { value: 'sales',      label: 'Sales & Marketing'     },
  { value: 'operations', label: 'Operations & Logistics'},
  { value: 'training',   label: 'Training & Dev.'       },
  { value: 'management', label: 'Management'            },
]

// ─── Seed data ────────────────────────────────────────────
const T = Date.now()
const ago = (ms) => new Date(T - ms).toISOString()

const INIT_HEALTH = { projectName: 'Gold Refinery — Phase 1', status: 'attention', targetDate: '2025-12-31', blockers: 2 }

const INIT_DEPTS = [
  { id: 'production', progress: 45, status: 'attention', lastUpdated: ago(1   * 86400000) },
  { id: 'hr',         progress: 60, status: 'on_track',  lastUpdated: ago(4   * 86400000) },
  { id: 'finance',    progress: 80, status: 'on_track',  lastUpdated: ago(0.3 * 86400000) },
  { id: 'government', progress: 30, status: 'delayed',   lastUpdated: ago(5   * 86400000) },
  { id: 'sales',      progress: 40, status: 'attention', lastUpdated: ago(2   * 86400000) },
  { id: 'operations', progress: 15, status: 'delayed',   lastUpdated: ago(7   * 86400000) },
  { id: 'training',   progress: 55, status: 'on_track',  lastUpdated: ago(1   * 86400000) },
]

const INIT_DEPS = [
  { id: 'd1', label: 'Govt. Eligibility Approval', icon: '🏛️', status: 'blocked',     expectedDate: '2025-05-15', notes: 'Ministry follow-up pending'  },
  { id: 'd2', label: 'Factory Lease Agreement',    icon: '📋', status: 'in_progress', expectedDate: '2025-04-30', notes: 'Legal review in progress'    },
  { id: 'd3', label: 'Machinery Procurement',      icon: '⚙️', status: 'in_progress', expectedDate: '2025-06-01', notes: 'Supplier contract signed'     },
  { id: 'd4', label: 'Banking Setup',              icon: '🏦', status: 'completed',   expectedDate: '2025-03-31', notes: 'Account operational'          },
]

const INIT_RISKS = [
  { id: 'r1', text: 'Govt. eligibility approval delayed',     impact: 'high',   owner: 'Compliance', ownerDept: 'government', mitigation: 'Escalate to senior ministry contact' },
  { id: 'r2', text: 'Foreign specialist visa delays',         impact: 'medium', owner: 'HR',         ownerDept: 'hr',         mitigation: 'Engage immigration consultant'      },
  { id: 'r3', text: 'Machinery installation behind schedule', impact: 'high',   owner: 'Production', ownerDept: 'production', mitigation: 'Expedite logistics vendor'          },
]

const INIT_ACTIVITIES = [
  { id: 'a1', dept: 'finance',    deptLabel: 'Finance',    text: 'Banking setup marked complete',        author: 'Admin',  time: ago(2  * 3600000) },
  { id: 'a2', dept: 'hr',         deptLabel: 'HR',         text: '3 new candidates added to pipeline',   author: 'Mark',   time: ago(4  * 3600000) },
  { id: 'a3', dept: 'government', deptLabel: 'Compliance', text: 'Eligibility approval still blocked',   author: 'Admin',  time: ago(5  * 3600000) },
  { id: 'a4', dept: 'production', deptLabel: 'Production', text: 'Machinery logistics updated',          author: 'Admin',  time: ago(28 * 3600000) },
  { id: 'a5', dept: 'sales',      deptLabel: 'Sales',      text: 'Distributor meeting scheduled',        author: 'Admin',  time: ago(30 * 3600000) },
]

const INIT_PLAN = [
  { id: 'p1', dept: 'government', deptLabel: 'Compliance', task: 'Follow up with ministry on eligibility',    priority: 'urgent', dueDay: 'Mon', done: false },
  { id: 'p2', dept: 'hr',         deptLabel: 'HR',         task: 'Finalize specialist visa applications',      priority: 'high',   dueDay: 'Tue', done: false },
  { id: 'p3', dept: 'production', deptLabel: 'Production', task: 'Confirm machinery delivery ETA',            priority: 'urgent', dueDay: 'Wed', done: false },
  { id: 'p4', dept: 'finance',    deptLabel: 'Finance',    task: 'Prepare Q1 financial summary',              priority: 'normal', dueDay: 'Thu', done: false },
  { id: 'p5', dept: 'operations', deptLabel: 'Operations', task: 'Finalize gold sourcing supplier MOU',       priority: 'high',   dueDay: 'Thu', done: false },
  { id: 'p6', dept: 'sales',      deptLabel: 'Sales',      task: 'Submit distributor onboarding forms',       priority: 'normal', dueDay: 'Fri', done: false },
  { id: 'p7', dept: 'training',   deptLabel: 'Training',   task: 'Schedule institution partnership meeting',  priority: 'normal', dueDay: 'Fri', done: false },
]

// ─── Badge / chip configs ─────────────────────────────────
const HEALTH_CFG = {
  on_track:  { label: 'On Track',  dot: 'bg-green-500',  badge: 'text-green-400 bg-green-500/10 border-green-500/30',   card: 'border-green-500/20'  },
  attention: { label: 'Attention', dot: 'bg-yellow-500', badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', card: 'border-yellow-500/20' },
  delayed:   { label: 'Delayed',   dot: 'bg-red-500',    badge: 'text-red-400 bg-red-500/10 border-red-500/30',          card: 'border-red-500/20'    },
}

const DEP_STATUS_CFG = {
  completed:   { label: 'Completed',   color: 'text-green-400 bg-green-500/10 border-green-500/30'    },
  in_progress: { label: 'In Progress', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  blocked:     { label: 'Blocked',     color: 'text-red-400 bg-red-500/10 border-red-500/30'           },
  not_started: { label: 'Not Started', color: 'text-gray-400 bg-gray-700/50 border-gray-600'           },
}

const RISK_CFG = {
  high:   { label: 'High',   color: 'text-red-300 bg-red-500/20 border-red-500/30'          },
  medium: { label: 'Medium', color: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30' },
  low:    { label: 'Low',    color: 'text-green-300 bg-green-500/20 border-green-500/30'    },
}

const PRIORITY_CFG = {
  urgent: { label: 'Urgent', color: 'text-red-400 bg-red-500/10 border-red-500/30'           },
  high:   { label: 'High',   color: 'text-violet-400 bg-violet-500/10 border-violet-500/30'  },
  normal: { label: 'Normal', color: 'text-gray-400 bg-gray-700/50 border-gray-600'           },
}

const TASK_STATUS = {
  'todo':        { label: 'To Do',       color: 'text-gray-400 bg-gray-700/50 border-gray-600'           },
  'in-progress': { label: 'In Progress', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  'done':        { label: 'Done',        color: 'text-green-400 bg-green-500/10 border-green-500/30'     },
}

const TASK_PRIORITY = {
  low:    { label: 'Low',    color: 'text-gray-400 bg-gray-700/50 border-gray-600'           },
  medium: { label: 'Medium', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  high:   { label: 'High',   color: 'text-red-400 bg-red-500/10 border-red-500/30'           },
}

const EMPTY_TASK = { title: '', description: '', assignedTo: '', assignedToId: '', department: '', status: 'todo', priority: 'medium', dueDate: '' }

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60)    return 'Just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 172800) return 'Yesterday'
  return `${Math.floor(s / 86400)}d ago`
}

function daysSince(iso) {
  return (Date.now() - new Date(iso)) / 86400000
}

function staleness(iso) {
  const d = daysSince(iso)
  if (d >= 3) return { text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'       }
  if (d >= 2) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' }
  return              { text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20'   }
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────
// SHARED MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────

function Chip({ label, color }) {
  return <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${color}`}>{label}</span>
}

function SectionCard({ title, action, children }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function EditBtn({ onClick, label = 'Edit' }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1 text-xs font-medium text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-all">
      {label}
    </button>
  )
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-all">
      {label}
    </button>
  )
}

function SaveCancel({ onSave, onCancel }) {
  return (
    <div className="flex gap-2 mt-2">
      <button onClick={onSave}   className="px-3 py-1 text-white text-xs font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Save</button>
      <button onClick={onCancel} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg">Cancel</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TASK PANEL COMPONENTS (preserved + role-gated)
// ─────────────────────────────────────────────────────────

function TaskForm({ initial = EMPTY_TASK, users, token, onSave, onCancel, isEdit }) {
  const [form, setForm]       = useState({ ...EMPTY_TASK, ...initial })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))
  const handleAssign = e => {
    const u = users.find(u => u._id === e.target.value)
    setForm(p => ({ ...p, assignedToId: e.target.value, assignedTo: u?.name || '' }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required.')
    setLoading(true); setError('')
    try {
      isEdit ? await tasksAPI.updateTask(token, initial._id, form) : await tasksAPI.createTask(token, form)
      onSave()
    } catch { setError('Failed to save task.') }
    finally  { setLoading(false) }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
      <h4 className="text-sm font-semibold text-white mb-4">{isEdit ? 'Edit Task' : 'Create New Task'}</h4>
      {error && <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Title *</label>
          <input type="text" value={form.title} onChange={set('title')} placeholder="Task title" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Description</label>
          <textarea value={form.description} onChange={set('description')} rows={2} className="input-field resize-none" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Assign To</label>
            <select value={form.assignedToId} onChange={handleAssign} className="input-field">
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Department</label>
            <select value={form.department} onChange={set('department')} className="input-field">
              {DEPTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Status</label>
            <select value={form.status} onChange={set('status')} className="input-field">
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Priority</label>
            <select value={form.priority} onChange={set('priority')} className="input-field">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Due Date</label>
            <input type="date" value={form.dueDate ? form.dueDate.slice(0, 10) : ''} onChange={set('dueDate')} className="input-field" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading} className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
          <button type="button" onClick={onCancel} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function CommentBox({ task, token, onUpdated }) {
  const [open, setOpen]       = useState(false)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      await tasksAPI.addComment(token, task._id, text.trim())
      setText(''); setOpen(false); onUpdated()
    } catch { setError('Failed to send.') }
    finally  { setLoading(false) }
  }

  return (
    <div className="mt-2">
      {task.comments?.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {task.comments.map((c, i) => (
            <div key={i} className="flex gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
              <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                {c.author[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300">{c.author}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.text}</p>
                <p className="text-xs text-gray-600 mt-0.5">{fmtDate(c.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
          + Add note / doubt
        </button>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type your note or question..." rows={2}
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none" />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={submit} disabled={loading || !text.trim()} className="px-3 py-1 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>
              {loading ? 'Sending...' : 'Send'}
            </button>
            <button onClick={() => { setOpen(false); setText('') }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManagerTasksPanel({ token }) {
  const [tasks, setTasks]             = useState([])
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [editTask, setEditTask]       = useState(null)
  const [filter, setFilter]           = useState('all')
  const [toast, setToast]             = useState('')
  const [expandedNotes, setExpandedNotes] = useState(null)

  const notify = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const [td, ud] = await Promise.all([tasksAPI.getTasks(token), authAPI.getUsers(token)])
      setTasks(td.tasks || []); setUsers(ud.users || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async task => {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    try { await tasksAPI.deleteTask(token, task._id); setTasks(p => p.filter(t => t._id !== task._id)); notify('Task deleted.') }
    catch { notify('Failed to delete.') }
  }

  const deptLabel = v => DEPTS.find(d => d.value === v)?.label || '—'
  const filtered  = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const counts    = { todo: tasks.filter(t => t.status === 'todo').length, ip: tasks.filter(t => t.status === 'in-progress').length, done: tasks.filter(t => t.status === 'done').length }

  return (
    <div className="card mt-1">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl text-sm shadow-xl">{toast}</div>}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-white">All Tasks</h3>
          <div className="flex gap-1 flex-wrap">
            {[{k:'all',l:`All (${tasks.length})`},{k:'todo',l:`To Do (${counts.todo})`},{k:'in-progress',l:`In Progress (${counts.ip})`},{k:'done',l:`Done (${counts.done})`}].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filter === f.k ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{f.l}</button>
            ))}
          </div>
        </div>
        {!showCreate && !editTask && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>+ Add Task</button>
        )}
      </div>

      {showCreate && <TaskForm users={users} token={token} onSave={() => { setShowCreate(false); load(); notify('Task created!') }} onCancel={() => setShowCreate(false)} />}
      {editTask   && <TaskForm initial={editTask} users={users} token={token} isEdit onSave={() => { setEditTask(null); load(); notify('Task updated!') }} onCancel={() => setEditTask(null)} />}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl"><p className="text-gray-600 text-sm">No tasks — click "+ Add Task" to create one</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 border-b border-gray-700">
                {['Task','Description','Assigned To','Department','Status','Priority','Due Date','Notes',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(task => (
                <>
                  <tr key={task._id} className="hover:bg-gray-800/20 transition-colors align-top">
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap max-w-[140px] truncate">{task.title}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{task.description || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{task.assignedTo[0].toUpperCase()}</div>
                          <span className="text-gray-300 text-xs">{task.assignedTo}</span>
                        </div>
                      ) : <span className="text-gray-600 text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{deptLabel(task.department)}</td>
                    <td className="px-4 py-3"><Chip {...(TASK_STATUS[task.status] || TASK_STATUS.todo)} /></td>
                    <td className="px-4 py-3"><Chip {...(TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium)} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{task.dueDate ? fmtDate(task.dueDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedNotes(p => p === task._id ? null : task._id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          task.comments?.length > 0
                            ? expandedNotes === task._id ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:text-gray-300'
                        }`}>
                        💬 {task.comments?.length > 0 ? `${task.comments.length} note${task.comments.length > 1 ? 's' : ''}` : 'Notes'}
                        <span className={`transition-transform text-xs ${expandedNotes === task._id ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditTask(task); setShowCreate(false); setExpandedNotes(null) }} className="px-3 py-1 text-xs font-medium text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-all">Edit</button>
                        <button onClick={() => handleDelete(task)} className="px-3 py-1 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all">Delete</button>
                      </div>
                    </td>
                  </tr>
                  {expandedNotes === task._id && (
                    <tr key={`${task._id}-notes`} className="bg-gray-900/60">
                      <td colSpan={9} className="px-6 py-4 border-t border-gray-800/60">
                        <p className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">Notes & Updates — {task.title}</p>
                        {task.comments?.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {task.comments.map((c, i) => (
                              <div key={i} className="flex gap-3 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
                                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{c.author[0].toUpperCase()}</div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-semibold text-white">{c.author}</p>
                                    <p className="text-xs text-gray-600">{fmtDate(c.createdAt)}</p>
                                  </div>
                                  <p className="text-sm text-gray-300">{c.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-gray-600 text-xs mb-4">No notes yet from assigned user.</p>}
                        <CommentBox task={task} token={token} onUpdated={load} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssignedTasksPanel({ token, userId }) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const td = await tasksAPI.getTasks(token)
      setTasks((td.tasks || []).filter(t => t.assignedToId === userId || t.assignedTo === userId))
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  const deptLabel = v => DEPTS.find(d => d.value === v)?.label || '—'

  return (
    <div className="card mt-1">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">My Tasks</h3>
        <p className="text-gray-500 text-xs mt-0.5">{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl"><p className="text-2xl mb-2">✅</p><p className="text-gray-500 text-sm">No tasks assigned to you yet</p></div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-white text-sm">{task.title}</p>
                  {task.description && <p className="text-gray-400 text-xs mt-1">{task.description}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Chip {...(TASK_STATUS[task.status] || TASK_STATUS.todo)} />
                  <Chip {...(TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium)} />
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mb-3">
                <span>🏢 {deptLabel(task.department)}</span>
                {task.dueDate && <span>📅 Due {fmtDate(task.dueDate)}</span>}
              </div>
              <CommentBox task={task} token={token} onUpdated={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 1 — PROJECT HEALTH CARD
// ─────────────────────────────────────────────────────────

function ProjectHealthCard({ health, setHealth, avgProgress, canEdit, isExternal }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(health)
  const cfg = HEALTH_CFG[health.status] || HEALTH_CFG.on_track

  if (isExternal) {
    return (
      <div className="card flex items-center gap-5">
        <div className={`relative flex-shrink-0`}>
          <div className={`w-5 h-5 rounded-full ${cfg.dot}`} />
          <div className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-20`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Project Status</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-white">{avgProgress}%</span>
            <Chip label={cfg.label} color={cfg.badge} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card border-2 ${cfg.card}`}>
      {!editing ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className={`w-5 h-5 rounded-full ${cfg.dot}`} />
              <div className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-20`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{health.projectName}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-4xl font-bold text-white">{avgProgress}%</span>
                <div className="flex flex-col gap-1">
                  <Chip label={cfg.label} color={cfg.badge} />
                  <p className="text-xs text-gray-600">Overall Progress</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Target Date</p>
              <p className="text-sm font-semibold text-white">{fmtDate(health.targetDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Active Blockers</p>
              <p className={`text-sm font-semibold ${health.blockers > 0 ? 'text-red-400' : 'text-green-400'}`}>{health.blockers}</p>
            </div>
            {canEdit && <EditBtn onClick={() => { setDraft(health); setEditing(true) }} />}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-white mb-4">Edit Project Health</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Status</label>
              <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))} className="input-field">
                <option value="on_track">On Track</option>
                <option value="attention">Attention</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Target Date</label>
              <input type="date" value={draft.targetDate} onChange={e => setDraft(p => ({ ...p, targetDate: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Active Blockers</label>
              <input type="number" min={0} value={draft.blockers} onChange={e => setDraft(p => ({ ...p, blockers: +e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setHealth(draft); setEditing(false) }} className="px-4 py-2 text-white text-sm font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Save</button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 2 — DEPARTMENT PROGRESS BARS
// ─────────────────────────────────────────────────────────

function DeptProgressSection({ depts, setDepts, canEditAll, editOwnDept, onNavigate, userDept }) {
  const [editId, setEditId] = useState(null)
  const [draft,  setDraft]  = useState({})

  return (
    <SectionCard title="Department Progress">
      <div>
        {depts.map(dept => {
          const meta   = DEPT_META.find(m => m.id === dept.id)
          const cfg    = HEALTH_CFG[dept.status] || HEALTH_CFG.on_track
          const canEdit = canEditAll || (editOwnDept && userDept === dept.id)
          const isEditing = editId === dept.id

          return (
            <div key={dept.id} className="py-3 border-b border-gray-800 last:border-0">
              {!isEditing ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate?.(meta?.tabId)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                  >
                    <span className="text-base w-6 text-center flex-shrink-0">{meta?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm text-gray-300 font-medium group-hover:text-white transition-colors truncate">{meta?.label}</p>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <Chip label={cfg.label} color={cfg.badge} />
                          <span className="text-xs text-gray-500 w-8 text-right">{dept.progress}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${dept.progress >= 75 ? 'bg-green-500' : dept.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${dept.progress}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  {canEdit && (
                    <button onClick={() => { setDraft({ progress: dept.progress, status: dept.status }); setEditId(dept.id) }}
                      className="flex-shrink-0 text-xs text-gray-500 hover:text-violet-400 px-2 py-1 border border-transparent hover:border-violet-500/30 rounded-lg transition-all">
                      Edit
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-base w-6 text-center flex-shrink-0">{meta?.icon}</span>
                  <p className="text-sm text-gray-300 font-medium w-36 flex-shrink-0">{meta?.label}</p>
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <input type="number" min={0} max={100} value={draft.progress}
                      onChange={e => setDraft(p => ({ ...p, progress: +e.target.value }))}
                      className="input-field w-20 text-sm py-1" />
                    <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))} className="input-field text-sm py-1">
                      <option value="on_track">On Track</option>
                      <option value="attention">Attention</option>
                      <option value="delayed">Delayed</option>
                    </select>
                    <button onClick={() => { setDepts(p => p.map(d => d.id === dept.id ? { ...d, ...draft, lastUpdated: new Date().toISOString() } : d)); setEditId(null) }}
                      className="px-3 py-1 text-white text-xs font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Save</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 3 — KEY DEPENDENCIES
// ─────────────────────────────────────────────────────────

function DependenciesSection({ deps, setDeps, canEdit, isExternal }) {
  const [editId, setEditId] = useState(null)
  const [draft,  setDraft]  = useState({})

  return (
    <SectionCard title="Key Dependencies">
      <div className="space-y-2">
        {deps.map(dep => {
          const scfg = DEP_STATUS_CFG[dep.status] || DEP_STATUS_CFG.not_started
          return (
            <div key={dep.id} className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-xl">
              {editId !== dep.id ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-base flex-shrink-0">{dep.icon}</span>
                      <p className="text-sm text-gray-200 font-medium truncate">{dep.label}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Chip label={scfg.label} color={scfg.color} />
                      {canEdit && (
                        <button onClick={() => { setDraft({ status: dep.status, expectedDate: dep.expectedDate, notes: dep.notes }); setEditId(dep.id) }}
                          className="text-xs text-gray-500 hover:text-violet-400 transition-colors">Edit</button>
                      )}
                    </div>
                  </div>
                  {!isExternal && (
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                      <span>📅 Expected: {fmtDate(dep.expectedDate)}</span>
                      <span>· {dep.notes}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-200">{dep.icon} {dep.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Status</label>
                      <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))} className="input-field text-xs py-1">
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Expected Date</label>
                      <input type="date" value={draft.expectedDate} onChange={e => setDraft(p => ({ ...p, expectedDate: e.target.value }))} className="input-field text-xs py-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Notes</label>
                      <input type="text" value={draft.notes} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} className="input-field text-xs py-1" />
                    </div>
                  </div>
                  <SaveCancel onSave={() => { setDeps(p => p.map(d => d.id === dep.id ? { ...d, ...draft } : d)); setEditId(null) }} onCancel={() => setEditId(null)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 4 — RISK PANEL
// ─────────────────────────────────────────────────────────

function RiskPanel({ risks, setRisks, canEditAll, editOwnDept, userDept }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId,  setEditId]  = useState(null)
  const [draft,   setDraft]   = useState({})
  const [newRisk, setNewRisk] = useState({ text: '', impact: 'medium', owner: '', ownerDept: '', mitigation: '' })

  const canEdit = r => canEditAll || (editOwnDept && r.ownerDept === userDept)

  return (
    <SectionCard
      title="Risk Panel"
      action={(canEditAll || editOwnDept) && !showAdd && <AddBtn onClick={() => setShowAdd(true)} label="+ Add Risk" />}
    >
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">New Risk</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Risk Description</label>
              <input type="text" value={newRisk.text} onChange={e => setNewRisk(p => ({ ...p, text: e.target.value }))} placeholder="Describe the risk..." className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Impact</label>
              <select value={newRisk.impact} onChange={e => setNewRisk(p => ({ ...p, impact: e.target.value }))} className="input-field">
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Owner</label>
              <input type="text" value={newRisk.owner} onChange={e => setNewRisk(p => ({ ...p, owner: e.target.value }))} placeholder="e.g. HR, Production" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Mitigation</label>
              <input type="text" value={newRisk.mitigation} onChange={e => setNewRisk(p => ({ ...p, mitigation: e.target.value }))} placeholder="Mitigation plan..." className="input-field" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (!newRisk.text.trim()) return; setRisks(p => [...p, { ...newRisk, id: `r${Date.now()}` }]); setNewRisk({ text: '', impact: 'medium', owner: '', ownerDept: '', mitigation: '' }); setShowAdd(false) }}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Add Risk</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {risks.map(r => {
          const icfg = RISK_CFG[r.impact] || RISK_CFG.medium
          return (
            <div key={r.id} className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-xl">
              {editId !== r.id ? (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <Chip label={icfg.label} color={icfg.color} />
                      <p className="text-sm text-gray-200 font-medium flex-1">{r.text}</p>
                    </div>
                    <p className="text-xs text-gray-500">Owner: <span className="text-gray-400">{r.owner}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Mitigation: <span className="text-gray-400">{r.mitigation}</span></p>
                  </div>
                  {canEdit(r) && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setDraft({ text: r.text, impact: r.impact, owner: r.owner, ownerDept: r.ownerDept, mitigation: r.mitigation }); setEditId(r.id) }}
                        className="text-xs text-gray-500 hover:text-violet-400 px-1 transition-colors">Edit</button>
                      <button onClick={() => setRisks(p => p.filter(x => x.id !== r.id))}
                        className="text-xs text-gray-500 hover:text-red-400 px-1 transition-colors">✕</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Risk</label>
                      <input type="text" value={draft.text} onChange={e => setDraft(p => ({ ...p, text: e.target.value }))} className="input-field text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Impact</label>
                      <select value={draft.impact} onChange={e => setDraft(p => ({ ...p, impact: e.target.value }))} className="input-field text-xs">
                        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Owner</label>
                      <input type="text" value={draft.owner} onChange={e => setDraft(p => ({ ...p, owner: e.target.value }))} className="input-field text-xs" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Mitigation</label>
                      <input type="text" value={draft.mitigation} onChange={e => setDraft(p => ({ ...p, mitigation: e.target.value }))} className="input-field text-xs" />
                    </div>
                  </div>
                  <SaveCancel onSave={() => { setRisks(p => p.map(x => x.id === r.id ? { ...x, ...draft } : x)); setEditId(null) }} onCancel={() => setEditId(null)} />
                </div>
              )}
            </div>
          )
        })}
        {risks.length === 0 && (
          <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl"><p className="text-gray-600 text-sm">No active risks logged</p></div>
        )}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 5 — ACTIVITY FEED
// ─────────────────────────────────────────────────────────

const DOT_COLORS = ['bg-green-500','bg-blue-500','bg-red-500','bg-violet-500','bg-purple-500','bg-yellow-500','bg-pink-500']

function ActivityFeed({ activities, setActivities, canAddAll, canAddOwn, viewAll, userDept, userName }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ text: '', dept: userDept || '' })
  const canAdd = canAddAll || canAddOwn
  const visible = viewAll ? activities : activities.filter(a => a.dept === userDept)

  return (
    <SectionCard
      title={<span className="flex items-center gap-2">Activity Feed <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-normal">Live</span></span>}
      action={canAdd && !showAdd && <AddBtn onClick={() => setShowAdd(true)} label="+ Add Update" />}
    >
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
          {canAddAll && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Department</label>
              <select value={newItem.dept} onChange={e => setNewItem(p => ({ ...p, dept: e.target.value }))} className="input-field">
                <option value="">Select department</option>
                {DEPT_META.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Update</label>
            <textarea value={newItem.text} onChange={e => setNewItem(p => ({ ...p, text: e.target.value }))} placeholder="What's the latest update?" rows={2} className="input-field resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!newItem.text.trim()) return
              const meta = DEPT_META.find(d => d.id === (newItem.dept || userDept))
              setActivities(p => [{ id: `a${Date.now()}`, dept: newItem.dept || userDept, deptLabel: meta?.label || '', text: newItem.text.trim(), author: userName || 'User', time: new Date().toISOString() }, ...p])
              setNewItem({ text: '', dept: userDept || '' }); setShowAdd(false)
            }} className="px-4 py-2 text-white text-sm font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Post Update</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
          </div>
        </div>
      )}
      <div>
        {visible.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl"><p className="text-gray-600 text-sm">No activity yet</p></div>
        ) : visible.slice(0, 8).map((a, i) => (
          <div key={a.id} className="flex gap-3 py-3 border-b border-gray-800 last:border-0">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${DOT_COLORS[i % DOT_COLORS.length]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300"><span className="font-medium text-white">{a.deptLabel}</span><span className="text-gray-600 mx-1">·</span>{a.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-600">{a.author}</span>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-600">{timeAgo(a.time)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 6 — 7-DAY ACTION PLAN
// ─────────────────────────────────────────────────────────

function ActionPlan({ plan, setPlan, canEditAll, canEditOwn, viewAll, userDept }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId,  setEditId]  = useState(null)
  const [draft,   setDraft]   = useState({})
  const [newItem, setNewItem] = useState({ dept: userDept || '', task: '', priority: 'normal', dueDay: 'Mon' })

  const visible    = viewAll ? plan : plan.filter(p => p.dept === userDept)
  const canAdd     = canEditAll || canEditOwn
  const canEdit    = item => canEditAll || (canEditOwn && item.dept === userDept)
  const canToggle  = item => canEditAll || (canEditOwn && item.dept === userDept)

  const byDay = {}
  WEEK_DAYS.forEach(d => { byDay[d] = visible.filter(p => p.dueDay === d) })

  return (
    <SectionCard
      title="7-Day Action Plan"
      action={canAdd && !showAdd && <AddBtn onClick={() => setShowAdd(true)} label="+ Add Task" />}
    >
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">New Weekly Task</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs text-gray-400 mb-1">Task</label>
              <input type="text" value={newItem.task} onChange={e => setNewItem(p => ({ ...p, task: e.target.value }))} placeholder="What needs to be done?" className="input-field" />
            </div>
            {canEditAll && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Department</label>
                <select value={newItem.dept} onChange={e => setNewItem(p => ({ ...p, dept: e.target.value }))} className="input-field">
                  <option value="">Select...</option>
                  {DEPT_META.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select value={newItem.priority} onChange={e => setNewItem(p => ({ ...p, priority: e.target.value }))} className="input-field">
                <option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Due Day</label>
              <select value={newItem.dueDay} onChange={e => setNewItem(p => ({ ...p, dueDay: e.target.value }))} className="input-field">
                {WEEK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!newItem.task.trim()) return
              const meta = DEPT_META.find(d => d.id === (newItem.dept || userDept))
              setPlan(p => [...p, { ...newItem, id: `pl${Date.now()}`, dept: newItem.dept || userDept, deptLabel: meta?.label || '', done: false }])
              setNewItem({ dept: userDept || '', task: '', priority: 'normal', dueDay: 'Mon' }); setShowAdd(false)
            }} className="px-4 py-2 text-white text-sm font-medium rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>Add Task</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {WEEK_DAYS.filter(d => byDay[d]?.length > 0).map(day => (
          <div key={day}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">{day}</p>
            <div className="space-y-2">
              {byDay[day].map(item => {
                const pcfg = PRIORITY_CFG[item.priority] || PRIORITY_CFG.normal
                return (
                  <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${item.done ? 'bg-gray-900/20 border-gray-800/50 opacity-60' : 'bg-gray-800/40 border-gray-700/50'}`}>
                    {editId !== item.id ? (
                      <>
                        <button
                          onClick={() => canToggle(item) && setPlan(p => p.map(x => x.id === item.id ? { ...x, done: !x.done } : x))}
                          className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${item.done ? 'bg-green-500 border-green-500' : 'border-gray-600'} ${canToggle(item) ? 'cursor-pointer hover:border-violet-400' : 'cursor-default'}`}
                        >
                          {item.done && <svg viewBox="0 0 12 12" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-xs text-gray-500">{item.deptLabel}</span>
                            <Chip label={pcfg.label} color={pcfg.color} />
                          </div>
                          <p className={`text-sm ${item.done ? 'line-through text-gray-500' : 'text-gray-200'}`}>{item.task}</p>
                        </div>
                        {canEdit(item) && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setDraft({ dept: item.dept, task: item.task, priority: item.priority, dueDay: item.dueDay }); setEditId(item.id) }} className="text-xs text-gray-600 hover:text-violet-400 transition-colors px-1">Edit</button>
                            <button onClick={() => setPlan(p => p.filter(x => x.id !== item.id))} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-1">✕</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <input type="text" value={draft.task} onChange={e => setDraft(p => ({ ...p, task: e.target.value }))} className="input-field text-xs" />
                          </div>
                          <select value={draft.priority} onChange={e => setDraft(p => ({ ...p, priority: e.target.value }))} className="input-field text-xs">
                            <option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option>
                          </select>
                          <select value={draft.dueDay} onChange={e => setDraft(p => ({ ...p, dueDay: e.target.value }))} className="input-field text-xs">
                            {WEEK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <SaveCancel
                          onSave={() => { const meta = DEPT_META.find(d => d.id === draft.dept); setPlan(p => p.map(x => x.id === item.id ? { ...x, ...draft, deptLabel: meta?.label || draft.dept } : x)); setEditId(null) }}
                          onCancel={() => setEditId(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl"><p className="text-gray-600 text-sm">No tasks planned for this week</p></div>
        )}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// SECTION 7 — LAST UPDATED TIMESTAMPS
// ─────────────────────────────────────────────────────────

function LastUpdatedSection({ depts, setDepts, canUpdateAll, canUpdateOwn, userDept }) {
  return (
    <SectionCard title="Last Updated — Department Accountability">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {depts.map(dept => {
          const meta    = DEPT_META.find(m => m.id === dept.id)
          const stale   = staleness(dept.lastUpdated)
          const canMark = canUpdateAll || (canUpdateOwn && dept.id === userDept)
          const days    = daysSince(dept.lastUpdated)
          return (
            <div key={dept.id} className={`p-3 rounded-xl border ${stale.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{meta?.icon}</span>
                <p className="text-xs font-medium text-gray-300 truncate">{meta?.label}</p>
              </div>
              <p className={`text-sm font-semibold ${stale.text}`}>{timeAgo(dept.lastUpdated)}</p>
              <p className="text-xs text-gray-600 mt-0.5">{days < 1 ? 'Today' : days < 2 ? '1 day ago' : `${Math.floor(days)} days ago`}</p>
              {canMark && (
                <button
                  onClick={() => setDepts(p => p.map(d => d.id === dept.id ? { ...d, lastUpdated: new Date().toISOString() } : d))}
                  className="mt-2 w-full py-1 text-xs text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all"
                >
                  Mark Updated
                </button>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// MAIN OVERVIEW TAB
// ─────────────────────────────────────────────────────────

function OverviewTab({ onNavigate }) {
  const { token, user } = useAuth()
  const perms           = usePermissions()

  // All 7 sections state
  const [health,     setHealth]     = useState(INIT_HEALTH)
  const [depts,      setDepts]      = useState(INIT_DEPTS)
  const [deps,       setDeps]       = useState(INIT_DEPS)
  const [risks,      setRisks]      = useState(INIT_RISKS)
  const [activities, setActivities] = useState(INIT_ACTIVITIES)
  const [plan,       setPlan]       = useState(INIT_PLAN)

  // Task panel
  const [taskCount,   setTaskCount]   = useState(0)
  const [tasksOpen,   setTasksOpen]   = useState(false)
  const [tasksLoaded, setTasksLoaded] = useState(false)

  const { isSuperAdmin, isManagement, isDepartmentHead, isDepartmentUser, isExternal } = perms
  const userDept       = user?.department || ''
  const canManageTasks = isSuperAdmin || isDepartmentHead
  const canEditAll     = isSuperAdmin
  const canViewAll     = isSuperAdmin || isManagement || isDepartmentHead
  const editOwnDept    = isDepartmentHead

  useEffect(() => {
    tasksAPI.getTasks(token)
      .then(d => {
        const count = canManageTasks
          ? (d.count || 0)
          : (d.tasks || []).filter(t => t.assignedToId === user?.id || t.assignedTo === user?.name).length
        setTaskCount(count)
      })
      .catch(() => {})
  }, [])

  // Computed overall % from dept averages
  const avgProgress = Math.round(depts.reduce((s, d) => s + d.progress, 0) / depts.length)

  // ── External: minimal view ────────────────────────────
  if (isExternal) {
    return (
      <div className="space-y-6">
        <ProjectHealthCard health={health} setHealth={setHealth} avgProgress={avgProgress} canEdit={false} isExternal />
        <DependenciesSection deps={deps} setDeps={setDeps} canEdit={false} isExternal />
      </div>
    )
  }

  // ── Dept User: only own tasks + own feed/plan ─────────
  if (isDepartmentUser) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => { setTasksOpen(o => !o); setTasksLoaded(true) }}
            className={`bg-gray-900 border rounded-xl p-4 text-left transition-all relative ${tasksOpen ? 'border-violet-500/60 ring-1 ring-violet-500/30' : 'border-violet-500/30 hover:border-violet-500/60'}`}>
            <p className="text-gray-400 text-xs mb-1">My Tasks</p>
            <p className="text-2xl font-bold text-violet-400">{taskCount}</p>
            <p className="text-gray-500 text-xs mt-1">Assigned to you</p>
            <span className={`absolute top-3 right-3 text-violet-400 text-xs transition-transform duration-200 ${tasksOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
        </div>
        {tasksLoaded && tasksOpen && <AssignedTasksPanel token={token} userId={user?.id} />}
        <ActivityFeed activities={activities} setActivities={setActivities} canAddAll={false} canAddOwn={false} viewAll={false} userDept={userDept} userName={user?.name} />
        <ActionPlan plan={plan} setPlan={setPlan} canEditAll={false} canEditOwn={false} viewAll={false} userDept={userDept} />
      </div>
    )
  }

  // ── Full view: Super Admin, Management, Dept Head ─────
  return (
    <div className="space-y-6">

      {/* 1. Project Health Card */}
      <ProjectHealthCard health={health} setHealth={setHealth} avgProgress={avgProgress} canEdit={canEditAll} isExternal={false} />

      {/* Stat cards + tasks panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => { setTasksOpen(o => !o); setTasksLoaded(true) }}
          className={`bg-gray-900 border rounded-xl p-4 text-left transition-all relative ${tasksOpen ? 'border-violet-500/60 ring-1 ring-violet-500/30' : 'border-violet-500/30 hover:border-violet-500/60'}`}>
          <p className="text-gray-400 text-xs mb-1">{canManageTasks ? 'Total Tasks' : 'My Tasks'}</p>
          <p className="text-2xl font-bold text-violet-400">{taskCount}</p>
          <p className="text-gray-500 text-xs mt-1">{canManageTasks ? 'All departments' : 'Assigned to you'}</p>
          <span className={`absolute top-3 right-3 text-violet-400 text-xs transition-transform duration-200 ${tasksOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <div className="bg-gray-900 border border-green-500/30 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">On Track</p>
          <p className="text-2xl font-bold text-green-400">{depts.filter(d => d.status === 'on_track').length}</p>
          <p className="text-gray-500 text-xs mt-1">Departments</p>
        </div>
        <div className="bg-gray-900 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Needs Attention</p>
          <p className="text-2xl font-bold text-yellow-400">{depts.filter(d => d.status === 'attention').length}</p>
          <p className="text-gray-500 text-xs mt-1">Departments</p>
        </div>
        <div className="bg-gray-900 border border-red-500/30 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Delayed</p>
          <p className="text-2xl font-bold text-red-400">{depts.filter(d => d.status === 'delayed').length}</p>
          <p className="text-gray-500 text-xs mt-1">Critical</p>
        </div>
      </div>

      {tasksLoaded && tasksOpen && (
        canManageTasks
          ? <ManagerTasksPanel token={token} />
          : <AssignedTasksPanel token={token} userId={user?.id} />
      )}

      {/* 2 + 3: Dept Progress | Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeptProgressSection depts={depts} setDepts={setDepts} canEditAll={canEditAll} editOwnDept={editOwnDept} onNavigate={onNavigate} userDept={userDept} />
        <DependenciesSection deps={deps} setDeps={setDeps} canEdit={canEditAll} isExternal={false} />
      </div>

      {/* 4 + 5: Risks | Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskPanel risks={risks} setRisks={setRisks} canEditAll={canEditAll} editOwnDept={editOwnDept} userDept={userDept} />
        <ActivityFeed activities={activities} setActivities={setActivities} canAddAll={canEditAll} canAddOwn={editOwnDept} viewAll={canViewAll} userDept={userDept} userName={user?.name} />
      </div>

      {/* 6: 7-Day Action Plan */}
      <ActionPlan plan={plan} setPlan={setPlan} canEditAll={canEditAll} canEditOwn={editOwnDept} viewAll={canViewAll} userDept={userDept} />

      {/* 7: Last Updated Accountability */}
      <LastUpdatedSection depts={depts} setDepts={setDepts} canUpdateAll={canEditAll} canUpdateOwn={editOwnDept} userDept={userDept} />

    </div>
  )
}

export default OverviewTab
