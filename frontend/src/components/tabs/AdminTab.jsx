import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import authAPI from '../../api/auth'
import departmentStateAPI from '../../api/department-state'
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
  { id: 'overview', label: 'Overview', group: 'GENERAL' },
  { id: 'chat', label: 'Chat', group: 'GENERAL' },
  { id: 'hr', label: 'Hiring & HR', group: 'DEPARTMENTS' },
  { id: 'production', label: 'Production & Factory', group: 'DEPARTMENTS' },
  { id: 'finance', label: 'Finance & Accounts', group: 'DEPARTMENTS' },
  { id: 'government', label: 'Govt. & Compliance', group: 'DEPARTMENTS' },
  { id: 'sales', label: 'Sales & Marketing', group: 'DEPARTMENTS' },
  { id: 'operations', label: 'Operations & Logistics', group: 'DEPARTMENTS' },
  { id: 'training', label: 'Training & Dev.', group: 'DEPARTMENTS' },
  { id: 'procurement-plus', label: 'Procurement Plus', group: 'DEPARTMENTS' },
]

const ERP_PERMISSION_ROWS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'accounts', label: 'Accounts', icon: '📁' },
  { id: 'mappings', label: 'Mappings', icon: '🔗' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'currencies', label: 'Currency Master', icon: '💱' },
  { id: 'enquiry', label: 'Account Summary', icon: '🔍' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'customer-margin', label: 'Customer Margin', icon: '📈' },
  { id: 'supplier-margin', label: 'Supplier Margin', icon: '📉' },
  { id: 'ledger', label: 'Ledger', icon: '📒' },
  { id: 'transactions', label: 'Transactions', icon: '🔄' },
  { id: 'reports', label: 'Reports', icon: '📋' },
  { id: 'vendors', label: 'Vendors', icon: '🏢' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'vouchers', label: 'Vouchers', icon: '🧾' },
  { id: 'direct-deals', label: 'Fixing Deals', icon: '🤝' },
  { id: 'fixing-register', label: 'Net Position', icon: '📌' },
]

const PERMISSIONS_PANEL_HEIGHT = 'min(640px, calc(100vh - 210px))'

const SETTINGS_KEY = 'ops-dashboard-admin-settings-v2'

const ROLE_COLOR = {
  super_admin: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  management: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  department_head: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  department_user: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
  external: { bg: '#ECFCCB', text: '#3F6212', border: '#BEF264' },
}

const AVATAR_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']

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
  applicationName: 'HR Management System',
  applicationUrl: 'https://hr.company.com',
  dateFormat: 'DD/MM/YYYY',
  timezone: '(UTC+05:30) Asia/Kolkata',
  passwordPolicy: 'strong',
  sessionTimeoutMinutes: '0',
  maxLoginAttempts: '5',
  twoFactorAuth: true,
  smtpHost: 'smtp.company.com',
  smtpPort: '587',
  emailFrom: 'noreply@company.com',
  emailFromName: 'HR Management System',
  enableEmailNotifications: true,
  notifyNewUserRegistration: true,
  notifyPasswordReset: true,
  notifyLoginAlerts: true,
  notifySystemUpdates: true,
  dataEncryption: true,
  auditLogging: true,
  userDataExport: false,
  defaultPageSize: '10',
  itemsPerPageOptions: '10, 20, 50, 100',
  language: 'English',
  defaultTheme: 'Light',
}

const ADMIN = {
  page: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  ink: '#0F172A',
  inkSoft: '#64748B',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  green: '#10B981',
  greenSoft: '#ECFDF5',
  purpleSoft: '#EEF2FF',
}

function deptLabel(val) {
  return DEPTS.find((d) => d.value === val)?.label || 'None'
}

function roleLabel(val) {
  return ROLES.find((r) => r.value === val)?.label || val
}

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleDateString('en-GB')
}

function avatarColor(name = '') {
  const code = String(name).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: '#fff', border: `1px solid ${ADMIN.border}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 30px rgba(15,23,42,0.12)', fontSize: '0.875rem', color: ADMIN.ink }}>
      {message}
    </div>
  )
}

function AdminTabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        padding: '0.55rem 1.1rem',
        borderRadius: '0.55rem',
        border: active ? 'none' : `1px solid ${ADMIN.border}`,
        background: active ? ADMIN.primary : '#fff',
        color: active ? '#fff' : ADMIN.ink,
        fontWeight: 700,
        fontSize: '0.875rem',
        cursor: 'pointer',
        boxShadow: active ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function MetricCard({ label, value, tone = 'blue', icon }) {
  const tones = {
    blue: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    green: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
    amber: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
    purple: { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  }
  const t = tones[tone] || tones.blue
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14, padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ margin: '0.35rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: ADMIN.ink, lineHeight: 1 }}>{value}</p>
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', color: t.text, flexShrink: 0 }}>
        {icon}
      </div>
    </div>
  )
}

function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: ADMIN.inkSoft, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{children}</label>
}

function AdminInput({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#F8FAFC', fontSize: '0.875rem', color: ADMIN.ink, outline: 'none' }}
    />
  )
}

function AdminSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#F8FAFC', fontSize: '0.875rem', color: ADMIN.ink }}
    >
      {children}
    </select>
  )
}

function SwitchToggle({ checked, onChange, label, desc, color = 'purple' }) {
  const onColor = color === 'green' ? ADMIN.green : ADMIN.primary
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0', borderBottom: `1px solid ${ADMIN.border}` }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: ADMIN.ink }}>{label}</p>
        {desc && <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: ADMIN.inkSoft }}>{desc}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={checked}
        style={{ width: 44, height: 24, borderRadius: 999, border: 'none', background: checked ? onColor : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
      </button>
    </div>
  )
}

function SettingsSection({ title, desc, accent = 'green', icon, children }) {
  const accentColor = accent === 'green' ? ADMIN.green : ADMIN.primary
  return (
    <div style={{ background: ADMIN.card, border: `1px solid ${ADMIN.border}`, borderRadius: 14, padding: '1.1rem 1.2rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
        <span style={{ color: accentColor, display: 'grid', placeItems: 'center' }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: accentColor, letterSpacing: '0.06em' }}>{title}</p>
          {desc && <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: ADMIN.inkSoft }}>{desc}</p>}
        </div>
      </div>
      {children}
    </div>
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
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        <div><FieldLabel>Username *</FieldLabel><AdminInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. john.smith" /></div>
        <div><FieldLabel>Full Name</FieldLabel><AdminInput value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="John Smith" /></div>
        <div><FieldLabel>{isEdit ? 'Reset Password' : 'Password *'}</FieldLabel><AdminInput type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 8 characters'} /></div>
        <div><FieldLabel>Job Title</FieldLabel><AdminInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Operations Supervisor" /></div>
        <div><FieldLabel>Phone</FieldLabel><AdminInput value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+27 82 555 1234" /></div>
        <div><FieldLabel>Location</FieldLabel><AdminInput value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Johannesburg HQ" /></div>
        <div><FieldLabel>Timezone</FieldLabel><AdminInput value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="Africa/Johannesburg" /></div>
        <div><FieldLabel>Employee Code</FieldLabel><AdminInput value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))} placeholder="EMP-021" /></div>
      </div>

      <div>
        <FieldLabel>Role</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.55rem' }}>
          {ROLES.map((r) => (
            <label key={r.value} style={{ display: 'flex', gap: '0.55rem', padding: '0.65rem', borderRadius: 10, border: `1px solid ${form.role === r.value ? ADMIN.primary : ADMIN.border}`, background: form.role === r.value ? ADMIN.purpleSoft : '#fff', cursor: 'pointer' }}>
              <input type="radio" name={isEdit ? 'edit-role' : 'create-role'} checked={form.role === r.value} onChange={() => setForm((f) => ({ ...f, role: r.value, department: '', allowedModules: [] }))} />
              <span><span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: ADMIN.ink }}>{r.label}</span><span style={{ display: 'block', fontSize: '0.72rem', color: ADMIN.inkSoft, marginTop: 2 }}>{r.desc}</span></span>
            </label>
          ))}
        </div>
      </div>

      {(form.role === 'department_head' || form.role === 'department_user') && (
        <div><FieldLabel>Department</FieldLabel><AdminSelect value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>{DEPTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</AdminSelect></div>
      )}

      {form.role === 'external' && (
        <div>
          <FieldLabel>Allowed Modules</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem' }}>
            {ALL_MODULES.map((mod) => (
              <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.55rem', borderRadius: 8, border: `1px solid ${form.allowedModules.includes(mod) ? ADMIN.primary : ADMIN.border}`, background: form.allowedModules.includes(mod) ? ADMIN.purpleSoft : '#fff', fontSize: '0.78rem', textTransform: 'capitalize' }}>
                <input type="checkbox" checked={form.allowedModules.includes(mod)} onChange={() => toggleModule(mod)} />
                {mod}
              </label>
            ))}
          </div>
        </div>
      )}

      {form.role === 'department_user' && (
        <div><FieldLabel>Assigned Task IDs</FieldLabel><AdminInput value={form.assignedTasks} onChange={(e) => setForm((f) => ({ ...f, assignedTasks: e.target.value }))} placeholder="task-001, task-002" /></div>
      )}

      <div><FieldLabel>Access Notes</FieldLabel><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Onboarding notes, escalation owner, special access considerations" style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#F8FAFC', fontSize: '0.875rem', resize: 'vertical' }} /></div>
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
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
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
    <div style={{ background: ADMIN.card, border: `1px solid ${ADMIN.border}`, borderRadius: 14, padding: '1.2rem', marginBottom: '1rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
      <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 800, color: ADMIN.ink }}>Create New User</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: ADMIN.inkSoft }}>Create user accounts with operational metadata, department ownership, and access notes.</p>
      {error && <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: '0.84rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <UserFormFields form={form} setForm={setForm} />
        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '1rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Creating…' : 'Create User'}</button>
          <button type="button" onClick={onCancel} style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#fff', color: ADMIN.ink, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
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
    if (form.password && form.password.length < 8) return setError('Reset password must be at least 8 characters.')
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <div style={{ width: 'min(920px, 100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 14, padding: '1.2rem', boxShadow: '0 20px 50px rgba(15,23,42,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div><h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: ADMIN.ink }}>Edit User</h3><p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: ADMIN.inkSoft }}>@{u.name}</p></div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', cursor: 'pointer', color: ADMIN.inkSoft }}>×</button>
        </div>
        {error && <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: '0.84rem' }}>{error}</div>}
        <UserFormFields form={form} setForm={setForm} isEdit />
        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
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
    if (!window.confirm(`Deactivate and remove "${u.name}" from the active user list?`)) return
    const reason = window.prompt('Reason/comment for removing this user:', 'Admin removed user')
    if (!reason || reason.trim().length < 4) {
      notify('Reason is required.')
      return
    }
    try {
      await authAPI.deleteUser(token, u._id, reason.trim())
      onRefresh()
      notify(`${u.name} deactivated and removed from active list.`)
    } catch {
      notify('Failed to remove user.')
    }
  }

  return (
    <div>
      <Toast message={toast} />
      {editUser && <EditUserModal user={editUser} token={token} onSave={() => { setEditUser(null); onRefresh(); notify('User updated.') }} onClose={() => setEditUser(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.1rem' }}>
        <MetricCard label="Total Users" value={summary.total} tone="blue" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
        <MetricCard label="Active Accounts" value={summary.active} tone="green" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>} />
        <MetricCard label="Department Heads" value={summary.heads} tone="amber" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 4.8L20 8l-4 3.9.9 5.5L12 15.8 7.1 17.4 8 11.9 4 8l5.6-1.2L12 2z"/></svg>} />
        <MetricCard label="External Users" value={summary.external} tone="purple" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: ADMIN.ink }}>Users & Access</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.84rem', color: ADMIN.inkSoft }}>Manage user accounts, departments, role profiles, and access metadata.</p>
        </div>
        {!showCreate && (
          <button type="button" onClick={() => setShowCreate(true)} style={{ padding: '0.55rem 1rem', borderRadius: 8, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ Add User</button>
        )}
      </div>

      {showCreate && <CreateUserForm token={token} onCreated={() => { setShowCreate(false); onRefresh(); notify('User created.') }} onCancel={() => setShowCreate(false)} />}

      <div style={{ background: ADMIN.card, border: `1px solid ${ADMIN.border}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          <div>
            <FieldLabel>Search</FieldLabel>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: ADMIN.inkSoft }}>🔍</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user, title, code, phone or location" style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#F8FAFC', fontSize: '0.875rem' }} />
            </div>
          </div>
          <div><FieldLabel>Role Filter</FieldLabel><AdminSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All roles</option>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</AdminSelect></div>
          <div><FieldLabel>Department Filter</FieldLabel><AdminSelect value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}><option value="all">All departments</option>{DEPTS.filter((d) => d.value).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</AdminSelect></div>
        </div>
      </div>

      <div style={{ background: ADMIN.card, border: `1px solid ${ADMIN.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${ADMIN.border}` }}>
                {['User', 'Role', 'Department', 'Access Profile', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.68rem', fontWeight: 700, color: ADMIN.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const rc = ROLE_COLOR[u.role] || ROLE_COLOR.department_user
                const isSelf = String(u._id) === String(me?.id || me?._id || '')
                return (
                  <tr key={u._id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(u.name), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{u.name?.[0]?.toUpperCase()}</div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: ADMIN.ink }}>{u.fullName || u.name}{isSelf && <span style={{ marginLeft: 6, color: ADMIN.primary, fontSize: '0.75rem' }}>(you)</span>}</p>
                          <p style={{ margin: '0.15rem 0 0', color: ADMIN.inkSoft, fontSize: '0.78rem' }}>@{u.name}</p>
                          <p style={{ margin: '0.15rem 0 0', color: ADMIN.inkSoft, fontSize: '0.75rem' }}>{u.title || 'No title'} • {u.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}><span style={{ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 999, background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, fontSize: '0.72rem', fontWeight: 700 }}>{roleLabel(u.role)}</span></td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', color: ADMIN.inkSoft }}>{deptLabel(u.department)}</td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', fontSize: '0.75rem', color: ADMIN.inkSoft, lineHeight: 1.5 }}>
                      <div>Timezone: {u.timezone || '—'}</div>
                      <div>Tasks: {u.assignedTasks?.length || 0}</div>
                      <div>Module access: {u.allowedModules?.length ? u.allowedModules.join(', ') : 'Default role access'}</div>
                      <div>Last Login: {formatDate(u.lastLogin)}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: u.isActive ? '#047857' : '#B91C1C' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.isActive ? '#10B981' : '#EF4444' }} />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      {isSelf ? (
                        <span style={{ fontSize: '0.75rem', color: ADMIN.inkSoft }}>Self account protected</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button type="button" onClick={() => setEditUser(u)} style={actionBtn('#6366F1', '#EEF2FF')}>Edit</button>
                          <button type="button" onClick={() => onOpenPermissions(u._id)} style={actionBtn('#6366F1', '#EEF2FF')}>Permissions</button>
                          <button type="button" onClick={() => handleToggle(u)} style={actionBtn('#B45309', '#FFFBEB')}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                          <button type="button" onClick={() => handleDelete(u)} style={actionBtn('#B91C1C', '#FEF2F2')}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && <div style={{ textAlign: 'center', padding: '2.5rem', color: ADMIN.inkSoft }}>No users match the current filters.</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: `1px solid ${ADMIN.border}`, background: '#F8FAFC', fontSize: '0.78rem', color: ADMIN.inkSoft }}>
          <span>Showing 1 to {filteredUsers.length} of {filteredUsers.length} users</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" disabled style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${ADMIN.border}`, background: '#fff', opacity: 0.5 }}>‹</button>
            <button type="button" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700 }}>1</button>
            <button type="button" disabled style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${ADMIN.border}`, background: '#fff', opacity: 0.5 }}>›</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function actionBtn(color, bg) {
  return { padding: '0.28rem 0.55rem', borderRadius: 6, border: `1px solid ${color}33`, background: bg, color, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }
}

function PermissionToggle({ checked, onChange, compact = false }) {
  const w = compact ? 36 : 44
  const h = compact ? 20 : 24
  const knob = compact ? 14 : 18
  const onLeft = compact ? 18 : 22
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        border: 'none',
        background: checked ? ADMIN.primary : '#CBD5E1',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: (h - knob) / 2,
          left: checked ? onLeft : (h - knob) / 2,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s ease',
          boxShadow: '0 1px 2px rgba(15,23,42,0.12)',
        }}
      />
    </button>
  )
}

function PermissionRow({ label, icon, checked, onToggle, compact = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.45rem',
        padding: compact ? '0.32rem 0.55rem' : '0.75rem 1rem',
        borderBottom: `1px solid ${ADMIN.border}`,
        minHeight: compact ? 34 : undefined,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
        {icon && <span style={{ fontSize: compact ? '0.82rem' : '0.95rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>}
        <span style={{ fontSize: compact ? '0.78rem' : '0.875rem', fontWeight: 600, color: ADMIN.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </span>
      <PermissionToggle checked={checked} onChange={onToggle} compact={compact} />
    </div>
  )
}

function PermissionGroupCard({ title, desc, rows, checkedFor, onToggle, twoCol = false }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${ADMIN.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.45rem 0.65rem 0.35rem', borderBottom: `1px solid ${ADMIN.border}`, background: '#FAFBFC' }}>
        <p style={{ margin: 0, fontSize: '0.64rem', fontWeight: 800, color: ADMIN.inkSoft, letterSpacing: '0.08em' }}>{title}</p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: ADMIN.inkSoft }}>{desc}</p>
      </div>
      <div style={{ display: twoCol ? 'grid' : 'block', gridTemplateColumns: twoCol ? '1fr 1fr' : undefined, flex: 1, minHeight: 0 }}>
        {rows.map((row) => (
          <PermissionRow
            key={row.id}
            label={row.label}
            icon={row.icon}
            checked={checkedFor(row.id)}
            onToggle={() => onToggle(row.id)}
            compact
          />
        ))}
      </div>
    </section>
  )
}

function PermissionsTab({ users, token, initialUserId, onRefresh }) {
  const selectableUsers = useMemo(() => users.filter((u) => u.role !== 'super_admin'), [users])
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || selectableUsers[0]?._id || null)
  const [userQuery, setUserQuery] = useState('')
  const [erpModuleQuery, setErpModuleQuery] = useState('')
  const [erpSectionOpen, setErpSectionOpen] = useState(true)
  const [perms, setPerms] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (initialUserId) setSelectedUserId(initialUserId)
  }, [initialUserId])

  useEffect(() => {
    const u = users.find((x) => x._id === selectedUserId)
    setPerms(u?.modulePermissions || {})
  }, [selectedUserId, users])

  const filteredSidebarUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return selectableUsers
    return selectableUsers.filter((u) => [u.name, u.fullName].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [selectableUsers, userQuery])

  const selectedUser = selectableUsers.find((u) => u._id === selectedUserId)
  const erpSubs = perms.erp?.subs || {}
  const erpAllEnabled = !!perms.erp?.on && Object.keys(erpSubs).length === 0

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

  const toggleErpSubTab = (subId) => {
    setPerms((p) => {
      const currentSubs = p.erp?.on && !p.erp?.subs
        ? ERP_PERMISSION_ROWS.reduce((acc, row) => ({ ...acc, [row.id]: { on: true } }), {})
        : p.erp?.subs || {}
      const nextSubs = { ...currentSubs }
      if (nextSubs[subId]?.on) delete nextSubs[subId]
      else nextSubs[subId] = { on: true }
      const next = { ...p }
      if (!Object.keys(nextSubs).length) delete next.erp
      else next.erp = { ...(p.erp || {}), on: true, subs: nextSubs }
      return next
    })
  }

  const isErpSubOn = (subId) => erpAllEnabled || !!erpSubs[subId]?.on

  const filteredErpRows = useMemo(() => {
    const q = erpModuleQuery.trim().toLowerCase()
    if (!q) return ERP_PERMISSION_ROWS
    return ERP_PERMISSION_ROWS.filter((row) => row.label.toLowerCase().includes(q) || row.id.includes(q))
  }, [erpModuleQuery])

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
      <Toast message={toast} />
      <div style={{
        display: 'flex',
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: ADMIN.card,
        height: PERMISSIONS_PANEL_HEIGHT,
        maxHeight: PERMISSIONS_PANEL_HEIGHT,
        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
      }}
      >
        <div style={{ width: 220, borderRight: `1px solid ${ADMIN.border}`, background: '#F8FAFC', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '0.65rem 0.75rem', borderBottom: `1px solid ${ADMIN.border}`, background: '#fff' }}>
            <p style={{ margin: '0 0 0.45rem', fontSize: '0.64rem', fontWeight: 800, color: ADMIN.inkSoft, letterSpacing: '0.08em' }}>USERS</p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: ADMIN.inkSoft, fontSize: '0.75rem' }}>🔍</span>
              <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search users..." style={{ width: '100%', padding: '0.38rem 0.55rem 0.38rem 1.65rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, fontSize: '0.76rem' }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {filteredSidebarUsers.map((u) => {
              const rc = ROLE_COLOR[u.role] || ROLE_COLOR.department_user
              const selected = selectedUserId === u._id
              return (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => setSelectedUserId(u._id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.55rem 0.7rem',
                    border: 'none',
                    borderLeft: `3px solid ${selected ? ADMIN.primary : 'transparent'}`,
                    background: selected ? ADMIN.purpleSoft : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(u.name), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0 }}>{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: ADMIN.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName || u.name}</p>
                    <span style={{ display: 'inline-block', marginTop: 3, padding: '0.08rem 0.38rem', borderRadius: 999, background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, fontSize: '0.62rem', fontWeight: 700 }}>{roleLabel(u.role)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {!selectedUser ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: ADMIN.inkSoft }}>Select a user to manage permissions</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.85rem', borderBottom: `1px solid ${ADMIN.border}`, background: '#fff', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(selectedUser.name), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.82rem' }}>{selectedUser.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, color: ADMIN.ink, fontSize: '0.92rem' }}>{selectedUser.fullName || selectedUser.name}</p>
                    <span style={{ display: 'inline-block', marginTop: 2, padding: '0.08rem 0.38rem', borderRadius: 999, background: ADMIN.purpleSoft, color: ADMIN.primary, fontSize: '0.62rem', fontWeight: 700 }}>{roleLabel(selectedUser.role)}</span>
                  </div>
                </div>
                <button type="button" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: 8, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  💾 {saving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>

              <div style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                padding: '0.55rem 0.75rem',
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                gap: '0.5rem',
                background: '#F8FAFC',
              }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.75fr) minmax(280px, 1.25fr)', gap: '0.5rem', minHeight: 0 }}>
                  <PermissionGroupCard
                    title="GENERAL"
                    desc="Core workspace areas"
                    rows={ALL_PERM_ROWS.filter((row) => row.group === 'GENERAL')}
                    checkedFor={(id) => !!perms[id]?.on}
                    onToggle={toggleModule}
                  />
                  <PermissionGroupCard
                    title="DEPARTMENTS"
                    desc="Department modules available in the sidebar"
                    rows={ALL_PERM_ROWS.filter((row) => row.group === 'DEPARTMENTS')}
                    checkedFor={(id) => !!perms[id]?.on}
                    onToggle={toggleModule}
                    twoCol
                  />
                </div>

                <section style={{ background: '#fff', border: `1px solid ${ADMIN.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.45rem 0.65rem', borderBottom: `1px solid ${ADMIN.border}`, background: '#FAFBFC', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                      <button type="button" onClick={() => setErpSectionOpen((open) => !open)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ADMIN.inkSoft, fontSize: '0.75rem', padding: 0 }} aria-label={erpSectionOpen ? 'Collapse ERP section' : 'Expand ERP section'}>
                        {erpSectionOpen ? '▾' : '▸'}
                      </button>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.64rem', fontWeight: 800, color: ADMIN.inkSoft, letterSpacing: '0.08em' }}>ERP</p>
                        <p style={{ margin: '0.08rem 0 0', fontSize: '0.68rem', color: ADMIN.inkSoft }}>ERP pages available in the sidebar · {ERP_PERMISSION_ROWS.length} items</p>
                      </div>
                    </div>
                    <div style={{ position: 'relative', width: 'min(220px, 42%)' }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: ADMIN.inkSoft, fontSize: '0.72rem' }}>🔍</span>
                      <input value={erpModuleQuery} onChange={(e) => setErpModuleQuery(e.target.value)} placeholder="Search modules..." style={{ width: '100%', padding: '0.32rem 0.5rem 0.32rem 1.55rem', borderRadius: 8, border: `1px solid ${ADMIN.border}`, fontSize: '0.72rem' }} />
                    </div>
                  </div>
                  {erpSectionOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                      {filteredErpRows.map((row) => (
                        <PermissionRow
                          key={row.id}
                          label={row.label}
                          icon={row.icon}
                          checked={isErpSubOn(row.id)}
                          onToggle={() => toggleErpSubTab(row.id)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsTab() {
  const { token } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await departmentStateAPI.getDepartmentState(token, 'admin')
        if (mounted && res?.state && typeof res.state === 'object') {
          setSettings({ ...DEFAULT_SETTINGS, ...res.state })
        }
      } catch {
        try {
          const saved = window.localStorage.getItem(SETTINGS_KEY)
          if (mounted && saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
        } catch {
          // use defaults
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [token])

  const notify = (msg) => {
    setToast(msg)
    window.clearTimeout(notify.t)
    notify.t = window.setTimeout(() => setToast(''), 2500)
  }

  const saveSettings = async () => {
    try {
      await departmentStateAPI.saveDepartmentState(token, 'admin', settings)
      window.localStorage.removeItem(SETTINGS_KEY)
      notify('Settings saved successfully.')
    } catch {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      notify('Saved locally — sync to server when online.')
    }
  }

  const setToggle = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }))

  return (
    <div>
      <Toast message={toast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: ADMIN.ink }}>General Settings</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.84rem', color: ADMIN.inkSoft }}>Configure global application settings and preferences.</p>
        </div>
        <button type="button" onClick={saveSettings} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 8, border: 'none', background: ADMIN.primary, color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>💾 {loading ? 'Loading…' : 'Save Settings'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <SettingsSection title="SYSTEM SETTINGS" accent="green" icon="⚙️">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><FieldLabel>Application Name</FieldLabel><AdminInput value={settings.applicationName} onChange={(e) => setSettings((s) => ({ ...s, applicationName: e.target.value }))} /></div>
            <div><FieldLabel>Application URL</FieldLabel><AdminInput value={settings.applicationUrl} onChange={(e) => setSettings((s) => ({ ...s, applicationUrl: e.target.value }))} /></div>
            <div><FieldLabel>Date Format</FieldLabel><AdminSelect value={settings.dateFormat} onChange={(e) => setSettings((s) => ({ ...s, dateFormat: e.target.value }))}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></AdminSelect></div>
            <div><FieldLabel>Timezone</FieldLabel><AdminSelect value={settings.timezone} onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}><option>(UTC+05:30) Asia/Kolkata</option><option>(UTC+02:00) Africa/Johannesburg</option><option>(UTC+00:00) UTC</option><option>(UTC+04:00) Asia/Dubai</option></AdminSelect></div>
          </div>
        </SettingsSection>

        <SettingsSection title="SECURITY SETTINGS" accent="purple" icon="🔒">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><FieldLabel>Password Policy</FieldLabel><AdminSelect value={settings.passwordPolicy} onChange={(e) => setSettings((s) => ({ ...s, passwordPolicy: e.target.value }))}><option value="strong">Strong (8+ characters, mix of letters, numbers & symbols)</option><option value="medium">Medium (8+ characters)</option><option value="basic">Basic (6+ characters)</option></AdminSelect></div>
            <div>
              <FieldLabel>Session Timeout (Minutes)</FieldLabel>
              <AdminInput value={settings.sessionTimeoutMinutes} onChange={(e) => setSettings((s) => ({ ...s, sessionTimeoutMinutes: e.target.value }))} placeholder="0" />
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Use <strong>0</strong> to stay signed in until logout. Use 5–1440 for auto logout after N minutes.
              </div>
            </div>
            <div><FieldLabel>Max Login Attempts</FieldLabel><AdminInput value={settings.maxLoginAttempts} onChange={(e) => setSettings((s) => ({ ...s, maxLoginAttempts: e.target.value }))} /></div>
            <SwitchToggle checked={settings.twoFactorAuth} onChange={() => setToggle('twoFactorAuth')} label="Two-Factor Authentication" desc="Require 2FA for all users." color="purple" />
          </div>
        </SettingsSection>

        <SettingsSection title="EMAIL SETTINGS" accent="green" icon="✉️">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><FieldLabel>SMTP Host</FieldLabel><AdminInput value={settings.smtpHost} onChange={(e) => setSettings((s) => ({ ...s, smtpHost: e.target.value }))} /></div>
            <div><FieldLabel>SMTP Port</FieldLabel><AdminInput value={settings.smtpPort} onChange={(e) => setSettings((s) => ({ ...s, smtpPort: e.target.value }))} /></div>
            <div><FieldLabel>Email From</FieldLabel><AdminInput value={settings.emailFrom} onChange={(e) => setSettings((s) => ({ ...s, emailFrom: e.target.value }))} /></div>
            <div><FieldLabel>Email From Name</FieldLabel><AdminInput value={settings.emailFromName} onChange={(e) => setSettings((s) => ({ ...s, emailFromName: e.target.value }))} /></div>
            <SwitchToggle checked={settings.enableEmailNotifications} onChange={() => setToggle('enableEmailNotifications')} label="Enable Email Notifications" desc="Send email notifications for important events." color="green" />
          </div>
        </SettingsSection>

        <SettingsSection title="NOTIFICATION SETTINGS" accent="purple" icon="🔔">
          <SwitchToggle checked={settings.notifyNewUserRegistration} onChange={() => setToggle('notifyNewUserRegistration')} label="New User Registration" desc="Notify admins when a new user registers." color="purple" />
          <SwitchToggle checked={settings.notifyPasswordReset} onChange={() => setToggle('notifyPasswordReset')} label="Password Reset Request" desc="Notify admins for password reset requests." color="purple" />
          <SwitchToggle checked={settings.notifyLoginAlerts} onChange={() => setToggle('notifyLoginAlerts')} label="User Login Alerts" desc="Notify admins for suspicious login attempts." color="purple" />
          <SwitchToggle checked={settings.notifySystemUpdates} onChange={() => setToggle('notifySystemUpdates')} label="System Updates" desc="Receive notifications about system updates." color="purple" />
        </SettingsSection>

        <SettingsSection title="DATA & PRIVACY" accent="green" icon="🛡️">
          <SwitchToggle checked={settings.dataEncryption} onChange={() => setToggle('dataEncryption')} label="Data Encryption" desc="Encrypt sensitive data." color="green" />
          <SwitchToggle checked={settings.auditLogging} onChange={() => setToggle('auditLogging')} label="Audit Logging" desc="Log all user activities." color="green" />
          <SwitchToggle checked={settings.userDataExport} onChange={() => setToggle('userDataExport')} label="User Data Export" desc="Allow users to export their data." color="green" />
        </SettingsSection>

        <SettingsSection title="OTHER SETTINGS" accent="purple" icon="🎛️">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><FieldLabel>Default Page Size</FieldLabel><AdminSelect value={settings.defaultPageSize} onChange={(e) => setSettings((s) => ({ ...s, defaultPageSize: e.target.value }))}><option>10</option><option>20</option><option>50</option><option>100</option></AdminSelect></div>
            <div><FieldLabel>Items Per Page Options</FieldLabel><AdminInput value={settings.itemsPerPageOptions} onChange={(e) => setSettings((s) => ({ ...s, itemsPerPageOptions: e.target.value }))} /></div>
            <div><FieldLabel>Language</FieldLabel><AdminSelect value={settings.language} onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}><option>English</option><option>Arabic</option><option>French</option></AdminSelect></div>
            <div><FieldLabel>Default Theme</FieldLabel><AdminSelect value={settings.defaultTheme} onChange={(e) => setSettings((s) => ({ ...s, defaultTheme: e.target.value }))}><option>Light</option><option>Dark</option><option>System</option></AdminSelect></div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}

function AdminTab() {
  const { token } = useAuth()
  const { t } = useLanguage()
  const [subTab, setSubTab] = useState('users')
  const [selectedPermUserId, setSelectedPermUserId] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await authAPI.getUsers(token)
      setUsers(data.users || [])
    } catch (e) {
      console.error('Failed to load users', e)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadUsers() }, [loadUsers])

  const tabs = [
    { id: 'users', label: 'Users', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'permissions', label: 'Permissions', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { id: 'settings', label: t('settings') || 'Settings', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  ]

  return (
    <div style={{ background: ADMIN.page, borderRadius: 16, padding: '1rem 1.1rem 1.25rem', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <AdminTabButton key={tab.id} active={subTab === tab.id} onClick={() => setSubTab(tab.id)} icon={tab.icon} label={tab.label} />
          ))}
        </div>
        <button type="button" title="Admin modules" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${ADMIN.border}`, background: '#fff', color: ADMIN.inkSoft, cursor: 'pointer' }}>▦</button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: '4rem 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: ADMIN.primary, animation: 'spin 0.8s linear infinite' }} />
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      ) : (
        <>
          {subTab === 'users' && <UsersTab users={users} token={token} onRefresh={loadUsers} onOpenPermissions={(id) => { setSelectedPermUserId(id); setSubTab('permissions') }} />}
          {subTab === 'permissions' && <PermissionsTab users={users} token={token} initialUserId={selectedPermUserId} onRefresh={loadUsers} />}
          {subTab === 'settings' && <SettingsTab />}
        </>
      )}
    </div>
  )
}

export default AdminTab
