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
    <label className="mb-2 block text-xs font-semibold text-slate-700">
      {children}
      {required ? <span className="ml-0.5 text-orange-600">*</span> : null}
    </label>
  )
}

function PencilIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
    </svg>
  )
}

function TrashIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4.5H2.75a.75.75 0 0 0 0 1.5h.55l.77 10.01A2.75 2.75 0 0 0 6.76 18.5h6.48a2.75 2.75 0 0 0 2.69-2.49l.77-10.01h.55a.75.75 0 0 0 0-1.5H14v-.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4.5h-5v-.75ZM8.3 7.25a.75.75 0 0 1 .75.69l.4 7a.75.75 0 1 1-1.5.08l-.4-7a.75.75 0 0 1 .75-.77Zm3.4 0a.75.75 0 0 1 .75.77l-.4 7a.75.75 0 1 1-1.5-.08l.4-7a.75.75 0 0 1 .75-.69Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const DRAWER_INPUT =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm leading-normal text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20'

const PRIMARY_BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold leading-none tracking-normal text-white shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'

const ACTION_BTN =
  'inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold leading-none tracking-normal transition-colors'

// ── Add / Edit Employee — right-side drawer ──────
function EmployeeForm({ onSave, onCancel, token, initialEmployee = null }) {
  const { t } = useLanguage()
  const isEdit = Boolean(initialEmployee?._id)
  const [form, setForm] = useState(() => employeeToForm(initialEmployee))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

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
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCancel}
      />
      <aside
        className={`relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white transition-transform duration-300 ease-out ${entered ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ boxShadow: 'inset 3px 0 0 0 var(--brand-primary, #ea580c), -16px 0 48px rgba(15,23,42,0.18)' }}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold leading-snug text-slate-950">
                {isEdit ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Fill in the employee details below.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Identity</p>
                <div className="space-y-4">
                  <div>
                    <FieldLabel required>Employee Name</FieldLabel>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="e.g. John Smith"
                      className={DRAWER_INPUT}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>ID Number</FieldLabel>
                      <input
                        type="text"
                        value={form.idNumber}
                        onChange={set('idNumber')}
                        placeholder="e.g. 8501015009087"
                        className={DRAWER_INPUT}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Employee Code</FieldLabel>
                      <input
                        type="text"
                        value={form.employeeCode}
                        onChange={set('employeeCode')}
                        placeholder="e.g. EMP-001"
                        className={DRAWER_INPUT}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Employment Dates</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Joining Date</FieldLabel>
                    <input
                      type="date"
                      value={form.joiningDate}
                      onChange={set('joiningDate')}
                      className={DRAWER_INPUT}
                    />
                  </div>
                  <div>
                    <FieldLabel>Last Increment</FieldLabel>
                    <input
                      type="date"
                      value={form.lastIncrement}
                      onChange={set('lastIncrement')}
                      className={DRAWER_INPUT}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Compensation</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Salary Agreed</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.salaryAgreed}
                      onChange={set('salaryAgreed')}
                      placeholder="e.g. 25000"
                      className={DRAWER_INPUT}
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
                      className={DRAWER_INPUT}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-5">
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold leading-none tracking-normal text-slate-700 transition-colors hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={PRIMARY_BTN}
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                {loading ? t('saving') : isEdit ? 'Save Changes' : 'Save Employee'}
              </button>
            </div>
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-tight text-slate-900">Employee List</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        {!formMode && (
          <button
            type="button"
            onClick={() => setFormMode('create')}
            className={`${PRIMARY_BTN} hover:-translate-y-px hover:shadow-md`}
            style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
          >
            <span aria-hidden="true">+</span>
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <p className="mb-3 text-4xl">👤</p>
          <p className="font-medium text-slate-700">No employees yet</p>
          <p className="mt-1 text-sm text-slate-500">Click &quot;Add Employee&quot; to add the first record</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Name</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">ID Number</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Joining Date</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Salary Agreed</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Last Increment</th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Rebate</th>
                  <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp, index) => (
                  <tr
                    key={emp._id}
                    className={`transition-colors hover:bg-orange-50/50 ${index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                  >
                    <td className="px-5 py-4 align-middle whitespace-nowrap font-semibold text-slate-900">
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
                    <td className="px-5 py-4 align-middle whitespace-nowrap text-slate-600">{emp.idNumber}</td>
                    <td className="px-5 py-4 align-middle whitespace-nowrap text-slate-600">
                      {formatDateDisplay(emp.joiningDate)}
                    </td>
                    <td className="px-5 py-4 align-middle whitespace-nowrap font-medium text-slate-800">
                      {formatMoney(emp.salaryAgreed)}
                    </td>
                    <td className="px-5 py-4 align-middle whitespace-nowrap text-slate-600">
                      {formatDateDisplay(emp.lastIncrement)}
                    </td>
                    <td className="px-5 py-4 align-middle whitespace-nowrap text-slate-600">
                      {formatMoney(emp.rebate)}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormMode(emp)}
                          className={`${ACTION_BTN} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
                        >
                          <PencilIcon />
                          <span>Edit</span>
                        </button>
                        {structured && (
                          <button
                            type="button"
                            onClick={() => setProfileId(emp._id)}
                            className={`${ACTION_BTN} border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
                          >
                            Profile
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(emp._id, emp.name)}
                          className={`${ACTION_BTN} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                        >
                          <TrashIcon />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function LabourLaw() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      <p className="mb-3 text-4xl">⚖️</p>
      <p className="font-medium leading-tight text-slate-700">Labour Law</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        Labour law guidelines and compliance documents will appear here
      </p>
    </div>
  )
}

function CurrentUpdates() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      <p className="mb-3 text-4xl">📋</p>
      <p className="font-medium leading-tight text-slate-700">Current Updates</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
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
