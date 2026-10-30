// FILE: src/components/tabs/HRTab.jsx
// WHAT THIS IS:
//   The HR section of the dashboard.
//   Sub-tabs: Attendance Log, Employee List, Labour Law, Current Updates

import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import hrAPI from '../../api/hr'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { isStructuredPayrollEnabled } from '../../config/tenantBranding'
import EmployeeProfileDrawer from './hr/EmployeeProfileDrawer'
import AttendanceLogPanel from './hr/AttendanceLogPanel'

function getHRSubTabs(t) {
  return [
    { id: 'attendance_log', label: t('attendanceLog') },
    { id: 'employee_list', label: t('employeeList') },
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
  remarks: '',
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
    remarks: emp.remarks || '',
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
    remarks: form.remarks.trim(),
  }
}

// ── Add / Edit Employee form ─────────────────────
function EmployeeForm({ onSave, onCancel, token, initialEmployee = null }) {
  const { t } = useLanguage()
  const isEdit = Boolean(initialEmployee?._id)
  const [form, setForm] = useState(() => employeeToForm(initialEmployee))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 26 })
  const dragRef = useRef(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

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
            <h3 className="text-base font-semibold leading-tight text-slate-950">
              {isEdit ? 'Edit employee' : t('addNewEmployee')}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('fillEmployeeDetails')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-lg font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Close employee form"
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
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  Name <span className="text-emerald-700">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. John Smith"
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  ID number <span className="text-emerald-700">*</span>
                </label>
                <input
                  type="text"
                  value={form.idNumber}
                  onChange={set('idNumber')}
                  placeholder="e.g. 8501015009087"
                  className="input-field"
                />
              </div>

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

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  Joining date
                </label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={set('joiningDate')}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  Salary agreed
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salaryAgreed}
                  onChange={set('salaryAgreed')}
                  placeholder="e.g. 25000"
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  Last increment
                </label>
                <input
                  type="date"
                  value={form.lastIncrement}
                  onChange={set('lastIncrement')}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                  Rebate
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rebate}
                  onChange={set('rebate')}
                  placeholder="e.g. 500"
                  className="input-field"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase leading-none tracking-wider text-slate-600">
                Remarks
              </label>
              <textarea
                value={form.remarks}
                onChange={set('remarks')}
                placeholder="Notes about this employee"
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
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                {loading ? t('saving') : isEdit ? 'Save changes' : t('saveEmployee')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Employee List sub-tab ────────────────────────
function EmployeeList({ token, company }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState(null) // null | 'create' | employee object
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
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">Remarks</th>
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
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs leading-tight text-gray-400">
                    {emp.remarks || '—'}
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
