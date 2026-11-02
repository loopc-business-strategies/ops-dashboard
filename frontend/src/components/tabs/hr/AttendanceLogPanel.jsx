import { useCallback, useEffect, useMemo, useState } from 'react'
import hrAPI from '../../../api/hr'
import attendanceAPI from '../../../api/attendance'
import { useLanguage } from '../../../context/LanguageContext'

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase()
}

function deptForMark(employee) {
  const dept = String(employee?.department || '').trim().toLowerCase()
  return dept || 'operations'
}

function interpolate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key])
  ))
}

/**
 * Daily attendance mark UI for HR: date picker + per-employee status / check-in / check-out.
 */
export default function AttendanceLogPanel({ token }) {
  const { t } = useLanguage()
  const [date, setDate] = useState(todayKey)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const statuses = useMemo(() => [
    { value: 'present', label: t('present') },
    { value: 'absent', label: t('absent') },
    { value: 'leave', label: t('leaveStatus') },
    { value: 'late', label: t('late') },
  ], [t])

  const load = useCallback(async (isMounted = () => true) => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const [empRes, recRes] = await Promise.all([
        hrAPI.getEmployees(token),
        attendanceAPI.getRecords(token, { date }),
      ])
      if (!isMounted()) return

      const list = empRes.employees || []
      setEmployees(list)

      const byName = new Map(
        (recRes.records || []).map((r) => [normalizeName(r.employeeName), r]),
      )

      const next = {}
      for (const emp of list) {
        const existing = byName.get(normalizeName(emp.name))
        next[emp._id] = {
          status: existing?.status || 'absent',
          checkIn: existing?.checkIn || '',
          checkOut: existing?.checkOut || '',
        }
      }
      setRows(next)
    } catch (err) {
      if (isMounted()) {
        setError(err.response?.data?.message || t('failedLoadAttendance'))
      }
    } finally {
      if (isMounted()) setLoading(false)
    }
  }, [token, date, t])

  useEffect(() => {
    let mounted = true
    load(() => mounted)
    return () => { mounted = false }
  }, [load])

  const setRowField = (id, field, value) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleSave = async (emp) => {
    const row = rows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }
    setSavingId(emp._id)
    setError('')
    setMessage('')
    try {
      await attendanceAPI.markRecord(token, {
        employeeId: emp._id,
        employeeName: emp.name,
        department: deptForMark(emp),
        date,
        status: row.status,
        checkIn: row.checkIn || '',
        checkOut: row.checkOut || '',
      })
      setMessage(interpolate(t('savedAttendanceFor'), { name: emp.name }))
    } catch (err) {
      setError(err.response?.data?.message || interpolate(t('failedSaveNamed'), { name: emp.name }))
    } finally {
      setSavingId(null)
    }
  }

  const counts = useMemo(() => {
    const values = Object.values(rows)
    return {
      present: values.filter((r) => r.status === 'present').length,
      absent: values.filter((r) => r.status === 'absent').length,
      leave: values.filter((r) => r.status === 'leave').length,
      late: values.filter((r) => r.status === 'late').length,
    }
  }, [rows])

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">{t('attendanceLogTitle')}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {t('attendanceLogHint')}
            {employees.length > 0
              ? ` · ${interpolate(t('attendanceCountSummary'), counts)}`
              : ''}
          </p>
        </div>
        <label className="flex shrink-0 flex-col gap-1.5 text-xs font-semibold text-slate-500">
          {t('date')}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
          {message}
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
          <p className="font-semibold text-slate-800">{t('noEmployeesToMark')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('addEmployeesFirst')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">{t('name')}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">{t('department')}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">{t('status')}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">{t('checkIn')}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">{t('checkOut')}</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600" />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, index) => {
                  const row = rows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }
                  return (
                    <tr
                      key={emp._id}
                      className={`border-b border-slate-100 transition-colors last:border-b-0 hover:bg-orange-50/35 ${index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 align-middle text-sm font-semibold text-slate-900">
                        {emp.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600">
                        {emp.department || '—'}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <select
                          value={row.status}
                          onChange={(e) => setRowField(emp._id, 'status', e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                        >
                          {statuses.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <input
                          type="time"
                          value={row.checkIn || ''}
                          onChange={(e) => setRowField(emp._id, 'checkIn', e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                        />
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <input
                          type="time"
                          value={row.checkOut || ''}
                          onChange={(e) => setRowField(emp._id, 'checkOut', e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle">
                        <button
                          type="button"
                          disabled={savingId === emp._id}
                          onClick={() => handleSave(emp)}
                          className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
                        >
                          {savingId === emp._id ? t('saving') : t('save')}
                        </button>
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
