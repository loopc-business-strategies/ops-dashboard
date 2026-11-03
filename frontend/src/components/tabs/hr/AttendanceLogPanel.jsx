import { useCallback, useEffect, useMemo, useState } from 'react'
import hrAPI from '../../../api/hr'
import attendanceAPI from '../../../api/attendance'
import { useLanguage } from '../../../context/LanguageContext'
import { usePermissions } from '../../../hooks/usePermissions'

function isAttendanceForbidden(err) {
  return err?.response?.status === 403
}

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

const CELL_PAD = { padding: '0.875rem' }

/* Fixed px height beats rem-based h-10 (root font-size is 13px → h-10 = 32.5px) */
const PILL_CONTROL = {
  boxSizing: 'border-box',
  height: '40px',
  minHeight: '40px',
  paddingTop: '8px',
  paddingBottom: '8px',
  paddingLeft: '0.875rem',
  paddingRight: '0.875rem',
  lineHeight: '1.25',
  fontSize: '13px',
  borderColor: 'color-mix(in srgb, var(--brand-primary, #F4510B) 35%, white)',
  borderRadius: '9999px',
}

const PILL_SELECT = {
  ...PILL_CONTROL,
  paddingRight: '1.75rem',
}

const STATUS_DOT = {
  present: '#16A34A',
  absent: '#DC2626',
  leave: '#D97706',
  late: '#F4510B',
}

function IconCalendar({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconUsers({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCheck({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconX({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function IconLeave({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6M19 8v6" />
    </svg>
  )
}

function IconClock({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div
      className="flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ padding: '1rem' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[11px] font-semibold uppercase leading-snug tracking-[0.06em] text-slate-500">
          {label}
        </p>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'color-mix(in srgb, var(--brand-primary, #F4510B) 12%, white)',
            color: 'var(--brand-primary, #F4510B)',
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-slate-900" style={{ marginTop: '0.75rem' }}>
        {value}
      </p>
    </div>
  )
}

/**
 * Daily attendance mark UI for HR: date picker + per-employee status / check-in / check-out.
 */
export default function AttendanceLogPanel({ token }) {
  const { t } = useLanguage()
  const { canMarkAttendance } = usePermissions()
  const [date, setDate] = useState(todayKey)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkStatus, setBulkStatus] = useState('present')
  const [bulkCheckIn, setBulkCheckIn] = useState('09:00')
  const [bulkCheckOut, setBulkCheckOut] = useState('18:00')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const statuses = useMemo(() => [
    { value: 'present', label: t('present') },
    { value: 'absent', label: t('absent') },
    { value: 'leave', label: t('leaveStatus') },
    { value: 'late', label: t('late') },
  ], [t])

  const allSelected = employees.length > 0 && selectedIds.size === employees.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const load = useCallback(async (isMounted = () => true) => {
    setLoading(true)
    setError('')
    setMessage('')
    setSelectedIds(new Set())
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

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(employees.map((e) => e._id)))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyBulkToIds = (ids, { status, checkIn, checkOut }) => {
    if (!ids.length) return
    setRows((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        next[id] = {
          ...(next[id] || { status: 'absent', checkIn: '', checkOut: '' }),
          status,
          checkIn: checkIn || '',
          checkOut: checkOut || '',
        }
      }
      return next
    })
  }

  const markOne = async (emp, rowOverride) => {
    const row = rowOverride || rows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }
    await attendanceAPI.markRecord(token, {
      employeeId: emp._id,
      employeeName: emp.name,
      department: deptForMark(emp),
      date,
      status: row.status,
      checkIn: row.checkIn || '',
      checkOut: row.checkOut || '',
    })
  }

  const handleSave = async (emp) => {
    if (!canMarkAttendance) {
      setError(t('attendancePermissionDenied'))
      return
    }
    setSavingId(emp._id)
    setError('')
    setMessage('')
    try {
      await markOne(emp)
      setMessage(interpolate(t('savedAttendanceFor'), { name: emp.name }))
    } catch (err) {
      setError(
        isAttendanceForbidden(err)
          ? t('attendancePermissionDenied')
          : (err.response?.data?.message || interpolate(t('failedSaveNamed'), { name: emp.name })),
      )
    } finally {
      setSavingId(null)
    }
  }

  const saveEmployees = async (list, rowMap) => {
    if (!list.length) {
      setError(t('selectEmployeesFirst'))
      return
    }
    if (!canMarkAttendance) {
      setError(t('attendancePermissionDenied'))
      return
    }
    setBulkSaving(true)
    setError('')
    setMessage('')
    const results = await Promise.allSettled(
      list.map((emp) => markOne(emp, rowMap?.[emp._id])),
    )
    const saved = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.find((r) => r.status === 'rejected')
    setMessage(interpolate(t('savedAttendanceBulk'), { saved, total: list.length }))
    if (failed) {
      setError(
        isAttendanceForbidden(failed.reason)
          ? t('attendancePermissionDenied')
          : (failed.reason?.response?.data?.message || t('failedBulkAttendance')),
      )
    }
    setBulkSaving(false)
  }

  const handleApplyToSelected = () => {
    const ids = [...selectedIds]
    if (!ids.length) {
      setError(t('selectEmployeesFirst'))
      return
    }
    setError('')
    applyBulkToIds(ids, { status: bulkStatus, checkIn: bulkCheckIn, checkOut: bulkCheckOut })
    setMessage(interpolate(t('appliedBulkToSelected'), { count: ids.length }))
  }

  const handleSaveSelected = async () => {
    const list = employees.filter((e) => selectedIds.has(e._id))
    // Apply toolbar values to selected first so save uses them
    const nextRows = { ...rows }
    for (const emp of list) {
      nextRows[emp._id] = {
        ...(nextRows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }),
        status: bulkStatus,
        checkIn: bulkCheckIn || '',
        checkOut: bulkCheckOut || '',
      }
    }
    setRows(nextRows)
    await saveEmployees(list, nextRows)
  }

  const handleMarkAllPresent = async () => {
    const ids = employees.map((e) => e._id)
    setSelectedIds(new Set(ids))
    const nextRows = { ...rows }
    for (const id of ids) {
      nextRows[id] = {
        ...(nextRows[id] || { status: 'absent', checkIn: '', checkOut: '' }),
        status: 'present',
        checkIn: bulkCheckIn || '09:00',
        checkOut: bulkCheckOut || '18:00',
      }
    }
    setBulkStatus('present')
    setRows(nextRows)
    await saveEmployees(employees, nextRows)
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

  const summaryCards = useMemo(() => ([
    { label: t('totalEmployees'), value: employees.length, icon: IconUsers },
    { label: t('present'), value: counts.present, icon: IconCheck },
    { label: t('absent'), value: counts.absent, icon: IconX },
    { label: t('onLeave'), value: counts.leave, icon: IconLeave },
    { label: t('late'), value: counts.late, icon: IconClock },
  ]), [t, employees.length, counts])

  const busy = bulkSaving || savingId !== null
  const markDisabled = busy || !canMarkAttendance

  return (
    <div className="flex flex-col gap-5" style={{ paddingTop: '0.5rem' }}>
      {/* Header + date */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{t('attendanceLogTitle')}</h3>
          <p className="text-sm text-slate-500" style={{ marginTop: '0.5rem' }}>
            {t('attendanceLogHint')}
          </p>
        </div>
        <div
          className="shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ padding: '0.75rem 1rem' }}
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
            {t('date')}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border bg-white text-sm font-medium text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
              style={PILL_CONTROL}
            />
          </label>
        </div>
      </div>

      {!canMarkAttendance && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
          style={{ padding: '0.875rem' }}
        >
          {t('attendancePermissionBanner')}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-sm text-red-700" style={{ padding: '0.875rem' }}>
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-700" style={{ padding: '0.875rem' }}>
          {message}
        </div>
      )}

      {/* Summary cards */}
      {!loading && employees.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
            />
          ))}
        </div>
      )}

      {/* Bulk attendance toolbar */}
      {!loading && employees.length > 0 && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row lg:flex-wrap lg:items-center"
          style={{ padding: '0.875rem 1rem' }}
        >
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected }}
              onChange={toggleSelectAll}
              disabled={busy}
              className="h-4 w-4 rounded border-slate-300 text-[color:var(--brand-primary,#F4510B)] focus:ring-[color:var(--brand-primary)]"
            />
            {t('selectAllEmployees')}
          </label>

          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
            {t('attendanceStatus')}
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              disabled={busy}
              className="border bg-white text-sm font-medium text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
              style={{
                ...PILL_SELECT,
                borderColor: `color-mix(in srgb, ${STATUS_DOT[bulkStatus] || '#64748B'} 45%, white)`,
              }}
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
            {t('checkIn')}
            <input
              type="time"
              value={bulkCheckIn}
              onChange={(e) => setBulkCheckIn(e.target.value)}
              disabled={busy}
              className="border bg-white text-sm text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
              style={PILL_CONTROL}
            />
          </label>

          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
            {t('checkOut')}
            <input
              type="time"
              value={bulkCheckOut}
              onChange={(e) => setBulkCheckOut(e.target.value)}
              disabled={busy}
              className="border bg-white text-sm text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
              style={PILL_CONTROL}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <button
              type="button"
              disabled={busy}
              onClick={handleApplyToSelected}
              className="inline-flex h-9 items-center text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                padding: '0 0.875rem',
                borderRadius: '9999px',
              }}
            >
              {t('applyToSelected')}
            </button>
            <button
              type="button"
              disabled={markDisabled || selectedIds.size === 0}
              onClick={handleSaveSelected}
              className="inline-flex h-9 items-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'var(--brand-primary, #F4510B)',
                color: 'var(--brand-on-primary, #ffffff)',
                padding: '0 0.875rem',
                borderRadius: '9999px',
              }}
            >
              {bulkSaving ? t('saving') : t('saveSelected')}
            </button>
            <button
              type="button"
              disabled={markDisabled}
              onClick={handleMarkAllPresent}
              className="inline-flex h-9 items-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'var(--brand-primary, #F4510B)',
                color: 'var(--brand-on-primary, #ffffff)',
                padding: '0 0.875rem',
                borderRadius: '9999px',
              }}
            >
              {bulkSaving ? t('saving') : t('markAllAsPresent')}
            </button>
          </div>
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
          <p className="text-sm text-slate-500" style={{ marginTop: '0.25rem' }}>{t('addEmployeesFirst')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky top-0 z-[1] w-10 bg-slate-50" style={CELL_PAD}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected }}
                      onChange={toggleSelectAll}
                      disabled={busy}
                      aria-label={t('selectAllEmployees')}
                      className="h-4 w-4 rounded border-slate-300 text-[color:var(--brand-primary,#F4510B)] focus:ring-[color:var(--brand-primary)]"
                    />
                  </th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD}>{t('name')}</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD}>{t('department')}</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD}>{t('status')}</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD}>{t('checkIn')}</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD}>{t('checkOut')}</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600" style={CELL_PAD} />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const row = rows[emp._id] || { status: 'absent', checkIn: '', checkOut: '' }
                  const statusColor = STATUS_DOT[row.status] || '#64748B'
                  const checked = selectedIds.has(emp._id)
                  return (
                    <tr
                      key={emp._id}
                      className="border-b border-slate-100 bg-white transition-colors last:border-b-0 hover:bg-orange-50/40"
                    >
                      <td className="align-middle" style={CELL_PAD}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectOne(emp._id)}
                          disabled={busy}
                          aria-label={emp.name}
                          className="h-4 w-4 rounded border-slate-300 text-[color:var(--brand-primary,#F4510B)] focus:ring-[color:var(--brand-primary)]"
                        />
                      </td>
                      <td className="whitespace-nowrap align-middle text-sm font-semibold text-slate-900" style={CELL_PAD}>
                        {emp.name}
                      </td>
                      <td className="whitespace-nowrap align-middle text-sm text-slate-600" style={CELL_PAD}>
                        {emp.department || '—'}
                      </td>
                      <td className="align-middle" style={CELL_PAD}>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: statusColor }}
                            aria-hidden
                          />
                          <select
                            value={row.status}
                            onChange={(e) => setRowField(emp._id, 'status', e.target.value)}
                            disabled={busy}
                            className="border bg-white text-sm font-medium text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                            style={{
                              ...PILL_SELECT,
                              borderColor: `color-mix(in srgb, ${statusColor} 45%, white)`,
                            }}
                          >
                            {statuses.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="align-middle" style={CELL_PAD}>
                        <input
                          type="time"
                          value={row.checkIn || ''}
                          onChange={(e) => setRowField(emp._id, 'checkIn', e.target.value)}
                          disabled={busy}
                          className="border bg-white text-sm text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                          style={PILL_CONTROL}
                        />
                      </td>
                      <td className="align-middle" style={CELL_PAD}>
                        <input
                          type="time"
                          value={row.checkOut || ''}
                          onChange={(e) => setRowField(emp._id, 'checkOut', e.target.value)}
                          disabled={busy}
                          className="border bg-white text-sm text-slate-800 outline-none transition-colors focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
                          style={PILL_CONTROL}
                        />
                      </td>
                      <td className="whitespace-nowrap align-middle" style={CELL_PAD}>
                        <button
                          type="button"
                          disabled={markDisabled || savingId === emp._id}
                          onClick={() => handleSave(emp)}
                          className="inline-flex h-9 items-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            background: 'var(--brand-primary, #F4510B)',
                            color: 'var(--brand-on-primary, #ffffff)',
                            padding: '0 0.875rem',
                            borderRadius: '9999px',
                          }}
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
