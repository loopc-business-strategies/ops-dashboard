import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import authAPI from '../../api/auth'
import { useLanguage } from '../../context/LanguageContext'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access + user management' },
  { value: 'management', label: 'Management', desc: 'Read-only all dashboards' },
  { value: 'department_head', label: 'Dept. Head', desc: 'Own department leadership access' },
  { value: 'department_user', label: 'Dept. User', desc: 'Operational execution for assigned department' },
  { value: 'external', label: 'External', desc: 'Restricted selected modules only' },
]

const DEPTS = [
  { value: '', label: 'None' },
  { value: 'production', label: 'Production & Factory' },
  { value: 'hr', label: 'Hiring & HR' },
  { value: 'finance', label: 'Finance & Accounts' },
  { value: 'government', label: 'Govt. & Compliance' },
  { value: 'sales', label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations & Logistics' },
  { value: 'training', label: 'Training & Dev.' },
  { value: 'management', label: 'Management' },
]

const ALL_MODULES = ['production', 'hr', 'finance', 'government', 'sales', 'operations', 'training', 'erp']

const ALL_PERM_ROWS = [
  { id: 'overview',    label: 'Overview',               group: 'GENERAL' },
  { id: 'chat',        label: 'Chat',                   group: 'GENERAL' },
  { id: 'hr',          label: 'Hiring & HR',            group: 'DEPARTMENTS' },
  { id: 'production',  label: 'Production & Factory',   group: 'DEPARTMENTS' },
  { id: 'finance',     label: 'Finance & Accounts',     group: 'DEPARTMENTS' },
  { id: 'government',  label: 'Govt. & Compliance',     group: 'DEPARTMENTS' },
  { id: 'sales',       label: 'Sales & Marketing',      group: 'DEPARTMENTS' },
  { id: 'operations',  label: 'Operations & Logistics', group: 'DEPARTMENTS' },
  { id: 'training',    label: 'Training & Dev.',        group: 'DEPARTMENTS' },
  { id: 'erp',         label: 'ERP',                    group: 'ERP' },
]

const SETTINGS_KEY = 'ops-dashboard-admin-settings-v1'

const ROLE_COLOR = {
  super_admin: 'text-emerald-700 bg-emerald-700/10 border-emerald-700/30',
  management: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  department_head: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  department_user: 'text-gray-300 bg-gray-700/50 border-gray-600',
  external: 'text-green-400 bg-green-500/10 border-green-500/30',
}

const EMPTY_FORM = {
  name: '',
  fullName: '',
  password: '',
  role: 'department_user',
  department: '',
  allowedModules: [],
  assignedTasks: '',
  title: '',
  phone: '',
  location: '',
  timezone: 'Africa/Johannesburg',
  employeeCode: '',
  notes: '',
}

const DEFAULT_SETTINGS = {
  companyName: 'Ops Dashboard Group',
  primaryRegion: 'Southern Africa',
  defaultTimezone: 'Africa/Johannesburg',
  sessionTimeoutMinutes: '45',
  passwordRotationDays: '90',
  documentWarningDays: '30',
  requireMfaForAdmins: true,
  loginAlerts: true,
  approvalEscalation: true,
  allowWeekendApprovals: false,
  dailyDigest: true,
  onboardingChecklist: true,
}

function deptLabel(val) {
  return DEPTS.find((d) => d.value === val)?.label || '—'
}

function roleLabel(val) {
  return ROLES.find((r) => r.value === val)?.label || val
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function MetricCard({ label, value, tone = 'emerald' }) {
  const toneCls = {
    emerald: 'border-emerald-700/30 bg-emerald-700/10 text-emerald-700',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-400',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}

function SettingTile({ title, desc, children }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
      <div className="mb-5">
        <h4 className="text-sm font-semibold text-white leading-tight">{title}</h4>
        <p className="text-xs text-gray-300 mt-1 leading-relaxed">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label, desc }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all`}
      style={checked ? { borderColor: 'rgba(var(--purple-rgb),0.4)', background: 'rgba(var(--purple-rgb),0.08)' } : { borderColor: 'rgb(31,41,55)', background: 'rgba(17,24,39,0.4)' }}
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-300 mt-1">{desc}</p>
      </div>
      <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition-all`} style={{ background: checked ? 'var(--purple)' : 'rgb(55,65,81)' }}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

function UserFormFields({ form, setForm, isEdit = false }) {
  const toggleModule = (mod) => {
    setForm((f) => ({
      ...f,
      allowedModules: f.allowedModules.includes(mod)
        ? f.allowedModules.filter((m) => m !== mod)
        : [...f.allowedModules, mod],
    }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Username <span className="text-emerald-700">*</span></label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. john.smith" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Full Name</label>
          <input type="text" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="e.g. John Smith" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">{isEdit ? 'Reset Password' : 'Password'} {!isEdit && <span className="text-emerald-700">*</span>}</label>
          <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={isEdit ? 'Leave blank to keep current password' : 'Min. 8 characters'} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Job Title</label>
          <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Operations Supervisor" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+27 82 555 1234" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Location</label>
          <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Johannesburg HQ" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Timezone</label>
          <input type="text" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="Africa/Johannesburg" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Employee Code</label>
          <input type="text" value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))} placeholder="EMP-021" className="input-field" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Role</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all`} style={form.role === r.value ? { borderColor: 'rgba(var(--purple-rgb),0.5)', background: 'rgba(var(--purple-rgb),0.08)' } : { borderColor: 'rgb(55,65,81)' }}>
              <input type="radio" name={isEdit ? 'edit-role' : 'create-role'} value={r.value} checked={form.role === r.value} onChange={() => setForm((f) => ({ ...f, role: r.value, department: '', allowedModules: [] }))} style={{ accentColor: 'var(--purple)' }} />
              <div>
                <p className="text-xs font-semibold text-white">{r.label}</p>
                <p className="text-xs text-gray-300">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {(form.role === 'department_head' || form.role === 'department_user') && (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Department</label>
          <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className="input-field appearance-none">
            {DEPTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      )}

      {form.role === 'external' && (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Allowed Modules</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_MODULES.map((mod) => (
              <label key={mod} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-all`} style={form.allowedModules.includes(mod) ? { borderColor: 'rgba(var(--purple-rgb),0.5)', background: 'rgba(var(--purple-rgb),0.08)', color: 'var(--purple-light)' } : { borderColor: 'rgb(55,65,81)', color: 'rgb(209,213,219)' }}>
                <input type="checkbox" checked={form.allowedModules.includes(mod)} onChange={() => toggleModule(mod)} style={{ accentColor: 'var(--purple)' }} />
                <span className="capitalize text-xs">{mod}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {form.role === 'department_user' && (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Assigned Task IDs</label>
          <input type="text" value={form.assignedTasks} onChange={(e) => setForm((f) => ({ ...f, assignedTasks: e.target.value }))} placeholder="task-001, task-002" className="input-field" />
          <p className="text-xs text-gray-300 mt-1">Comma-separated operational tasks.</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Access Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Onboarding notes, escalation owner, special access considerations" className="input-field resize-none" />
      </div>
    </div>
  )
}

function CreateUserForm({ token, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Username is required.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if ((form.role === 'department_head' || form.role === 'department_user') && !form.department) return setError('Department is required for department roles.')
    setLoading(true)
    setError('')
    try {
      await authAPI.createUser(token, {
        name: form.name.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        role: form.role,
        department: form.department,
        allowedModules: form.allowedModules,
        assignedTasks: form.assignedTasks.split(',').map((s) => s.trim()).filter(Boolean),
        title: form.title.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        timezone: form.timezone.trim(),
        employeeCode: form.employeeCode.trim(),
        notes: form.notes.trim(),
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-white mb-1">Create New User</h3>
          <p className="text-gray-300 text-sm">Create user accounts with operational metadata, department ownership, and access notes.</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <UserFormFields form={form} setForm={setForm} />
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading} className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" style={{ background: 'var(--grad-brand)' }}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
          <button type="button" onClick={onCancel} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function EditUserModal({ user: u, token, onSave, onClose }) {
  const [form, setForm] = useState({
    name: u.name || '',
    fullName: u.fullName || '',
    password: '',
    role: u.role,
    department: u.department || '',
    allowedModules: u.allowedModules || [],
    assignedTasks: (u.assignedTasks || []).join(', '),
    title: u.title || '',
    phone: u.phone || '',
    location: u.location || '',
    timezone: u.timezone || 'Africa/Johannesburg',
    employeeCode: u.employeeCode || '',
    notes: u.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Username is required.')
    if (form.password && form.password.length < 6) return setError('Reset password must be at least 6 characters.')
    if ((form.role === 'department_head' || form.role === 'department_user') && !form.department) return setError('Department is required for department roles.')
    setSaving(true)
    setError('')
    try {
      await authAPI.updateUserRole(token, u._id, {
        name: form.name.trim(),
        fullName: form.fullName.trim(),
        password: form.password.trim(),
        role: form.role,
        department: form.department,
        allowedModules: form.allowedModules,
        assignedTasks: form.assignedTasks.split(',').map((s) => s.trim()).filter(Boolean),
        title: form.title.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        timezone: form.timezone.trim(),
        employeeCode: form.employeeCode.trim(),
        notes: form.notes.trim(),
      })
      onSave()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white">Edit User</h3>
            <p className="text-gray-300 text-xs mt-0.5">{u.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-lg leading-none">x</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

        <UserFormFields form={form} setForm={setForm} isEdit />

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--grad-brand)' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTab({ users, token, onRefresh, onOpenPermissions }) {
  const { user: me } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')

  const notify = (msg) => {
    setToast(msg)
    window.clearTimeout(notify.t)
    notify.t = window.setTimeout(() => setToast(''), 3000)
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      const haystack = [u.name, u.fullName, u.title, u.employeeCode, u.phone, u.location].map((item) => String(item || '').toLowerCase())
      const matchesQuery = !q || haystack.some((item) => item.includes(q))
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesDept = deptFilter === 'all' || (u.department || '') === deptFilter
      return matchesQuery && matchesRole && matchesDept
    })
  }, [deptFilter, query, roleFilter, users])

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    external: users.filter((u) => u.role === 'external').length,
    heads: users.filter((u) => u.role === 'department_head').length,
  }), [users])

  const handleToggle = async (u) => {
    try {
      const res = await authAPI.toggleUser(token, u._id)
      onRefresh()
      notify(res.message)
    } catch {
      notify('Action failed.')
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete "${u.name}"? This cannot be undone.`)) return
    try {
      await authAPI.deleteUser(token, u._id)
      onRefresh()
      notify(`${u.name} deleted.`)
    } catch {
      notify('Failed to delete user.')
    }
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl text-sm shadow-xl">{toast}</div>}

      {editUser && (
        <EditUserModal
          user={editUser}
          token={token}
          onSave={() => { setEditUser(null); onRefresh(); notify('User updated.') }}
          onClose={() => setEditUser(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <MetricCard label="Total Users" value={summary.total} tone="emerald" />
        <MetricCard label="Active Accounts" value={summary.active} tone="green" />
        <MetricCard label="Department Heads" value={summary.heads} tone="amber" />
        <MetricCard label="External Users" value={summary.external} tone="blue" />
      </div>

      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-white leading-tight">Users & Access</h3>
          <p className="text-gray-300 text-sm mt-1 leading-relaxed">Manage user accounts, departments, role profiles, and access metadata.</p>
        </div>
        {!showCreate && <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--grad-brand)' }}>+ Add User</button>}
      </div>

      {showCreate && <CreateUserForm token={token} onCreated={() => { setShowCreate(false); onRefresh(); notify('User created.') }} onCancel={() => setShowCreate(false)} />}

      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Search</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user, title, code, phone or location" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Role Filter</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field appearance-none">
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Department Filter</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input-field appearance-none">
              <option value="all">All departments</option>
              {DEPTS.filter((d) => d.value).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              {['User', 'Role', 'Department', 'Access Profile', 'Status', 'Actions'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-300 uppercase tracking-wider">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filteredUsers.map((u) => (
              <tr key={u._id} className="hover:bg-gray-800/20 transition-colors align-top">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'var(--purple)' }}>{u.name?.[0]?.toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-medium text-white leading-tight">{u.fullName || u.name}{u._id === me?.id && <span className="ml-2 text-xs" style={{ color: 'var(--purple)' }}>(you)</span>}</p>
                      <p className="text-xs text-gray-300">@{u.name}</p>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{u.title || 'No title'}{u.employeeCode ? ` | ${u.employeeCode}` : ''}</p>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{u.phone || 'No phone'}{u.location ? ` | ${u.location}` : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${ROLE_COLOR[u.role]}`}>{roleLabel(u.role)}</span></td>
                <td className="px-4 py-3"><span className="text-xs text-gray-300">{deptLabel(u.department)}</span></td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-300 space-y-1">
                    <p>Timezone: <span className="text-gray-300">{u.timezone || '—'}</span></p>
                    <p>Tasks: <span className="text-gray-300">{u.assignedTasks?.length || 0}</span></p>
                    <p>Modules: <span className="text-gray-300">{u.allowedModules?.length ? u.allowedModules.join(', ') : 'Default role access'}</span></p>
                    <p>Last Login: <span className="text-gray-300">{formatDate(u.lastLogin)}</span></p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs ${u.isActive ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u._id !== me?.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setEditUser(u)} className="px-3 py-1 text-xs font-medium rounded-lg transition-all" style={{ color: 'var(--purple)', border: '1px solid rgba(var(--purple-rgb),0.3)' }}>Edit</button>
                      <button onClick={() => onOpenPermissions(u._id)} className="px-3 py-1 text-xs font-medium text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-all">Permissions</button>
                      <button onClick={() => handleToggle(u)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-all border ${u.isActive ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10' : 'text-green-400 border-green-500/30 hover:bg-green-500/10'}`}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => handleDelete(u)} className="px-3 py-1 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all">Delete</button>
                    </div>
                  ) : <span className="text-xs text-gray-300">Self account protected</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && <div className="text-center py-10 text-gray-300 text-sm">No users match the current filters.</div>}
      </div>
    </div>
  )
}

function SettingsTab() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [toast, setToast] = useState('')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY)
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
    } catch {
      // Ignore invalid local settings and use defaults.
    }
  }, [])

  const notify = (msg) => {
    setToast(msg)
    window.clearTimeout(notify.t)
    notify.t = window.setTimeout(() => setToast(''), 2500)
  }

  const saveSettings = () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    notify('Admin settings saved locally for this workspace.')
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    notify('Admin settings reset to defaults.')
  }

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl text-sm shadow-xl">{toast}</div>}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-white leading-tight">Admin Settings</h3>
          <p className="text-gray-300 text-sm mt-1 leading-relaxed">Configure the operating profile for user access, approvals, alerts, and onboarding defaults.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetSettings} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-all">Reset</button>
          <button onClick={saveSettings} className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-all" style={{ background: 'var(--grad-brand)' }}>Save Settings</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SettingTile title="System Profile" desc="Base operational defaults used across admin-managed processes.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Company Name</label>
              <input value={settings.companyName} onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Primary Region</label>
              <input value={settings.primaryRegion} onChange={(e) => setSettings((s) => ({ ...s, primaryRegion: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Default Timezone</label>
              <input value={settings.defaultTimezone} onChange={(e) => setSettings((s) => ({ ...s, defaultTimezone: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Document Warning Days</label>
              <input value={settings.documentWarningDays} onChange={(e) => setSettings((s) => ({ ...s, documentWarningDays: e.target.value }))} className="input-field" />
            </div>
          </div>
        </SettingTile>

        <SettingTile title="Security Defaults" desc="Define baseline controls for admin and team access.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Session Timeout (minutes)</label>
              <input value={settings.sessionTimeoutMinutes} onChange={(e) => setSettings((s) => ({ ...s, sessionTimeoutMinutes: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wider">Password Rotation (days)</label>
              <input value={settings.passwordRotationDays} onChange={(e) => setSettings((s) => ({ ...s, passwordRotationDays: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="space-y-4">
            <Toggle checked={settings.requireMfaForAdmins} onChange={() => setSettings((s) => ({ ...s, requireMfaForAdmins: !s.requireMfaForAdmins }))} label="Require stronger admin sign-in" desc="Use this as the control point for privileged-user hardening policies." />
            <Toggle checked={settings.loginAlerts} onChange={() => setSettings((s) => ({ ...s, loginAlerts: !s.loginAlerts }))} label="Send login alerts" desc="Highlights unexpected access patterns during operational hours." />
          </div>
        </SettingTile>

        <SettingTile title="Workflow Controls" desc="Operational defaults for approvals and guided onboarding.">
          <div className="space-y-4">
            <Toggle checked={settings.approvalEscalation} onChange={() => setSettings((s) => ({ ...s, approvalEscalation: !s.approvalEscalation }))} label="Escalate overdue approvals" desc="Useful for finance, compliance, and production signoff chains." />
            <Toggle checked={settings.allowWeekendApprovals} onChange={() => setSettings((s) => ({ ...s, allowWeekendApprovals: !s.allowWeekendApprovals }))} label="Allow weekend approvals" desc="Enable or block approval activity outside standard working windows." />
            <Toggle checked={settings.onboardingChecklist} onChange={() => setSettings((s) => ({ ...s, onboardingChecklist: !s.onboardingChecklist }))} label="Use onboarding checklist for new users" desc="Encourages consistent setup of role, department, and access notes." />
          </div>
        </SettingTile>

        <SettingTile title="Monitoring & Notifications" desc="Admin-facing awareness and reporting defaults.">
          <div className="space-y-4">
            <Toggle checked={settings.dailyDigest} onChange={() => setSettings((s) => ({ ...s, dailyDigest: !s.dailyDigest }))} label="Daily admin digest" desc="Summarize new users, deactivations, and pending admin issues." />
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">Role Coverage Snapshot</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                {ROLES.map((role) => (
                  <div key={role.value} className="rounded-lg border border-gray-800 px-3 py-2 bg-gray-900/40">
                    <p className="text-xs font-semibold text-white">{role.label}</p>
                    <p className="text-xs text-gray-300 mt-1">{role.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingTile>
      </div>
    </div>
  )
}

function PermissionsTab({ users, token, initialUserId, onRefresh }) {
  const selectableUsers = useMemo(() => users.filter((u) => u.role !== 'super_admin'), [users])
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || null)
  const [perms, setPerms] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (initialUserId) setSelectedUserId(initialUserId)
  }, [initialUserId])

  useEffect(() => {
    const u = users.find((x) => x._id === selectedUserId)
    setPerms(u?.modulePermissions || {})
  }, [selectedUserId]) // intentionally omit users — avoids resetting mid-edit on unrelated refreshes

  const selectedUser = selectableUsers.find((u) => u._id === selectedUserId)

  const notify = (msg) => {
    setToast(msg)
    window.clearTimeout(notify.t)
    notify.t = window.setTimeout(() => setToast(''), 3000)
  }

  const toggleModule = (modId) => {
    setPerms((p) => {
      if (p[modId]?.on) {
        const next = { ...p }
        delete next[modId]
        return next
      }
      return { ...p, [modId]: { on: true } }
    })
  }

  const handleSave = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await authAPI.updatePermissions(token, selectedUser._id, perms)
      onRefresh()
      notify('Permissions saved.')
    } catch {
      notify('Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl text-sm shadow-xl">{toast}</div>}

      <div className="flex border border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: '520px' }}>
        {/* Sidebar: user list */}
        <div className="w-52 border-r border-gray-800 flex-shrink-0 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-[10px] font-medium tracking-widest text-gray-400 uppercase">Users</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {selectableUsers.map((u) => (
              <button
                key={u._id}
                onClick={() => setSelectedUserId(u._id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-l-[3px]`}
                style={selectedUserId === u._id ? { borderLeftColor: 'var(--purple)', background: 'rgba(var(--purple-rgb),0.08)' } : { borderLeftColor: 'transparent' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ background: 'rgba(var(--purple-rgb),0.2)', color: 'var(--purple-light)' }}>
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{u.fullName || u.name}</p>
                  <p className="text-xs text-gray-400 truncate capitalize mt-0.5">{u.role?.replace(/_/g, ' ')}</p>
                </div>
              </button>
            ))}
            {selectableUsers.length === 0 && <p className="text-center py-8 text-xs text-gray-400">No users.</p>}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col">
          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
              <svg className="w-10 h-10 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="text-sm">Select a user to manage permissions</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
                <div>
                  <p className="text-sm font-medium text-white">{selectedUser.fullName || selectedUser.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{selectedUser.role?.replace(/_/g, ' ')}{selectedUser.department ? ` · ${deptLabel(selectedUser.department)}` : ''}</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'var(--grad-brand)' }}
                >
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4">
                {['GENERAL', 'DEPARTMENTS', 'ERP'].map((group) => (
                  <div key={group}>
                    <p className="text-[11px] font-medium tracking-widest text-gray-400 uppercase mt-5 mb-2 first:mt-0">{group}</p>
                    {ALL_PERM_ROWS.filter((r) => r.group === group).map((row) => {
                      const isOn = !!perms[row.id]?.on
                      return (
                        <div
                          key={row.id}
                          className={`flex items-center justify-between px-4 py-3 mb-1.5 rounded-xl border transition-all`}
                          style={isOn ? { borderColor: 'rgba(var(--purple-rgb),0.4)', background: 'rgba(var(--purple-rgb),0.04)' } : { borderColor: 'rgb(31,41,55)', background: 'rgba(17,24,39,0.3)' }}
                        >
                          <span className="text-sm text-white">{row.label}</span>
                          <button
                            onClick={() => toggleModule(row.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-all flex-shrink-0`}
                            style={{ background: isOn ? 'var(--purple)' : 'rgb(55,65,81)' }}
                          >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getAdminSubTabs(t) {
  return [
    { id: 'users', label: t('users') },
    { id: 'permissions', label: 'Permissions' },
    { id: 'settings', label: t('settings') },
  ]
}

function AdminTab() {
  const { token } = useAuth()
  const { t } = useLanguage()
  const ADMIN_SUB_TABS = useMemo(() => getAdminSubTabs(t), [t])
  const [subTab, setSubTab] = useState('users')
  const [selectedPermUserId, setSelectedPermUserId] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await authAPI.getUsers(token)
      setUsers(data.users || [])
    } catch (e) {
      console.error('Failed to load users', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3 overflow-x-auto">
        {ADMIN_SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all border-b-2 ${subTab === t.id ? '' : 'text-gray-300 hover:text-white border-transparent'}`}
            style={subTab === t.id ? { color: 'var(--purple)', borderBottom: '2px solid var(--purple)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '4px solid var(--purple)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {subTab === 'users'       && <UsersTab users={users} token={token} onRefresh={loadUsers} onOpenPermissions={(id) => { setSelectedPermUserId(id); setSubTab('permissions') }} />}
          {subTab === 'permissions' && <PermissionsTab users={users} token={token} initialUserId={selectedPermUserId} onRefresh={loadUsers} />}
          {subTab === 'settings'    && <SettingsTab />}
        </>
      )}
    </div>
  )
}

export default AdminTab

