// FILE: src/components/tabs/AdminTab.jsx
// WHAT THIS IS:
//   The Admin section of the dashboard.
//   Sub-tabs: Users, Settings
//   Visible to: super_admin (full control), management + dept_head (read-only view)

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import authAPI from '../../api/auth'

// ── Config ───────────────────────────────────────
const ROLES = [
  { value: 'super_admin',     label: 'Super Admin',  desc: 'Full access + user management',    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { value: 'management',      label: 'Management',   desc: 'Read-only all dashboards',          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { value: 'department_head', label: 'Dept. Head',   desc: 'Full own dept, read others',        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'department_user', label: 'Dept. User',   desc: 'Limited to assigned tasks',         color: 'text-gray-300 bg-gray-700/50 border-gray-600' },
  { value: 'external',        label: 'External',     desc: 'Restricted selected modules only',  color: 'text-green-400 bg-green-500/10 border-green-500/30' },
]

const DEPTS = [
  { value: '',           label: 'None' },
  { value: 'production', label: 'Production & Factory' },
  { value: 'hr',         label: 'Hiring & HR' },
  { value: 'finance',    label: 'Finance & Accounts' },
  { value: 'government', label: 'Govt. & Compliance' },
  { value: 'sales',      label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations & Logistics' },
  { value: 'training',   label: 'Training & Dev.' },
  { value: 'management', label: 'Management' },
]

const ALL_MODULES = ['production', 'hr', 'finance', 'government', 'sales', 'operations', 'training']

const ROLE_COLOR = {
  super_admin:     'text-violet-400 bg-violet-500/10 border-violet-500/30',
  management:      'text-blue-400 bg-blue-500/10 border-blue-500/30',
  department_head: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  department_user: 'text-gray-300 bg-gray-700/50 border-gray-600',
  external:        'text-green-400 bg-green-500/10 border-green-500/30',
}

const EMPTY_FORM = { name: '', password: '', role: 'department_user', department: '', allowedModules: [], assignedTasks: '' }

// ── Create User inline form ──────────────────────
function CreateUserForm({ token, onCreated, onCancel }) {
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const toggleModule = (mod) =>
    setForm(f => ({
      ...f,
      allowedModules: f.allowedModules.includes(mod)
        ? f.allowedModules.filter(m => m !== mod)
        : [...f.allowedModules, mod],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())        return setError('Username is required.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true); setError('')
    try {
      await authAPI.createUser(token, {
        name:           form.name.trim(),
        password:       form.password,
        role:           form.role,
        department:     form.department,
        allowedModules: form.allowedModules,
        assignedTasks:  form.assignedTasks.split(',').map(s => s.trim()).filter(Boolean),
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
      <h3 className="text-base font-semibold text-white mb-1">Create New User</h3>
      <p className="text-gray-500 text-sm mb-5">Add a new user to the system.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Username <span className="text-violet-400">*</span>
            </label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. john.smith" className="input-field" />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Password <span className="text-violet-400">*</span>
            </label>
            <input type="text" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters" className="input-field" />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ROLES.map(r => (
              <label key={r.value}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.role === r.value
                    ? 'border-violet-500/60 bg-violet-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}>
                <input type="radio" name="role" value={r.value}
                  checked={form.role === r.value}
                  onChange={() => setForm(f => ({ ...f, role: r.value, department: '', allowedModules: [] }))}
                  className="accent-violet-500" />
                <div>
                  <p className="text-xs font-semibold text-white">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Department — for dept roles */}
        {(form.role === 'department_head' || form.role === 'department_user') && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Department</label>
            <select value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="input-field appearance-none">
              {DEPTS.map(d => <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>)}
            </select>
          </div>
        )}

        {/* Allowed modules — external only */}
        {form.role === 'external' && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Allowed Modules</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_MODULES.map(mod => (
                <label key={mod}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-all ${
                    form.allowedModules.includes(mod)
                      ? 'border-green-500/50 bg-green-500/10 text-green-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  <input type="checkbox" checked={form.allowedModules.includes(mod)}
                    onChange={() => toggleModule(mod)} className="accent-green-500" />
                  <span className="capitalize text-xs">{mod}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Assigned tasks — dept_user only */}
        {form.role === 'department_user' && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Assigned Task IDs</label>
            <input type="text" value={form.assignedTasks}
              onChange={e => setForm(f => ({ ...f, assignedTasks: e.target.value }))}
              placeholder="task-001, task-002" className="input-field" />
            <p className="text-xs text-gray-600 mt-1">Comma-separated</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Edit User modal ──────────────────────────────
function EditUserModal({ user: u, token, onSave, onClose }) {
  const [form,   setForm]   = useState({
    role:           u.role,
    department:     u.department || '',
    allowedModules: u.allowedModules || [],
    assignedTasks:  (u.assignedTasks || []).join(', '),
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const toggleModule = (mod) =>
    setForm(f => ({
      ...f,
      allowedModules: f.allowedModules.includes(mod)
        ? f.allowedModules.filter(m => m !== mod)
        : [...f.allowedModules, mod],
    }))

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await authAPI.updateUserRole(token, u._id, {
        role:           form.role,
        department:     form.department,
        allowedModules: form.allowedModules,
        assignedTasks:  form.assignedTasks.split(',').map(s => s.trim()).filter(Boolean),
      })
      onSave()
    } catch {
      setError('Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl my-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white">Edit User</h3>
            <p className="text-gray-500 text-xs mt-0.5">{u.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {/* Role */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Role</label>
          <div className="space-y-2">
            {ROLES.map(r => (
              <label key={r.value}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                  form.role === r.value ? 'border-violet-500/60 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600'
                }`}>
                <input type="radio" name="erole" value={r.value}
                  checked={form.role === r.value}
                  onChange={() => setForm(f => ({ ...f, role: r.value, department: '', allowedModules: [] }))}
                  className="accent-violet-500" />
                <div>
                  <p className="font-medium text-white text-xs">{r.label}</p>
                  <p className="text-gray-400 text-xs">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Department */}
        {(form.role === 'department_head' || form.role === 'department_user') && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Department</label>
            <select value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="input-field appearance-none">
              {DEPTS.map(d => <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>)}
            </select>
          </div>
        )}

        {/* Allowed modules */}
        {form.role === 'external' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Allowed Modules</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map(mod => (
                <label key={mod}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                    form.allowedModules.includes(mod)
                      ? 'border-green-500/50 bg-green-500/10 text-green-300'
                      : 'border-gray-700 text-gray-400'
                  }`}>
                  <input type="checkbox" checked={form.allowedModules.includes(mod)}
                    onChange={() => toggleModule(mod)} className="accent-green-500" />
                  <span className="capitalize">{mod}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Assigned tasks */}
        {form.role === 'department_user' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Assigned Task IDs</label>
            <input type="text" value={form.assignedTasks}
              onChange={e => setForm(f => ({ ...f, assignedTasks: e.target.value }))}
              placeholder="task-001, task-002" className="input-field" />
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-tab: Users ───────────────────────────────
function UsersTab({ users, token, onRefresh }) {
  const { user: me } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser,   setEditUser]   = useState(null)
  const [toast,      setToast]      = useState('')

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleToggle = async (u) => {
    try {
      const res = await authAPI.toggleUser(token, u._id)
      onRefresh()
      notify(res.message)
    } catch { notify('Action failed.') }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete "${u.name}"? This cannot be undone.`)) return
    try {
      await authAPI.deleteUser(token, u._id)
      onRefresh()
      notify(`${u.name} deleted.`)
    } catch { notify('Failed to delete user.') }
  }

  const deptLabel = (val) => DEPTS.find(d => d.value === val)?.label || '—'

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl text-sm shadow-xl">
          {toast}
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          token={token}
          onSave={() => { setEditUser(null); onRefresh(); notify('User updated!') }}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Users</h3>
          <p className="text-gray-500 text-sm mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} in the system</p>
        </div>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: 'linear-gradient(135deg, #7c3aed, #e040fb)' }}>
            + Add User
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateUserForm
          token={token}
          onCreated={() => { setShowCreate(false); onRefresh(); notify('User created!') }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* User table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              {['User', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {users.map(u => (
              <tr key={u._id} className="hover:bg-gray-800/20 transition-colors">
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {u.name[0].toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-white">
                      {u.name}
                      {u._id === me?.id && <span className="ml-2 text-xs text-violet-400">(you)</span>}
                    </p>
                  </div>
                </td>
                {/* Role */}
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${ROLE_COLOR[u.role]}`}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                </td>
                {/* Department */}
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">{deptLabel(u.department)}</span>
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs ${u.isActive ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                    {u._id !== me?.id ? (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setEditUser(u)}
                          className="px-3 py-1 text-xs font-medium text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-all">
                          Edit
                        </button>
                        <button onClick={() => handleToggle(u)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-all border ${
                            u.isActive
                              ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10'
                              : 'text-green-400 border-green-500/30 hover:bg-green-500/10'
                          }`}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDelete(u)}
                          className="px-3 py-1 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all">
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm">No users yet.</div>
        )}
      </div>
    </div>
  )
}

// ── Sub-tab: Settings ────────────────────────────
function SettingsTab() {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
      <p className="text-4xl mb-3">⚙️</p>
      <p className="text-gray-400 font-medium">System Settings</p>
      <p className="text-gray-600 text-sm mt-1">System configuration and preferences will appear here</p>
    </div>
  )
}

// ── Main AdminTab component ──────────────────────
const ADMIN_SUB_TABS = [
  { id: 'users',    label: 'Users' },
  { id: 'settings', label: 'Settings' },
]

function AdminTab() {
  const { token }  = useAuth()
  const [subTab,   setSubTab]  = useState('users')
  const [users,    setUsers]   = useState([])
  const [loading,  setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await authAPI.getUsers(token)
      setUsers(data.users)
    } catch (e) {
      console.error('Failed to load users', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3 overflow-x-auto">
        {ADMIN_SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              subTab === t.id
                ? 'text-violet-400 border-b-2 border-violet-500'
                : 'text-gray-400 hover:text-white border-b-2 border-transparent'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {subTab === 'users' && (
            <UsersTab
              users={users}
              token={token}
              onRefresh={loadUsers}
            />
          )}
          {subTab === 'settings' && <SettingsTab />}
        </>
      )}
    </div>
  )
}

export default AdminTab
