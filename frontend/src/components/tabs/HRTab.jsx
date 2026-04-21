// FILE: src/components/tabs/HRTab.jsx
// WHAT THIS IS:
//   The HR section of the dashboard.
//   Sub-tabs: Employee List, Labour Law, Current Updates, Admin

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import hrAPI from '../../api/hr'
import { useLanguage } from '../../context/LanguageContext'

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
  const [form,    setForm]    = useState(EMPTY_EMPLOYEE)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <h3 className="text-base font-semibold text-white mb-1">{t('addNewEmployee')}</h3>
      <p className="text-gray-500 text-sm mb-5">{t('fillEmployeeDetails')}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
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
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              {t('rating')}
            </label>
            <StarRating value={form.rating} onChange={(val) => setForm(f => ({ ...f, rating: val }))} />
          </div>
        </div>

        {/* Address — full width */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            {t('address')}
          </label>
          <textarea
            value={form.address}
            onChange={set('address')}
            placeholder="e.g. 123 Main Street, Johannesburg, 2001"
            rows={2}
            className="input-field resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00684A, #00ED64)' }}
          >
            {loading ? t('saving') : t('saveEmployee')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
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
          <h3 className="text-base font-semibold text-white">Employee List</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: 'linear-gradient(135deg, #00684A, #00ED64)' }}
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
          <div className="w-6 h-6 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
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
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Employee Code</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">ID Number</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Department</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Address</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Rating</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {employees.map(emp => (
                <tr key={emp._id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{emp.employeeCode}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{emp.idNumber}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">{deptLabel(emp.department)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{emp.phoneNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">{emp.address || '—'}</td>
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
      <p className="text-gray-400 font-medium">Labour Law</p>
      <p className="text-gray-600 text-sm mt-1">Labour law guidelines and compliance documents will appear here</p>
    </div>
  )
}

// ── Current Updates sub-tab ──────────────────────
function CurrentUpdates() {
  return (
    <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-gray-400 font-medium">Current Updates</p>
      <p className="text-gray-600 text-sm mt-1">HR announcements and updates will appear here</p>
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
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3 overflow-x-auto">
        {HR_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
              subTab === tab.id
                ? 'text-emerald-700 border-b-2 border-emerald-700'
                : 'text-gray-400 hover:text-gray-900 border-b-2 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {renderSubTab()}
    </div>
  )
}
