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
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold leading-tight text-white">{t('attendanceLogTitle')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {t('attendanceLogHint')}
            {employees.length > 0
              ? ` · ${interpolate(t('attendanceCountSummary'), counts)}`
              : ''}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t('date')}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          {message}
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
        <div className="rounded-2xl border border-dashed border-gray-800 py-16 text-center">
          <p className="font-medium text-gray-400">{t('noEmployeesToMark')}</p>
          <p className="mt-1 text-sm text-gray-600">{t('addEmployeesFirst')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">{t('name')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">{t('department')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">{t('status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">{t('checkIn')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400">{t('checkOut')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium leading-none text-gray-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {employees.map((emp) => {
                const row = rows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }
                return (
                  <tr key={emp._id} className="transition-colors hover:bg-gray-800/30">
                    <td className="px-4 py-3 whitespace-nowrap font-medium leading-tight text-white">
                      {emp.name}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap leading-tight text-gray-400">
                      {emp.department || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(e) => setRowField(emp._id, 'status', e.target.value)}
                        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white"
                      >
                        {statuses.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={row.checkIn || ''}
                        onChange={(e) => setRowField(emp._id, 'checkIn', e.target.value)}
                        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={row.checkOut || ''}
                        onChange={(e) => setRowField(emp._id, 'checkOut', e.target.value)}
                        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={savingId === emp._id}
                        onClick={() => handleSave(emp)}
                        className="text-xs font-medium text-sky-400 transition-colors hover:text-sky-300 disabled:opacity-60"
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
      )}
    </div>
  )
}
