// FILE: src/components/tabs/HRTab.jsx
// WHAT THIS IS:
//   The HR section of the dashboard.
//   Sub-tabs: Attendance Log, Employee List, Remarks, Labour Law, Current Updates

import { useCallback, useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import hrAPI from '../../api/hr'
import attendanceAPI from '../../api/attendance'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { isStructuredPayrollEnabled } from '../../config/tenantBranding'
import EmployeeProfileDrawer from './hr/EmployeeProfileDrawer'
import AttendanceLogPanel from './hr/AttendanceLogPanel'
import RemarksPanel from './hr/RemarksPanel'
import { downloadPayrollPdf } from './hr/payrollPdfExport'

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

/** Match payroll: monthlySalary / calendarDays × workedDays, rounded to 2dp. */
function prorateAccumulatedSalary(salaryAgreed, calendarDays, workedDays) {
  const monthly = Number(salaryAgreed)
  const cal = Number(calendarDays)
  const days = Number(workedDays)
  if (!Number.isFinite(monthly) || monthly < 0) return null
  if (!Number.isFinite(cal) || cal <= 0) return null
  if (!Number.isFinite(days) || days < 0) return 0
  if (days >= cal) return Math.round(monthly * 100) / 100
  return Math.round((monthly / cal) * days * 100) / 100
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100
}

/** Personal/social tax at 12% of MTD accumulated; net = accumulated − personal tax only. */
function computeTaxBreakdown(accumulated) {
  if (accumulated === null || accumulated === undefined) {
    return { personalTax: null, socialTax: null, netPayable: null }
  }
  const base = Number(accumulated)
  if (!Number.isFinite(base) || base < 0) {
    return { personalTax: null, socialTax: null, netPayable: null }
  }
  const personalTax = round2(base * 0.12)
  const socialTax = round2(base * 0.12)
  const netPayable = round2(base - personalTax)
  return { personalTax, socialTax, netPayable }
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
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

const DRAWER_INPUT =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm leading-normal text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20'

const FOOTER_CANCEL_BTN =
  'inline-flex min-h-11 min-w-[96px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold leading-none tracking-normal text-slate-700 transition-colors hover:bg-slate-50'

const FOOTER_SAVE_BTN =
  'inline-flex min-h-11 min-w-[128px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold leading-none tracking-normal text-white shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'

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
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-snug text-slate-950">
                {isEdit ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Fill in the employee details below.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-slate-50/70" style={{ padding: 20 }}>
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

              <section className="rounded-xl border border-slate-200 bg-slate-50/70" style={{ padding: 20 }}>
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

              <section className="rounded-xl border border-slate-200 bg-slate-50/70" style={{ padding: 20 }}>
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

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-nowrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className={FOOTER_CANCEL_BTN}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={FOOTER_SAVE_BTN}
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

const MONTH_FILTER_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function sumPayrollTotals(rows) {
  let gross = 0
  let rebate = 0
  let personalTax = 0
  let socialTax = 0
  let netPayable = 0
  for (const row of rows) {
    const rebateN = Number(row.rebate)
    if (Number.isFinite(rebateN)) rebate += rebateN
    if (row.accumulated === null || row.accumulated === undefined) continue
    gross += Number(row.accumulated) || 0
    personalTax += Number(row.personalTax) || 0
    socialTax += Number(row.socialTax) || 0
    netPayable += Number(row.netPayable) || 0
  }
  const grossR = round2(gross)
  const rebateR = round2(rebate)
  const personalTaxR = round2(personalTax)
  const socialTaxR = round2(socialTax)
  const netPayableR = round2(netPayable)
  return {
    employeeCount: rows.length,
    gross: grossR,
    personalTax: personalTaxR,
    socialTax: socialTaxR,
    netPayable: netPayableR,
    rebate: rebateR,
    netExpense: round2(netPayableR - rebateR),
  }
}

function applyMonthStats(monthData, year, month) {
  const statsById = {}
  const statsByName = {}
  for (const row of monthData?.stats || []) {
    if (row.employeeId) statsById[String(row.employeeId)] = row.workedDays || 0
    if (row.employeeName) statsByName[normalizeName(row.employeeName)] = row.workedDays || 0
  }
  return {
    calendarDays: Number(monthData?.calendarDays) || new Date(year, month, 0).getDate(),
    statsById,
    statsByName,
  }
}

const FILTER_SELECT =
  'h-9 min-w-[110px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20'

const FILTER_INPUT =
  'h-9 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20'

function payrollMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function isRebateCollectedForMonth(emp, year, month) {
  const key = payrollMonthKey(year, month)
  const list = Array.isArray(emp?.rebateCollectedMonths) ? emp.rebateCollectedMonths : []
  return list.map(String).includes(key)
}

function hasRebateAmount(emp) {
  const n = Number(emp?.rebate)
  return Number.isFinite(n) && n > 0
}

// ── Employee List sub-tab ────────────────────────
function EmployeeList({ token, company }) {
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const [employees, setEmployees] = useState([])
  const [monthMeta, setMonthMeta] = useState({ calendarDays: 31, statsById: {}, statsByName: {} })
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [monthLoading, setMonthLoading] = useState(false)
  const [formMode, setFormMode] = useState(null)
  const [error, setError] = useState('')
  const [profileId, setProfileId] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [nameMenu, setNameMenu] = useState(null)
  const [rebateBusyId, setRebateBusyId] = useState(null)
  const structured = isStructuredPayrollEnabled(company)

  const yearOptions = useMemo(() => {
    const years = []
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y)
    return years
  }, [currentYear])

  const loadMonthStats = useCallback(async (year, month, isMounted = () => true) => {
    setMonthLoading(true)
    let monthError = ''
    try {
      const monthData = await attendanceAPI.getMonthStats(token, year, month).catch((err) => {
        monthError = err.response?.data?.message || 'Failed to load working days / accumulated salary.'
        return null
      })
      if (!isMounted()) return
      setMonthMeta(applyMonthStats(monthData, year, month))
      if (monthError) setError(monthError)
    } finally {
      if (isMounted()) setMonthLoading(false)
    }
  }, [token])

  const loadEmployees = useCallback(async (isMounted = () => true) => {
    setLoading(true)
    setError('')
    try {
      const data = await hrAPI.getEmployees(token)
      if (!isMounted()) return
      setEmployees(data.employees || [])
    } catch {
      if (isMounted()) setError('Failed to load employees.')
    } finally {
      if (isMounted()) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let mounted = true
    loadEmployees(() => mounted)
    return () => { mounted = false }
  }, [loadEmployees])

  useEffect(() => {
    let mounted = true
    loadMonthStats(filterYear, filterMonth, () => mounted)
    return () => { mounted = false }
  }, [filterYear, filterMonth, loadMonthStats])

  useEffect(() => {
    if (!nameMenu) return undefined
    const close = () => setNameMenu(null)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [nameMenu])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return
    try {
      await hrAPI.deleteEmployee(token, id)
      setEmployees((prev) => prev.filter((e) => e._id !== id))
      setNameMenu(null)
    } catch {
      setError('Failed to delete employee.')
    }
  }

  const handleToggleRebateCollected = async (emp, collected) => {
    if (!hasRebateAmount(emp) || rebateBusyId) return
    const id = emp._id
    const key = payrollMonthKey(filterYear, filterMonth)
    const prevMonths = Array.isArray(emp.rebateCollectedMonths) ? emp.rebateCollectedMonths.map(String) : []
    const nextMonths = collected
      ? (prevMonths.includes(key) ? prevMonths : [...prevMonths, key])
      : prevMonths.filter((k) => k !== key)

    setRebateBusyId(id)
    setError('')
    setEmployees((list) => list.map((e) => (
      e._id === id ? { ...e, rebateCollectedMonths: nextMonths } : e
    )))
    try {
      const res = await hrAPI.setRebateCollected(token, id, {
        year: filterYear,
        month: filterMonth,
        collected,
      })
      if (res?.employee) {
        setEmployees((list) => list.map((e) => (e._id === id ? { ...e, ...res.employee } : e)))
      }
    } catch {
      setEmployees((list) => list.map((e) => (
        e._id === id ? { ...e, rebateCollectedMonths: prevMonths } : e
      )))
      setError('Failed to update rebate collected status.')
    } finally {
      setRebateBusyId(null)
    }
  }

  const payrollRows = useMemo(() => employees.map((emp) => {
    const byId = monthMeta.statsById[String(emp._id)]
    const byName = monthMeta.statsByName[normalizeName(emp.name)]
    const workedDays = byId !== undefined ? byId : (byName !== undefined ? byName : 0)
    const accumulated = prorateAccumulatedSalary(
      emp.salaryAgreed,
      monthMeta.calendarDays,
      workedDays,
    )
    const tax = computeTaxBreakdown(accumulated)
    return {
      id: emp._id,
      emp,
      name: emp.name || '',
      idNumber: emp.idNumber || '',
      employeeCode: emp.employeeCode || '',
      phoneNumber: emp.phoneNumber || '',
      workedDays,
      salaryAgreed: emp.salaryAgreed,
      rebate: emp.rebate,
      rebateCollected: isRebateCollectedForMonth(emp, filterYear, filterMonth),
      accumulated,
      personalTax: tax.personalTax,
      socialTax: tax.socialTax,
      netPayable: tax.netPayable,
    }
  }), [employees, monthMeta, filterYear, filterMonth])

  const filteredPayrollRows = useMemo(() => {
    const monthEnd = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(new Date(filterYear, filterMonth, 0).getDate()).padStart(2, '0')}`
    const q = searchQuery.trim().toLowerCase()
    return payrollRows.filter((row) => {
      const joinKey = toDateInput(row.emp?.joiningDate)
      if (joinKey && joinKey > monthEnd) return false
      if (!q) return true
      const name = String(row.name || '').toLowerCase()
      const idNumber = String(row.idNumber || '').toLowerCase()
      const code = String(row.employeeCode || '').toLowerCase()
      return name.includes(q) || idNumber.includes(q) || code.includes(q)
    })
  }, [payrollRows, searchQuery, filterYear, filterMonth])

  const payrollTotals = useMemo(
    () => sumPayrollTotals(filteredPayrollRows),
    [filteredPayrollRows],
  )

  const summaryCards = [
    { label: 'Employees', value: payrollTotals.employeeCount, money: false },
    { label: 'Gross total salary', value: payrollTotals.gross, money: true },
    { label: 'Total personal tax', value: payrollTotals.personalTax, money: true },
    { label: 'Total social tax', value: payrollTotals.socialTax, money: true },
    { label: 'Net payable', value: payrollTotals.netPayable, money: true },
    { label: 'Rebate', value: payrollTotals.rebate, money: true },
    { label: 'Net expense', value: payrollTotals.netExpense, money: true },
  ]

  const handleDownloadPdf = async () => {
    if (!filteredPayrollRows.length || pdfBusy) return
    setPdfBusy(true)
    setError('')
    try {
      await downloadPayrollPdf({
        rows: filteredPayrollRows,
        totals: payrollTotals,
        year: filterYear,
        month: filterMonth,
        companyName: company || '',
      })
    } catch {
      setError('Failed to generate payroll PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  const handleRefresh = () => {
    let mounted = true
    loadEmployees(() => mounted)
    loadMonthStats(filterYear, filterMonth, () => mounted)
  }

  return (
    <div className="pt-2">
      <div className="mb-4 space-y-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight tracking-tight text-slate-900">
              Employee List
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {employees.length} on record
              {filteredPayrollRows.length !== employees.length ? ` · ${filteredPayrollRows.length} shown` : ''}
              <span className="text-slate-400"> · click name to edit · right-click for more</span>
            </p>
          </div>
          {!formMode && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || monthLoading}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={loading || filteredPayrollRows.length === 0 || pdfBusy}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {pdfBusy ? 'Preparing…' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={() => setFormMode('create')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                <span aria-hidden="true">+</span>
                <span>Add</span>
              </button>
            </div>
          )}
        </div>

        {!formMode && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, or code"
              className={FILTER_INPUT}
              aria-label="Search employees"
            />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              Year
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className={FILTER_SELECT}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              Month
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className={`${FILTER_SELECT} min-w-[130px]`}
              >
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            {monthLoading && (
              <span className="text-xs text-slate-500">Updating…</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>
      )}

      {formMode && (
        <EmployeeForm
          token={token}
          initialEmployee={formMode === 'create' ? null : formMode}
          onSave={() => { setFormMode(null); handleRefresh() }}
          onCancel={() => setFormMode(null)}
        />
      )}

      {profileId && (
        <EmployeeProfileDrawer
          token={token}
          company={company}
          employeeId={profileId}
          onClose={() => setProfileId(null)}
          onSaved={() => handleRefresh()}
        />
      )}

      {!loading && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {card.money ? formatMoney(card.value) : card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full"
            style={{ border: '4px solid var(--brand-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="mb-3 text-4xl">👤</p>
          <p className="font-medium text-slate-700">No employees yet</p>
          <p className="mt-1 text-sm text-slate-500">Click &quot;Add Employee&quot; to add the first record</p>
        </div>
      ) : filteredPayrollRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="font-medium text-slate-700">No employees match your search</p>
          <p className="mt-1 text-sm text-slate-500">Try a different name, ID, or employee code</p>
        </div>
      ) : (
        <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-[13px] leading-snug">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">ID Number</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Joining Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Salary Agreed</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Last Increment</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Rebate</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Working Days</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Accumulated</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Personal Tax</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Social Tax</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Net Payable</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Rebate collected</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrollRows.map((row, index) => {
                  const emp = row.emp
                  const rebateEnabled = hasRebateAmount(emp)
                  const collected = row.rebateCollected
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 transition-colors last:border-b-0 hover:bg-orange-50/50 ${index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}
                  >
                    <td className="max-w-0 truncate px-3 py-2.5 align-middle text-sm font-semibold text-slate-900" title={`${emp.name} — click to edit, right-click for menu`}>
                      <button
                        type="button"
                        onClick={() => setFormMode(emp)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setNameMenu({ x: e.clientX, y: e.clientY, emp })
                        }}
                        className="max-w-full truncate text-left text-[color:var(--brand-primary,#ea580c)] hover:underline"
                      >
                        {emp.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-600">{emp.idNumber || '—'}</td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-600">
                      {emp.phoneNumber || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-600">
                      {formatDateDisplay(emp.joiningDate)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm font-medium text-slate-800">
                      {formatMoney(emp.salaryAgreed)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-600">
                      {formatDateDisplay(emp.lastIncrement)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-600">
                      {formatMoney(emp.rebate)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm font-medium text-slate-800">
                      {row.workedDays}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm font-semibold text-slate-900">
                      {formatMoney(row.accumulated)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-700">
                      {formatMoney(row.personalTax)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-slate-700">
                      {formatMoney(row.socialTax)}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm font-semibold text-slate-900">
                      {formatMoney(row.netPayable)}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={collected}
                        disabled={!rebateEnabled || rebateBusyId === emp._id}
                        onChange={(e) => handleToggleRebateCollected(emp, e.target.checked)}
                        title={rebateEnabled ? 'Mark rebate collected for this month' : 'No rebate amount on this employee'}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[color:var(--brand-primary,#ea580c)] focus:ring-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Rebate collected for ${emp.name}`}
                      />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nameMenu && (
        <div
          role="menu"
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: nameMenu.x, top: nameMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setFormMode(nameMenu.emp)
              setNameMenu(null)
            }}
          >
            Edit details
          </button>
          {structured && (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                setProfileId(nameMenu.emp._id)
                setNameMenu(null)
              }}
            >
              Open profile
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => handleDelete(nameMenu.emp._id, nameMenu.emp.name)}
          >
            Delete
          </button>
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
