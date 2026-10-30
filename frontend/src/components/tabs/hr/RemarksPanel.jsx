import { useCallback, useEffect, useState } from 'react'
import hrAPI from '../../../api/hr'

function formatRemarkWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * HR Remarks sub-tab: pick an employee and append dated notes over time.
 */
export default function RemarksPanel({ token }) {
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [remarks, setRemarks] = useState([])
  const [text, setText] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [loadingRemarks, setLoadingRemarks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingEmployees(true)
      setError('')
      try {
        const data = await hrAPI.getEmployees(token)
        if (!mounted) return
        const list = data.employees || []
        setEmployees(list)
        if (list.length && !employeeId) setEmployeeId(list[0]._id)
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Failed to load employees.')
      } finally {
        if (mounted) setLoadingEmployees(false)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial employee load only
  }, [token])

  const loadRemarks = useCallback(async (isMounted = () => true) => {
    if (!employeeId) {
      setRemarks([])
      return
    }
    setLoadingRemarks(true)
    setError('')
    try {
      const data = await hrAPI.getEmployeeRemarks(token, employeeId)
      if (isMounted()) setRemarks(data.remarks || [])
    } catch (err) {
      if (isMounted()) setError(err.response?.data?.message || 'Failed to load remarks.')
    } finally {
      if (isMounted()) setLoadingRemarks(false)
    }
  }, [token, employeeId])

  useEffect(() => {
    let mounted = true
    loadRemarks(() => mounted)
    return () => { mounted = false }
  }, [loadRemarks])

  const handleAdd = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!employeeId || !trimmed) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await hrAPI.addEmployeeRemark(token, employeeId, { text: trimmed })
      setText('')
      setMessage('Remark added.')
      await loadRemarks()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add remark.')
    } finally {
      setSaving(false)
    }
  }

  const selected = employees.find((e) => e._id === employeeId)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold leading-tight text-white">Remarks</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Add dated notes for an employee over time
          </p>
        </div>
        <label className="flex min-w-[220px] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Employee
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={loadingEmployees || employees.length === 0}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium normal-case tracking-normal text-white"
          >
            {employees.length === 0 ? (
              <option value="">No employees</option>
            ) : (
              employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}{emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                </option>
              ))
            )}
          </select>
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

      {loadingEmployees ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full"
            style={{ border: '4px solid var(--brand-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-800 py-16 text-center">
          <p className="font-medium text-gray-400">No employees yet</p>
          <p className="mt-1 text-sm text-gray-600">Add employees under Employee List first</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-gray-800 bg-gray-900/40 p-4"
          >
            <p className="mb-3 text-sm font-medium text-white">
              New remark{selected ? ` for ${selected.name}` : ''}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Write a note…"
              className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">{text.trim().length}/2000</span>
              <button
                type="submit"
                disabled={saving || !text.trim()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                {saving ? 'Saving…' : 'Add remark'}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-gray-800">
            <div className="border-b border-gray-800 px-4 py-3">
              <p className="text-sm font-medium text-white">Remark history</p>
              <p className="mt-0.5 text-xs text-gray-500">Newest first</p>
            </div>
            {loadingRemarks ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="h-5 w-5 animate-spin rounded-full"
                  style={{ border: '3px solid var(--brand-primary)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : remarks.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">
                No remarks yet for this employee
              </div>
            ) : (
              <ul className="max-h-[480px] divide-y divide-gray-800 overflow-y-auto">
                {remarks.map((r) => (
                  <li key={r._id} className="px-4 py-3">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-gray-400">
                        {formatRemarkWhen(r.createdAt)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.createdByName || '—'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
                      {r.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
