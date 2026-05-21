// FILE: src/components/tabs/HRTab.jsx
// WHAT THIS IS:
//   The HR section of the dashboard.
//   Sub-tabs: Employee List, Labour Law, Current Updates, Admin

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import hrAPI from '../../api/hr'
import { useLanguage } from '../../context/LanguageContext'
import { ErpSubTabButton, ModuleTabColumn } from '../layout/ModuleTabChrome'

function getHRSubTabs(t) {
  return [
    { id: 'employee_list',   label: t('employeeList') },
    { id: 'labour_law',      label: t('labourLaw') },
    { id: 'current_updates', label: t('currentUpdates') },
  ]
}

const DEPARTMENTS = [
  { value: '',            label: 'Select department' },
  { value: 'production',  label: 'Production & Factory' },
  { value: 'hr',          label: 'Hiring & HR' },
  { value: 'finance',     label: 'Finance & Accounts' },
  { value: 'government',  label: 'Govt. & Compliance' },
  { value: 'sales',       label: 'Sales & Marketing' },
  { value: 'operations',  label: 'Operations & Logistics' },
  { value: 'training',    label: 'Training & Development' },
  { value: 'management',  label: 'Management' },
]

const EMPTY_EMPLOYEE = {
  name: '',
  idNumber: '',
  employeeCode: '',
  address: '',
  phoneNumber: '',
  department: '',
  rating: 3,
}

// ── Star rating input ────────────────────────────
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl transition-colors leading-none ${
            star <= (hover || value) ? 'text-yellow-400' : 'text-gray-700'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── Add Employee form ────────────────────────────
function AddEmployeeForm({ onSave, onCancel, token }) {
  const { t } = useLanguage()
  const [form, setForm] = useState(EMPTY_EMPLOYEE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 26 })
  const dragRef = useRef(null)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const startDrag = (event) => {
    const point = event.touches?.[0] || event
    dragRef.current = {
      startX: point.clientX - position.x,
      startY: point.clientY - position.y,
    }
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMove = (event) => {
      if (!dragRef.current) return
      const point = event.touches?.[0] || event
      const nextX = point.clientX - dragRef.current.startX
      const nextY = point.clientY - dragRef.current.startY
      const maxX = Math.max(window.innerWidth / 2 - 180, 0)
      const maxY = Math.max(window.innerHeight - 220, 80)

      setPosition({
        x: Math.min(Math.max(nextX, -maxX), maxX),
        y: Math.min(Math.max(nextY, 12), maxY),
      })
    }

    const stopDrag = () => {
      dragRef.current = null
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', stopDrag)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', stopDrag)
      document.body.style.userSelect = ''
    }
  }, [position.x, position.y])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())         return setError(t('hrErrName'))
    if (!form.idNumber.trim())     return setError(t('hrErrId'))
    if (!form.employeeCode.trim()) return setError(t('hrErrCode'))
    setLoading(true)
    setError('')
    try {
      await hrAPI.createEmployee(token, form)
      onSave()
    } catch (err) {
      setError(err.response?.data?.message || t('hrErrSave'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[950] bg-slate-950/35 px-4 py-5 backdrop-blur-[2px]">
      <div
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div
          className="flex cursor-move items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4"
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        >
          <div>
            <h3 className="text-base font-semibold leading-tight text-slate-950">{t('addNewEmployee')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('fillEmployeeDetails')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-lg font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Close add employee form"
          >
            x
          </button>
        </div>

        <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-5">

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Name */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('fullName')} <span className="text-emerald-700">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. John Smith"
              className="input-field"
            />
          </div>

          {/* ID Number */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('idNumber')} <span className="text-emerald-700">*</span>
            </label>
            <input
              type="text"
              value={form.idNumber}
              onChange={set('idNumber')}
              placeholder="e.g. 8501015009087"
              className="input-field"
            />
          </div>

          {/* Employee Code */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('employeeCode')} <span className="text-emerald-700">*</span>
            </label>
            <input
              type="text"
              value={form.employeeCode}
              onChange={set('employeeCode')}
              placeholder="e.g. EMP-001"
              className="input-field"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('phoneNumber')}
            </label>
            <input
              type="text"
              value={form.phoneNumber}
              onChange={set('phoneNumber')}
              placeholder="e.g. 082 555 1234"
              className="input-field"
            />
          </div>

          {/* Department */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('department')}
            </label>
            <select
              value={form.department}
              onChange={set('department')}
              className="input-field"
            >
              {DEPARTMENTS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
              {t('rating')}
            </label>
            <StarRating value={form.rating} onChange={(val) => setForm(f => ({ ...f, rating: val }))} />
          </div>
        </div>

        {/* Address — full width */}
        <div className="mt-4">
          <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
            {t('address')}
          </label>
          <textarea
            value={form.address}
            onChange={set('address')}
            placeholder="e.g. 123 Main Street, Johannesburg, 2001"
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #00684A, #13AA52)', color: '#ffffff' }}
          >
            {loading ? t('saving') : t('saveEmployee')}
          </button>
        </div>
      </form>
        </div>
      </div>
    </div>
  )
}

// ── Employee List sub-tab ────────────────────────
function EmployeeList({ token }) {
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [error,     setError]     = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await hrAPI.getEmployees(token)
      setEmployees(data.employees || [])
    } catch {
      setError('Failed to load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return
    try {
      await hrAPI.deleteEmployee(token, id)
      setEmployees(prev => prev.filter(e => e._id !== id))
    } catch {
      setError('Failed to delete employee.')
    }
  }

  const renderStars = (rating) =>
    [1, 2, 3, 4, 5].map(s => (
      <span key={s} className={s <= rating ? 'text-yellow-400' : 'text-gray-800'}>★</span>
    ))

  const deptLabel = (val) => DEPARTMENTS.find(d => d.value === val)?.label || val || '—'

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white leading-tight">Employee List</h3>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #00684A, #13AA52)', color: '#ffffff' }}
          >
            + Add Employee
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Add form */}
      {showForm && (
        <AddEmployeeForm
          token={token}
          onSave={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '4px solid var(--purple)', borderTopColor: 'transparent' }} />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-400 font-medium">No employees yet</p>
          <p className="text-gray-600 text-sm mt-1">Click "Add Employee" to add the first record</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Name</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Employee Code</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">ID Number</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Department</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Phone</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Address</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none">Rating</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium leading-none"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {employees.map(emp => (
                <tr key={emp._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap leading-tight">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap leading-tight">{emp.employeeCode}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap leading-tight">{emp.idNumber}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap leading-tight">{deptLabel(emp.department)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap leading-tight">{emp.phoneNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate leading-tight">{emp.address || '—'}</td>
                  <td className="px-4 py-3 text-base whitespace-nowrap">{renderStars(emp.rating)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(emp._id, emp.name)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Labour Law sub-tab ───────────────────────────
function LabourLaw() {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
      <p className="text-4xl mb-3">⚖️</p>
      <p className="text-gray-400 font-medium leading-tight">Labour Law</p>
      <p className="text-gray-600 text-sm mt-1 leading-relaxed">Labour law guidelines and compliance documents will appear here</p>
    </div>
  )
}

// ── Current Updates sub-tab ──────────────────────
function CurrentUpdates() {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-gray-400 font-medium leading-tight">Current Updates</p>
      <p className="text-gray-600 text-sm mt-1 leading-relaxed">HR announcements and updates will appear here</p>
    </div>
  )
}

// ── Main HRTab component ─────────────────────────
export default function HRTab() {
  const { token } = useAuth()
  const [subTab, setSubTab] = useState('employee_list')
  const { t } = useLanguage()
  const HR_SUB_TABS = getHRSubTabs(t)

  const renderSubTab = () => {
    switch (subTab) {
      case 'employee_list':   return <EmployeeList token={token} />
      case 'labour_law':      return <LabourLaw />
      case 'current_updates': return <CurrentUpdates />
      default:                return null
    }
  }

  return (
    <ModuleTabColumn>
      <div className="flex gap-2 flex-wrap">
        {HR_SUB_TABS.map((tab) => (
          <ErpSubTabButton key={tab.id} active={subTab === tab.id} onClick={() => setSubTab(tab.id)}>
            {tab.label}
          </ErpSubTabButton>
        ))}
      </div>

      {renderSubTab()}
    </ModuleTabColumn>
  )
}
