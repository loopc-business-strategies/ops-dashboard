// FILE: src/components/tabs/HRTab.jsx
// WHAT THIS IS:
//   The HR section of the dashboard.
//   Sub-tabs: Attendance Log, Employee List, Remarks, Labour Law, Current Updates

import { useCallback, useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import hrAPI from '../../api/hr'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { isStructuredPayrollEnabled } from '../../config/tenantBranding'
import EmployeeProfileDrawer from './hr/EmployeeProfileDrawer'
import AttendanceLogPanel from './hr/AttendanceLogPanel'
import RemarksPanel from './hr/RemarksPanel'

function getHRSubTabs(t) {
  return [
    { id: 'attendance_log', label: t('attendanceLog') },
    { id: 'employee_list', label: t('employeeList') },
    { id: 'remarks', label: t('hrRemarks') },
    { id: 'labour_law', label: t('labourLaw') },
    { id: 'current_updates', label: t('currentUpdates') },
  ]
}

const EMPTY_EMPLOYEE = {
  name: '',
  idNumber: '',
  employeeCode: '',
  joiningDate: '',
  salaryAgreed: '',
  lastIncrement: '',
  rebate: '',
}

function toDateInput(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateDisplay(value) {
  const key = toDateInput(value)
  return key || '—'
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function employeeToForm(emp) {
  if (!emp) return { ...EMPTY_EMPLOYEE }
  return {
    name: emp.name || '',
    idNumber: emp.idNumber || '',
    employeeCode: emp.employeeCode || '',
    joiningDate: toDateInput(emp.joiningDate),
    salaryAgreed: emp.salaryAgreed === null || emp.salaryAgreed === undefined ? '' : String(emp.salaryAgreed),
    lastIncrement: toDateInput(emp.lastIncrement),
    rebate: emp.rebate === null || emp.rebate === undefined ? '' : String(emp.rebate),
  }
}

function buildEmployeePayload(form) {
  return {
    name: form.name.trim(),
    idNumber: form.idNumber.trim(),
    employeeCode: form.employeeCode.trim(),
    joiningDate: form.joiningDate || null,
    salaryAgreed: form.salaryAgreed === '' ? null : Number(form.salaryAgreed),
    lastIncrement: form.lastIncrement || null,
    rebate: form.rebate === '' ? null : Number(form.rebate),
  }
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
      {children}
      {required ? <span className="ml-0.5 text-emerald-600">*</span> : null}
    </label>
  )
}

// ── Add / Edit Employee — right-side drawer ──────
function EmployeeForm({ onSave, onCancel, token, initialEmployee = null }) {
  const { t } = useLanguage()
  const isEdit = Boolean(initialEmployee?._id)
  const [form, setForm] = useState(() => employeeToForm(initialEmployee))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError(t('hrErrName'))
    if (!form.idNumber.trim()) return setError(t('hrErrId'))
    if (!form.employeeCode.trim()) return setError(t('hrErrCode'))
    setLoading(true)
    setError('')
    try {
      const payload = buildEmployeePayload(form)
      if (isEdit) {
        await hrAPI.updateEmployee(token, initialEmployee._id, payload)
      } else {
        await hrAPI.createEmployee(token, payload)
      }
      onSave()
    } catch (err) {
      setError(err.response?.data?.message || t('hrErrSave'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[950] flex justify-end">
      <button
        type="button"
        aria-label="Close employee drawer"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        onClick={onCancel}
      />
      <aside className="relative flex h-full w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
          <div>
            <h3 className="text-sm font-semibold leading-tight text-slate-950">
              {isEdit ? 'Edit employee' : t('addNewEmployee')}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t('fillEmployeeDetails')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-base font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Name</FieldLabel>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. John Smith"
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel required>ID number</FieldLabel>
                <input
                  type="text"
                  value={form.idNumber}
                  onChange={set('idNumber')}
                  placeholder="e.g. 8501015009087"
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel required>{t('employeeCode')}</FieldLabel>
                <input
                  type="text"
                  value={form.employeeCode}
                  onChange={set('employeeCode')}
                  placeholder="e.g. EMP-001"
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel>Joining date</FieldLabel>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={set('joiningDate')}
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel>Last increment</FieldLabel>
                <input
                  type="date"
                  value={form.lastIncrement}
                  onChange={set('lastIncrement')}
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel>Salary agreed</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salaryAgreed}
                  onChange={set('salaryAgreed')}
                  placeholder="e.g. 25000"
                  className="input-field py-2 text-sm"
                />
              </div>

              <div>
                <FieldLabel>Rebate</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rebate}
                  onChange={set('rebate')}
                  placeholder="e.g. 500"
                  className="input-field py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
            >
              {loading ? t('saving') : isEdit ? 'Save changes' : t('saveEmployee')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

// ── Employee List sub-tab ────────────────────────
function EmployeeList({ token, company }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState(null)
  const [error, setError] = useState('')
  const [profileId, setProfileId] = useState(null)
  const structured = isStructuredPayrollEnabled(company)

  const load = useCallback(async (isMounted = () => true) => {
    setLoading(true)
    setError('')
    try {
      const data = await hrAPI.getEmployees(token)
      if (isMounted()) setEmployees(data.employees || [])
    } catch {
      if (isMounted()) setError('Failed to load employees.')
    } finally {
      if (isMounted()) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let mounted = true
    load(() => mounted)
    return () => { mounted = false }
  }, [load])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return
    try {
      await hrAPI.deleteEmployee(token, id)
      setEmployees((prev) => prev.filter((e) => e._id !== id))
    } catch {
      setError('Failed to delete employee.')
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold leading-tight text-white">Employee List</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        {!formMode && (
          <button
            type="button"
            onClick={() => setFormMode('create')}
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
          >
            + Add Employee
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      {formMode && (
        <EmployeeForm
          token={token}
          initialEmployee={formMode === 'create' ? null : formMode}
          onSave={() => { setFormMode(null); load() }}
          onCancel={() => setFormMode(null)}
        />
      )}

      {profileId && (
        <EmployeeProfileDrawer
          token={token}
          company={company}
          employeeId={profileId}
          onClose={() => setProfileId(null)}
          onSaved={() => load()}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full"
            style={{ border: '4px solid var(--brand-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-800 py-16 text-center">
          <p className="mb-3 text-4xl">👤</p>
          <p className="font-medium text-gray-400">No employees yet</p>
          <p className="mt-1 text-sm text-gray-600">Click &quot;Add Employee&quot; to add the first record</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">ID number</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Joining date</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Salary agreed</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Last increment</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Rebate</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {employees.map((emp) => (
                <tr key={emp._id} className="transition-colors hover:bg-gray-800/30">
                  <td className="px-4 py-3 whitespace-nowrap font-medium leading-tight text-white">
                    {structured ? (
                      <button
                        type="button"
                        onClick={() => setProfileId(emp._id)}
                        className="text-left hover:underline"
                      >
                        {emp.name}
                      </button>
                    ) : (
                      emp.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-400">{emp.idNumber}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-400">
                    {formatDateDisplay(emp.joiningDate)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-300">
                    {formatMoney(emp.salaryAgreed)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-400">
                    {formatDateDisplay(emp.lastIncrement)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-300">
                    {formatMoney(emp.rebate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setFormMode(emp)}
                      className="mr-3 text-xs font-medium text-sky-400 hover:text-sky-300"
                    >
                      Edit
                    </button>
                    {structured && (
                      <button
                        type="button"
                        onClick={() => setProfileId(emp._id)}
                        className="mr-3 text-xs font-medium text-sky-400 hover:text-sky-300"
                      >
                        Profile
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(emp._id, emp.name)}
                      className="text-xs font-medium text-red-400 transition-colors hover:text-red-300"
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

function LabourLaw() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-800 py-20 text-center">
      <p className="mb-3 text-4xl">⚖️</p>
      <p className="font-medium leading-tight text-gray-400">Labour Law</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        Labour law guidelines and compliance documents will appear here
      </p>
    </div>
  )
}

function CurrentUpdates() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-800 py-20 text-center">
      <p className="mb-3 text-4xl">📋</p>
      <p className="font-medium leading-tight text-gray-400">Current Updates</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        HR announcements and updates will appear here
      </p>
    </div>
  )
}

export default function HRTab({ embedded = false } = {}) {
  const { token, company } = useAuth()
  const { t } = useLanguage()
  const HR_SUB_TABS = getHRSubTabs(t)
  const allowedSubIds = useMemo(() => HR_SUB_TABS.map((tab) => tab.id), [HR_SUB_TABS])
  const { subTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'hr',
    allowedSubIds,
    'employee_list',
    company,
    { embedded },
  )

  const renderSubTab = () => {
    switch (subTab) {
      case 'attendance_log': return <AttendanceLogPanel token={token} />
      case 'employee_list': return <EmployeeList token={token} company={company} />
      case 'remarks': return <RemarksPanel token={token} />
      case 'labour_law': return <LabourLaw />
      case 'current_updates': return <CurrentUpdates />
      default: return null
    }
  }

  return (
    <ModuleTabColumn>
      <div className="flex flex-wrap gap-2">
        {HR_SUB_TABS.map((tab) => (
          <ErpSubTabButton
            key={tab.id}
            active={subTab === tab.id}
            href={buildSubHref(tab.id)}
            onClick={(event) => handleSubTabClick(tab.id, event)}
          >
            {tab.label}
          </ErpSubTabButton>
        ))}
      </div>

      {renderSubTab()}
    </ModuleTabColumn>
  )
}
