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
import { downloadPayrollExcel } from './hr/payrollExcelExport'
import { findLocalEmployeeIdentityConflict } from '../../utils/employeeIdentity'

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
  phoneNumber: '',
  idNumber: '',
  employeeCode: '',
  joiningDate: '',
  salaryAgreed: '',
  lastIncrement: '',
  rebate: '',
}

/** Next EMP-NNN from employee count + highest existing EMP-N suffix. */
function nextEmployeeCode(employees = []) {
  let maxSuffix = 0
  for (const emp of employees) {
    const match = String(emp?.employeeCode || '').trim().match(/^(?:EMP-)?(\d+)$/i)
    if (match) maxSuffix = Math.max(maxSuffix, Number(match[1]))
  }
  const n = Math.max(employees.length, maxSuffix) + 1
  return `EMP-${String(n).padStart(3, '0')}`
}

function interpolate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key])
  ))
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

function looksLikeSameId(phone, id) {
  const p = String(phone || '').trim().toLowerCase()
  const i = String(id || '').trim().toLowerCase()
  return Boolean(p && i && p === i)
}

/** Hide passport/ID mistakenly stored in phoneNumber (legacy form). */
function displayPhone(emp) {
  const phone = String(emp?.phoneNumber || '').trim()
  if (!phone || looksLikeSameId(phone, emp?.idNumber)) return '—'
  return phone
}

function employeeToForm(emp, { nextCode = '' } = {}) {
  if (!emp) {
    return {
      ...EMPTY_EMPLOYEE,
      employeeCode: nextCode || '',
    }
  }
  const rawPhone = emp.phoneNumber || ''
  const idNumber = emp.idNumber || ''
  return {
    name: emp.name || '',
    phoneNumber: looksLikeSameId(rawPhone, idNumber) ? '' : rawPhone,
    idNumber,
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
    phoneNumber: form.phoneNumber.trim(),
    employeeCode: form.employeeCode.trim(),
    // HR list creates/edits HR-scoped employees so dept heads can see them after save.
    department: 'hr',
    joiningDate: form.joiningDate || null,
    salaryAgreed: form.salaryAgreed === '' ? null : Number(form.salaryAgreed),
    lastIncrement: form.lastIncrement || null,
    rebate: form.rebate === '' ? null : Number(form.rebate),
  }
}

/* ── Inline icons (no extra deps) ───────────────── */
function IconSearch({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconRefresh({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )
}

function IconDownload({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

function IconPlus({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconCalendar({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconPencil({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconTrash({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    </svg>
  )
}

function IconUser({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconUsers({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconCash({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconPercent({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M19 5L5 19M9 7a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function IconWallet({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
      <path d="M16 12h5v4h-5a2 2 0 010-4z" />
    </svg>
  )
}

function IconTag({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconTrend({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  )
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
      {children}
      {required ? <span className="ml-0.5 text-orange-600">*</span> : null}
    </label>
  )
}

const DRAWER_INPUT =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm leading-normal text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20'

const FOOTER_CANCEL_BTN =
  'inline-flex min-h-11 min-w-[96px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold leading-none tracking-normal text-slate-700 transition-colors hover:bg-slate-50'

const FOOTER_SAVE_BTN =
  'inline-flex min-h-11 min-w-[128px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold leading-none tracking-normal text-white shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'

const BTN_SECONDARY =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'

const BTN_PRIMARY =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'

const ACTION_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors'

// ── Add / Edit Employee — right-side drawer ──────
function EmployeeForm({
  onSave,
  onCancel,
  onOpenExisting,
  token,
  employees = [],
  initialEmployee = null,
  nextEmployeeCode = '',
}) {
  const { t } = useLanguage()
  const isEdit = Boolean(initialEmployee?._id)
  const [form, setForm] = useState(() => employeeToForm(initialEmployee, { nextCode: nextEmployeeCode }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicateEmployee, setDuplicateEmployee] = useState(null)
  const [entered, setEntered] = useState(false)

  const set = (field) => (e) => {
    setDuplicateEmployee(null)
    setForm((f) => ({ ...f, [field]: e.target.value }))
  }

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
    if (!form.phoneNumber.trim()) return setError(t('hrErrPhone'))
    if (!form.idNumber.trim()) return setError(t('hrErrId'))
    if (looksLikeSameId(form.phoneNumber, form.idNumber)) return setError(t('hrErrPhoneNotId'))
    if (!form.employeeCode.trim()) return setError(t('hrErrCode'))

    const localConflict = findLocalEmployeeIdentityConflict(employees, {
      idNumber: form.idNumber,
      phoneNumber: form.phoneNumber,
      excludeId: isEdit ? initialEmployee._id : null,
    })
    if (localConflict) {
      setDuplicateEmployee(localConflict.employee)
      setError(t('hrErrDuplicateEmployee'))
      return
    }

    setLoading(true)
    setError('')
    setDuplicateEmployee(null)
    try {
      const payload = buildEmployeePayload(form)
      if (isEdit) {
        await hrAPI.updateEmployee(token, initialEmployee._id, payload)
      } else {
        await hrAPI.createEmployee(token, payload)
      }
      onSave()
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'DUPLICATE_EMPLOYEE' || err.response?.status === 409) {
        setError(data?.message || t('hrErrDuplicateEmployee'))
        const existingId = data?.existingEmployeeId
        const existing = existingId
          ? employees.find((emp) => String(emp._id) === String(existingId)) || { _id: existingId }
          : null
        setDuplicateEmployee(existing || null)
      } else {
        setError(data?.message || t('hrErrSave'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[950] flex justify-end">
      <button
        type="button"
        aria-label={t('closeEmployeeDrawer')}
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCancel}
      />
      <aside
        className={`relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white transition-transform duration-300 ease-out ${entered ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ boxShadow: 'inset 3px 0 0 0 var(--brand-primary, #ea580c), -16px 0 40px rgba(15,23,42,0.14)' }}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-snug text-slate-950">
                {isEdit ? t('editEmployee') : t('addNewEmployee')}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {t('fillEmployeeDetails')}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-semibold leading-none text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label={t('close')}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                <p>{error}</p>
                {duplicateEmployee && typeof onOpenExisting === 'function' && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800"
                    onClick={() => onOpenExisting(duplicateEmployee)}
                  >
                    {t('hrOpenExistingEmployee')}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('identitySection')}</p>
                <div className="space-y-3.5">
                  <div>
                    <FieldLabel required>{t('employeeName')}</FieldLabel>
                    <input type="text" value={form.name} onChange={set('name')} placeholder={t('namePlaceholder')} className={DRAWER_INPUT} />
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>{t('phone')}</FieldLabel>
                      <input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder={t('phonePlaceholder')} className={DRAWER_INPUT} />
                    </div>
                    <div>
                      <FieldLabel required>{t('idNumber')}</FieldLabel>
                      <input type="text" value={form.idNumber} onChange={set('idNumber')} placeholder={t('idNumberPlaceholder')} className={DRAWER_INPUT} />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel required>{t('employeeCode')}</FieldLabel>
                      <input
                        type="text"
                        value={form.employeeCode}
                        readOnly
                        placeholder={t('employeeCodePlaceholder')}
                        className={`${DRAWER_INPUT} cursor-default bg-slate-50 text-slate-600`}
                        aria-readonly="true"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('employmentDatesSection')}</p>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <FieldLabel>{t('joiningDate')}</FieldLabel>
                    <input type="date" value={form.joiningDate} onChange={set('joiningDate')} className={DRAWER_INPUT} />
                  </div>
                  <div>
                    <FieldLabel>{t('lastIncrement')}</FieldLabel>
                    <input type="date" value={form.lastIncrement} onChange={set('lastIncrement')} className={DRAWER_INPUT} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('compensationSection')}</p>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <FieldLabel>{t('salaryAgreed')}</FieldLabel>
                    <input type="number" min="0" step="0.01" value={form.salaryAgreed} onChange={set('salaryAgreed')} placeholder={t('salaryPlaceholder')} className={DRAWER_INPUT} />
                  </div>
                  <div>
                    <FieldLabel>{t('rebate')}</FieldLabel>
                    <input type="number" min="0" step="0.01" value={form.rebate} onChange={set('rebate')} placeholder={t('rebatePlaceholder')} className={DRAWER_INPUT} />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-nowrap items-center justify-end gap-3">
              <button type="button" onClick={onCancel} className={FOOTER_CANCEL_BTN}>
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={FOOTER_SAVE_BTN}
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                {loading ? t('saving') : isEdit ? t('saveChanges') : t('saveEmployee')}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  )
}

function useMonthFilterOptions(langCode) {
  return useMemo(() => {
    const locale = langCode === 'ru' ? 'ru-RU' : langCode === 'uz' ? 'uz-UZ' : 'en-US'
    return Array.from({ length: 12 }, (_, i) => {
      const label = new Date(2020, i, 1).toLocaleString(locale, { month: 'long' })
      return { value: i + 1, label: label.charAt(0).toUpperCase() + label.slice(1) }
    })
  }, [langCode])
}

function sumPayrollTotals(rows) {
  let gross = 0
  let rebate = 0
  let rebateCollectedTotal = 0
  let personalTax = 0
  let socialTax = 0
  let netPayable = 0
  let pendingRebateCount = 0
  let employeesWithRebate = 0
  let employeesWithoutRebate = 0
  for (const row of rows) {
    const rebateN = Number(row.rebate)
    if (Number.isFinite(rebateN) && rebateN > 0) {
      employeesWithRebate += 1
      rebate += rebateN
      if (!row.rebateCollected) pendingRebateCount += 1
    } else {
      employeesWithoutRebate += 1
    }
    const collectedN = Number(row.rebateCollectedAmount)
    if (row.rebateCollected && Number.isFinite(collectedN)) rebateCollectedTotal += collectedN
    if (row.accumulated === null || row.accumulated === undefined) continue
    gross += Number(row.accumulated) || 0
    personalTax += Number(row.personalTax) || 0
    socialTax += Number(row.socialTax) || 0
    netPayable += Number(row.netPayable) || 0
  }
  const grossR = round2(gross)
  const rebateR = round2(rebate)
  const rebateCollectedR = round2(rebateCollectedTotal)
  const personalTaxR = round2(personalTax)
  const socialTaxR = round2(socialTax)
  const netPayableR = round2(netPayable)
  // Net Expenses = Gross + Social Tax − Total Rebates Collected
  return {
    employeeCount: rows.length,
    gross: grossR,
    personalTax: personalTaxR,
    socialTax: socialTaxR,
    netPayable: netPayableR,
    rebate: rebateR,
    rebateCollected: rebateCollectedR,
    pendingRebateCount,
    employeesWithRebate,
    employeesWithoutRebate,
    netExpense: round2(grossR + socialTaxR - rebateCollectedR),
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

function payrollMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function _isRebateCollectedForMonth(emp, year, month) {
  const key = payrollMonthKey(year, month)
  const collections = Array.isArray(emp?.rebateCollections) ? emp.rebateCollections : []
  if (collections.some((c) => String(c?.month) === key)) return true
  const list = Array.isArray(emp?.rebateCollectedMonths) ? emp.rebateCollectedMonths : []
  return list.map(String).includes(key)
}

function resolveRebateCollection(emp, year, month) {
  const key = payrollMonthKey(year, month)
  const collections = Array.isArray(emp?.rebateCollections) ? emp.rebateCollections : []
  const hit = collections.find((c) => String(c?.month) === key)
  if (hit) {
    const amount = Number(hit.amount)
    return {
      collected: true,
      amount: Number.isFinite(amount) ? amount : 0,
      collectedAt: hit.collectedAt ? toDateInput(hit.collectedAt) : '',
    }
  }
  const list = Array.isArray(emp?.rebateCollectedMonths) ? emp.rebateCollectedMonths : []
  if (list.map(String).includes(key)) {
    const agreed = Number(emp?.rebate)
    return {
      collected: true,
      amount: Number.isFinite(agreed) && agreed > 0 ? agreed : 0,
      collectedAt: '',
    }
  }
  return { collected: false, amount: null, collectedAt: '' }
}

function hasRebateAmount(emp) {
  const n = Number(emp?.rebate)
  return Number.isFinite(n) && n > 0
}

function todayInputKey() {
  return toDateInput(new Date())
}

const TH = 'sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600'
const TH_RIGHT = `${TH} text-right`
const TD = 'whitespace-nowrap align-middle text-sm text-slate-600'
const TD_RIGHT = `${TD} text-right tabular-nums`
const TD_MONEY = 'whitespace-nowrap align-middle text-right text-sm font-medium tabular-nums text-slate-800'
const CELL_PAD = { padding: '0.875rem' }

const KPI_ICONS = [
  IconUsers,
  IconUsers,
  IconUsers,
  IconCash,
  IconPercent,
  IconPercent,
  IconWallet,
  IconTag,
  IconTag,
  IconTrend,
]

function KpiCard({ label, value, money, icon: Icon }) {
  return (
    <div
      className="flex min-h-[72px] flex-col justify-between rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ padding: '0.75rem' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold uppercase leading-snug tracking-[0.06em] text-slate-500">{label}</p>
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--brand-primary, #F4510B) 12%, white)', color: 'var(--brand-primary, #F4510B)' }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="text-lg font-semibold tabular-nums leading-none tracking-tight text-slate-900" style={{ marginTop: '0.5rem' }}>
        {money ? formatMoney(value) : value}
      </p>
    </div>
  )
}

// ── Employee List sub-tab ────────────────────────
function EmployeeList({ token, company }) {
  const { t, langCode } = useLanguage()
  const monthOptions = useMonthFilterOptions(langCode)
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
  const [excelBusy, setExcelBusy] = useState(false)
  const [rebateBusyId, setRebateBusyId] = useState(null)
  const [rebateDrafts, setRebateDrafts] = useState({})
  const [rebateSort, setRebateSort] = useState(null) // null | 'asc' | 'desc'
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
        monthError = err.response?.data?.message || t('failedLoadMonthStats')
        return null
      })
      if (!isMounted()) return
      setMonthMeta(applyMonthStats(monthData, year, month))
      if (monthError) setError(monthError)
    } finally {
      if (isMounted()) setMonthLoading(false)
    }
  }, [token, t])

  const loadEmployees = useCallback(async (isMounted = () => true) => {
    setLoading(true)
    setError('')
    try {
      const data = await hrAPI.getEmployees(token)
      if (!isMounted()) return
      setEmployees(data.employees || [])
    } catch {
      if (isMounted()) setError(t('failedLoadEmployees'))
    } finally {
      if (isMounted()) setLoading(false)
    }
  }, [token, t])

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(interpolate(t('confirmDeleteNamed'), { name }))) return
    try {
      await hrAPI.deleteEmployee(token, id)
      setEmployees((prev) => prev.filter((e) => e._id !== id))
    } catch {
      setError(t('failedDeleteEmployee'))
    }
  }

  const getRebateDraft = (emp) => {
    const id = emp._id
    if (rebateDrafts[id]) return rebateDrafts[id]
    const resolved = resolveRebateCollection(emp, filterYear, filterMonth)
    if (resolved.collected) {
      return {
        amount: resolved.amount === null || resolved.amount === undefined ? '' : String(resolved.amount),
        collectedAt: resolved.collectedAt || todayInputKey(),
      }
    }
    const agreed = Number(emp.rebate)
    return {
      amount: Number.isFinite(agreed) && agreed > 0 ? String(agreed) : '',
      collectedAt: todayInputKey(),
    }
  }

  const setRebateDraftField = (emp, field, value) => {
    const id = emp._id
    const base = rebateDrafts[id] || getRebateDraft(emp)
    setRebateDrafts((prev) => ({
      ...prev,
      [id]: { ...base, [field]: value },
    }))
  }

  const persistRebateCollection = async (emp, { collected, amount, collectedAt }) => {
    if (!hasRebateAmount(emp) || rebateBusyId) return
    const id = emp._id
    const prevMonths = Array.isArray(emp.rebateCollectedMonths) ? emp.rebateCollectedMonths.map(String) : []
    const prevCollections = Array.isArray(emp.rebateCollections) ? emp.rebateCollections : []
    const key = payrollMonthKey(filterYear, filterMonth)
    const amountN = Number(amount)
    const payloadAmount = Number.isFinite(amountN) && amountN >= 0 ? amountN : Number(emp.rebate) || 0
    const payloadDate = collectedAt || todayInputKey()

    const optimisticCollections = collected
      ? [
        ...prevCollections.filter((c) => String(c?.month) !== key),
        { month: key, amount: payloadAmount, collectedAt: payloadDate },
      ]
      : prevCollections.filter((c) => String(c?.month) !== key)
    const optimisticMonths = collected
      ? (prevMonths.includes(key) ? prevMonths : [...prevMonths, key])
      : prevMonths.filter((k) => k !== key)

    setRebateBusyId(id)
    setError('')
    setEmployees((list) => list.map((e) => (
      e._id === id
        ? { ...e, rebateCollectedMonths: optimisticMonths, rebateCollections: optimisticCollections }
        : e
    )))
    try {
      const res = await hrAPI.setRebateCollected(token, id, {
        year: filterYear,
        month: filterMonth,
        collected,
        amount: collected ? payloadAmount : undefined,
        collectedAt: collected ? payloadDate : undefined,
      })
      if (res?.employee) {
        setEmployees((list) => list.map((e) => (e._id === id ? { ...e, ...res.employee } : e)))
      }
      if (!collected) {
        setRebateDrafts((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    } catch {
      setEmployees((list) => list.map((e) => (
        e._id === id
          ? { ...e, rebateCollectedMonths: prevMonths, rebateCollections: prevCollections }
          : e
      )))
      setError(t('failedUpdateRebateCollected'))
    } finally {
      setRebateBusyId(null)
    }
  }

  const handleToggleRebateCollected = async (emp, collected) => {
    const draft = getRebateDraft(emp)
    await persistRebateCollection(emp, {
      collected,
      amount: draft.amount,
      collectedAt: draft.collectedAt,
    })
  }

  const handleSaveRebateDetails = async (emp) => {
    const draft = getRebateDraft(emp)
    await persistRebateCollection(emp, {
      collected: true,
      amount: draft.amount,
      collectedAt: draft.collectedAt,
    })
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
    const collection = resolveRebateCollection(emp, filterYear, filterMonth)
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
      rebateCollected: collection.collected,
      rebateCollectedAmount: collection.collected ? collection.amount : null,
      rebateCollectedAt: collection.collectedAt,
      accumulated,
      personalTax: tax.personalTax,
      socialTax: tax.socialTax,
      netPayable: tax.netPayable,
    }
  }), [employees, monthMeta, filterYear, filterMonth])

  const filteredPayrollRows = useMemo(() => {
    const monthEnd = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(new Date(filterYear, filterMonth, 0).getDate()).padStart(2, '0')}`
    const q = searchQuery.trim().toLowerCase()
    let rows = payrollRows.filter((row) => {
      const joinKey = toDateInput(row.emp?.joiningDate)
      if (joinKey && joinKey > monthEnd) return false
      if (!q) return true
      const name = String(row.name || '').toLowerCase()
      const idNumber = String(row.idNumber || '').toLowerCase()
      const phone = String(row.phoneNumber || '').toLowerCase()
      const code = String(row.employeeCode || '').toLowerCase()
      return name.includes(q) || idNumber.includes(q) || phone.includes(q) || code.includes(q)
    })
    if (rebateSort === 'asc' || rebateSort === 'desc') {
      rows = [...rows].sort((a, b) => {
        const av = a.rebateCollected ? Number(a.rebateCollectedAmount) || 0 : -1
        const bv = b.rebateCollected ? Number(b.rebateCollectedAmount) || 0 : -1
        return rebateSort === 'asc' ? av - bv : bv - av
      })
    }
    return rows
  }, [payrollRows, searchQuery, filterYear, filterMonth, rebateSort])

  const payrollTotals = useMemo(
    () => sumPayrollTotals(filteredPayrollRows),
    [filteredPayrollRows],
  )

  const allWorkedDaysZero = useMemo(
    () => filteredPayrollRows.length > 0 && filteredPayrollRows.every((row) => Number(row.workedDays) === 0),
    [filteredPayrollRows],
  )

  const summaryCards = [
    { label: t('totalEmployees'), value: payrollTotals.employeeCount, money: false },
    { label: t('employeesWithRebate'), value: payrollTotals.employeesWithRebate, money: false },
    { label: t('employeesWithoutRebate'), value: payrollTotals.employeesWithoutRebate, money: false },
    { label: t('grossTotalSalary'), value: payrollTotals.gross, money: true },
    { label: t('totalPersonalTax'), value: payrollTotals.personalTax, money: true },
    { label: t('totalSocialTax'), value: payrollTotals.socialTax, money: true },
    { label: t('netPayable'), value: payrollTotals.netPayable, money: true },
    { label: t('rebate'), value: payrollTotals.rebate, money: true },
    { label: t('totalRebatesCollected'), value: payrollTotals.rebateCollected, money: true },
    { label: t('netExpense'), value: payrollTotals.netExpense, money: true },
  ]

  const cycleRebateSort = () => {
    setRebateSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null))
  }

  const exportLabels = useMemo(() => ({
    title: t('monthlyPayrollReport'),
    period: t('periodLabel'),
    employees: t('employees'),
    generated: t('generatedLabel'),
    company: t('company') !== 'company' ? t('company') : 'Company',
    name: t('name'),
    code: t('employeeCode'),
    phone: t('phone'),
    workedDays: t('workedDays'),
    salaryAgreed: t('salaryAgreed'),
    rebate: t('rebate'),
    rebatesCollectedAmount: t('rebatesCollectedAmount'),
    rebateStatus: t('rebateStatus'),
    collected: t('rebateStatusCollected'),
    pending: t('rebateStatusPending'),
    accumulatedMtd: t('accumulatedMtd'),
    personalTax: t('personalTax'),
    socialTax: t('socialTax'),
    netPayable: t('netPayable'),
    grandTotals: t('grandTotals'),
    totalEmployees: t('totalEmployees'),
    grossTotalSalary: t('grossTotalSalary'),
    totalPersonalTax: t('totalPersonalTax'),
    totalSocialTax: t('totalSocialTax'),
    totalRebatesCollected: t('totalRebatesCollected'),
    netExpense: t('netExpense'),
    employeesWithRebate: t('employeesWithRebate'),
    employeesWithoutRebate: t('employeesWithoutRebate'),
    pendingRebates: t('pendingRebatesLabel'),
    payrollSheet: t('payrollExcelSheet'),
    summarySheet: t('summaryExcelSheet'),
    yes: t('yes'),
    no: t('no'),
  }), [t])

  const handleDownloadPdf = async () => {
    if (!filteredPayrollRows.length || pdfBusy || excelBusy) return
    setPdfBusy(true)
    setError('')
    try {
      await downloadPayrollPdf({
        rows: filteredPayrollRows,
        totals: payrollTotals,
        year: filterYear,
        month: filterMonth,
        companyName: company || '',
        langCode,
        labels: exportLabels,
      })
    } catch {
      setError(t('failedGeneratePayrollPdf'))
    } finally {
      setPdfBusy(false)
    }
  }

  const handleDownloadExcel = async () => {
    if (!filteredPayrollRows.length || excelBusy || pdfBusy) return
    setExcelBusy(true)
    setError('')
    try {
      await downloadPayrollExcel({
        rows: filteredPayrollRows,
        totals: payrollTotals,
        year: filterYear,
        month: filterMonth,
        companyName: company || '',
        langCode,
        labels: exportLabels,
      })
    } catch {
      setError(t('failedGeneratePayrollExcel'))
    } finally {
      setExcelBusy(false)
    }
  }

  const handleRefresh = () => {
    let mounted = true
    loadEmployees(() => mounted)
    loadMonthStats(filterYear, filterMonth, () => mounted)
  }

  const countBadge = filteredPayrollRows.length !== employees.length
    ? `${employees.length} · ${interpolate(t('employeesShown'), { count: filteredPayrollRows.length })}`
    : interpolate(t('employeesOnRecord'), { count: employees.length })

  return (
    <div className="flex flex-col gap-5" style={{ paddingTop: '0.5rem' }}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
              {t('employeeList')}
            </h3>
            <span
              className="inline-flex items-center rounded-full border text-xs font-semibold tabular-nums"
              style={{
                borderColor: 'color-mix(in srgb, var(--brand-primary, #F4510B) 28%, white)',
                background: 'color-mix(in srgb, var(--brand-primary, #F4510B) 10%, white)',
                color: 'var(--brand-primary, #F4510B)',
                padding: '0.25rem 0.625rem',
              }}
            >
              {countBadge}
            </span>
          </div>
          <p className="text-sm text-slate-500" style={{ marginTop: '0.5rem' }}>
            {t('employeeListManageDesc')}
          </p>
        </div>
        {!formMode && (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:justify-end">
            <button type="button" onClick={handleRefresh} disabled={loading || monthLoading} className={BTN_SECONDARY} style={{ padding: '0 0.875rem' }}>
              <IconRefresh />
              {t('refresh')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || filteredPayrollRows.length === 0 || pdfBusy || excelBusy}
              className={BTN_SECONDARY}
              style={{ padding: '0 0.875rem' }}
            >
              <IconDownload />
              {pdfBusy ? t('preparingPdf') : t('downloadPdf')}
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={loading || filteredPayrollRows.length === 0 || excelBusy || pdfBusy}
              className={BTN_SECONDARY}
              style={{ padding: '0 0.875rem' }}
            >
              <IconDownload />
              {excelBusy ? t('preparingExcel') : t('downloadExcel')}
            </button>
            <button
              type="button"
              onClick={() => setFormMode('create')}
              className={BTN_PRIMARY}
              style={{ background: 'var(--brand-primary, #F4510B)', color: 'var(--brand-on-primary, #ffffff)', padding: '0 1rem' }}
            >
              <IconPlus />
              {t('addEmployee')}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {!formMode && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm" style={{ padding: '1rem' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative min-w-[240px] flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <IconSearch />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchNameIdCode')}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem' }}
                aria-label={t('searchEmployees')}
              />
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
              <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
              {t('year')}
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="h-10 min-w-[120px] rounded-full border bg-white text-sm font-medium text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                style={{
                  boxSizing: 'border-box',
                  height: '40px',
                  minHeight: '40px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  paddingLeft: '0.875rem',
                  paddingRight: '1.75rem',
                  lineHeight: '1.25',
                  fontSize: '13px',
                  borderColor: 'color-mix(in srgb, var(--brand-primary, #F4510B) 35%, white)',
                  borderRadius: '9999px',
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
              <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
              {t('month')}
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="h-10 min-w-[150px] rounded-full border bg-white text-sm font-medium text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                style={{
                  boxSizing: 'border-box',
                  height: '40px',
                  minHeight: '40px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  paddingLeft: '0.875rem',
                  paddingRight: '1.75rem',
                  lineHeight: '1.25',
                  fontSize: '13px',
                  borderColor: 'color-mix(in srgb, var(--brand-primary, #F4510B) 35%, white)',
                  borderRadius: '9999px',
                }}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            {monthLoading && (
              <span className="text-xs font-medium text-slate-500">{t('updating')}</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>
      )}

      {formMode && (
        <EmployeeForm
          token={token}
          employees={employees}
          initialEmployee={formMode === 'create' ? null : formMode}
          nextEmployeeCode={formMode === 'create' ? nextEmployeeCode(employees) : ''}
          onSave={() => { setFormMode(null); handleRefresh() }}
          onCancel={() => setFormMode(null)}
          onOpenExisting={async (emp) => {
            const fromList = employees.find((e) => String(e._id) === String(emp?._id))
            if (fromList) {
              setFormMode(fromList)
              return
            }
            try {
              const data = await hrAPI.getEmployee(token, emp._id)
              setFormMode(data?.employee || emp)
            } catch {
              setFormMode(emp)
            }
          }}
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

      {!loading && !monthLoading && allWorkedDaysZero && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
          style={{ padding: '0.875rem' }}
        >
          {t('payrollNeedsAttendanceHint')}
        </div>
      )}

      {!loading && payrollTotals.pendingRebateCount > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
          style={{ padding: '0.875rem' }}
        >
          {interpolate(t('rebatesPendingHint'), { count: payrollTotals.pendingRebateCount })}
        </div>
      )}

      {/* KPI cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-5">
          {summaryCards.map((card, i) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              money={card.money}
              icon={KPI_ICONS[i] || IconCash}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24 shadow-sm">
          <div
            className="h-7 w-7 animate-spin rounded-full"
            style={{ border: '3px solid var(--brand-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <p className="font-semibold text-slate-800">{t('noEmployeesYet')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('addFirstEmployeeHint')}</p>
          <button
            type="button"
            onClick={() => setFormMode('create')}
            className={`${BTN_PRIMARY} mt-5`}
            style={{ background: 'var(--brand-primary, #F4510B)', color: 'var(--brand-on-primary, #ffffff)' }}
          >
            <IconPlus />
            {t('addEmployee')}
          </button>
        </div>
      ) : filteredPayrollRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <p className="font-semibold text-slate-800">{t('noEmployeesMatchSearch')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('tryDifferentSearch')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] table-fixed border-collapse">
              <colgroup>
                <col style={{ width: 160 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={TH} style={CELL_PAD}>{t('name')}</th>
                  <th className={TH} style={CELL_PAD}>{t('idNumber')}</th>
                  <th className={TH} style={CELL_PAD}>{t('employeeCode')}</th>
                  <th className={TH} style={CELL_PAD}>{t('phone')}</th>
                  <th className={TH} style={CELL_PAD}>{t('joiningDate')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('salaryAgreed')}</th>
                  <th className={TH} style={CELL_PAD}>{t('lastIncrement')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('rebate')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>
                    <button
                      type="button"
                      onClick={cycleRebateSort}
                      className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.06em] text-slate-600 hover:text-slate-900"
                      title={t('sortByRebatesCollected')}
                    >
                      {t('rebatesCollectedAmount')}
                      <span className="text-[10px] tabular-nums">
                        {rebateSort === 'asc' ? '↑' : rebateSort === 'desc' ? '↓' : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('workingDays')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('accumulated')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('personalTax')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('socialTax')}</th>
                  <th className={TH_RIGHT} style={CELL_PAD}>{t('netPayable')}</th>
                  <th className={`${TH} text-center`} style={CELL_PAD}>{t('rebateStatus')}</th>
                  <th className={`${TH} text-center`} style={CELL_PAD}>{t('rebateCollected')}</th>
                  <th className={`${TH} text-center`} style={CELL_PAD}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrollRows.map((row) => {
                  const emp = row.emp
                  const rebateEnabled = hasRebateAmount(emp)
                  const collected = row.rebateCollected
                  const draft = getRebateDraft(emp)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 bg-white transition-colors last:border-b-0 hover:bg-orange-50/40"
                    >
                      <td className="truncate align-middle text-sm font-semibold text-slate-900" style={CELL_PAD} title={emp.name}>
                        {emp.name}
                      </td>
                      <td className={`${TD} truncate`} style={CELL_PAD} title={emp.idNumber || ''}>{emp.idNumber || '—'}</td>
                      <td className={`${TD} truncate`} style={CELL_PAD} title={emp.employeeCode || ''}>{emp.employeeCode || '—'}</td>
                      <td className={`${TD} truncate`} style={CELL_PAD} title={displayPhone(emp)}>{displayPhone(emp)}</td>
                      <td className={TD} style={CELL_PAD}>{formatDateDisplay(emp.joiningDate)}</td>
                      <td className={TD_MONEY} style={CELL_PAD}>{formatMoney(emp.salaryAgreed)}</td>
                      <td className={TD} style={CELL_PAD}>{formatDateDisplay(emp.lastIncrement)}</td>
                      <td className={TD_RIGHT} style={CELL_PAD}>{formatMoney(emp.rebate)}</td>
                      <td className={TD_MONEY} style={CELL_PAD}>
                        {collected ? formatMoney(row.rebateCollectedAmount) : '—'}
                      </td>
                      <td className={TD_RIGHT} style={CELL_PAD}>{row.workedDays}</td>
                      <td className={`${TD_MONEY} font-semibold text-slate-900`} style={CELL_PAD}>{formatMoney(row.accumulated)}</td>
                      <td className={TD_RIGHT} style={CELL_PAD}>{formatMoney(row.personalTax)}</td>
                      <td className={TD_RIGHT} style={CELL_PAD}>{formatMoney(row.socialTax)}</td>
                      <td className={`${TD_MONEY} font-semibold text-slate-900`} style={CELL_PAD}>{formatMoney(row.netPayable)}</td>
                      <td className="align-middle text-center" style={CELL_PAD}>
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: collected
                              ? 'color-mix(in srgb, #16A34A 14%, white)'
                              : 'color-mix(in srgb, #D97706 14%, white)',
                            color: collected ? '#15803D' : '#B45309',
                          }}
                        >
                          {collected ? t('rebateStatusCollected') : t('rebateStatusPending')}
                        </span>
                      </td>
                      <td className="align-middle" style={CELL_PAD}>
                        <div className="flex flex-col items-stretch gap-1.5">
                          <label className="flex items-center justify-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={collected}
                              disabled={!rebateEnabled || rebateBusyId === emp._id}
                              onChange={(e) => handleToggleRebateCollected(emp, e.target.checked)}
                              title={rebateEnabled ? t('markRebateCollected') : t('noRebateAmount')}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[color:var(--brand-primary,#F4510B)] focus:ring-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={interpolate(t('rebateCollectedFor'), { name: emp.name })}
                            />
                            {t('rebateCollected')}
                          </label>
                          {rebateEnabled && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft.amount}
                                disabled={rebateBusyId === emp._id}
                                onChange={(e) => setRebateDraftField(emp, 'amount', e.target.value)}
                                placeholder={t('rebateCollectedAmountPlaceholder')}
                                className="h-8 w-[88px] rounded-lg border border-slate-200 bg-white px-2 text-xs tabular-nums text-slate-800 outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20 disabled:opacity-50"
                                aria-label={interpolate(t('rebateAmountCollectedFor'), { name: emp.name })}
                              />
                              <input
                                type="date"
                                value={draft.collectedAt || ''}
                                disabled={rebateBusyId === emp._id}
                                onChange={(e) => setRebateDraftField(emp, 'collectedAt', e.target.value)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20 disabled:opacity-50"
                                aria-label={interpolate(t('rebateCollectedDateFor'), { name: emp.name })}
                              />
                              <button
                                type="button"
                                disabled={rebateBusyId === emp._id}
                                onClick={() => handleSaveRebateDetails(emp)}
                                className="h-8 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {t('save')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="align-middle" style={CELL_PAD}>
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setFormMode(emp)}
                            className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`}
                            aria-label={interpolate(t('editEmployeeAria'), { name: emp.name })}
                            title={t('edit')}
                          >
                            <IconPencil className="h-3.5 w-3.5" />
                          </button>
                          {structured && (
                            <button
                              type="button"
                              onClick={() => setProfileId(emp._id)}
                              className={`${ACTION_BTN} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`}
                              aria-label={interpolate(t('openProfileAria'), { name: emp.name })}
                              title={t('openProfile')}
                            >
                              <IconUser className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(emp._id, emp.name)}
                            className={`${ACTION_BTN} border-red-100 bg-white text-red-600 hover:border-red-200 hover:bg-red-50`}
                            aria-label={interpolate(t('deleteEmployeeAria'), { name: emp.name })}
                            title={t('delete')}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function LabourLaw() {
  const { t } = useLanguage()
  return (
    <div className="space-y-4 pt-2">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">{t('labourLaw')}</h3>
        <p className="mt-1.5 text-sm text-slate-500">{t('labourLawPlaceholder')}</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center shadow-sm">
        <p className="font-semibold text-slate-800">{t('labourLaw')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('labourLawPlaceholder')}</p>
      </div>
    </div>
  )
}

function CurrentUpdates() {
  const { t } = useLanguage()
  return (
    <div className="space-y-4 pt-2">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">{t('currentUpdates')}</h3>
        <p className="mt-1.5 text-sm text-slate-500">{t('currentUpdatesPlaceholder')}</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center shadow-sm">
        <p className="font-semibold text-slate-800">{t('currentUpdates')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('currentUpdatesPlaceholder')}</p>
      </div>
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
        {HR_SUB_TABS.map((tab) => {
          const active = subTab === tab.id
          return (
            <ErpSubTabButton
              key={tab.id}
              active={active}
              href={buildSubHref(tab.id)}
              onClick={(event) => handleSubTabClick(tab.id, event)}
              style={active ? {
                background: 'color-mix(in srgb, var(--brand-primary, #F4510B) 12%, white)',
                color: 'var(--brand-primary, #F4510B)',
                border: '1px solid color-mix(in srgb, var(--brand-primary, #F4510B) 35%, white)',
                fontWeight: 700,
              } : undefined}
            >
              {tab.label}
            </ErpSubTabButton>
          )
        })}
      </div>

      {renderSubTab()}
    </ModuleTabColumn>
  )
}
