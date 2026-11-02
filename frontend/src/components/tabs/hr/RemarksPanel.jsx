import { useCallback, useEffect, useState } from 'react'
import hrAPI from '../../../api/hr'
import { useLanguage } from '../../../context/LanguageContext'

function formatRemarkWhen(value, langCode = 'en') {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const locale = langCode === 'ru' ? 'ru-RU' : langCode === 'uz' ? 'uz-UZ' : undefined
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function interpolate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] === undefined || vars[key] === null ? `{${key}}` : String(vars[key])
  ))
}

/**
 * HR Remarks sub-tab: pick an employee and append dated notes over time.
 */
export default function RemarksPanel({ token }) {
  const { t, langCode } = useLanguage()
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
        if (mounted) setError(err.response?.data?.message || t('failedLoadEmployees'))
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
      if (isMounted()) setError(err.response?.data?.message || t('failedLoadRemarks'))
    } finally {
      if (isMounted()) setLoadingRemarks(false)
    }
  }, [token, employeeId, t])

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
      setMessage(t('remarkAdded'))
      await loadRemarks()
    } catch (err) {
      setError(err.response?.data?.message || t('failedAddRemark'))
    } finally {
      setSaving(false)
    }
  }

  const selected = employees.find((e) => e._id === employeeId)

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">{t('remarksTitle')}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {t('remarksHint')}
          </p>
        </div>
        <label className="flex min-w-[220px] shrink-0 flex-col gap-1.5 text-xs font-semibold text-slate-500">
          {t('employee')}
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={loadingEmployees || employees.length === 0}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {employees.length === 0 ? (
              <option value="">{t('noEmployees')}</option>
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {loadingEmployees ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24 shadow-sm">
          <div
            className="h-7 w-7 animate-spin rounded-full"
            style={{ border: '3px solid var(--brand-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <p className="font-semibold text-slate-800">{t('noEmployeesYet')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('addEmployeesFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="mb-3 text-sm font-semibold text-slate-900">
              {selected
                ? interpolate(t('newRemarkFor'), { name: selected.name })
                : t('newRemark')}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t('writeNotePlaceholder')}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">{text.trim().length}/2000</span>
              <button
                type="submit"
                disabled={saving || !text.trim()}
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--brand-button-bg, var(--brand-dark))', color: 'var(--brand-on-primary, #ffffff)' }}
              >
                {saving ? t('saving') : t('addRemark')}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{t('remarkHistory')}</p>
              <p className="mt-0.5 text-xs text-slate-500">{t('newestFirst')}</p>
            </div>
            {loadingRemarks ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="h-6 w-6 animate-spin rounded-full"
                  style={{ border: '3px solid var(--brand-primary)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : remarks.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                {t('noRemarksYet')}
              </div>
            ) : (
              <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
                {remarks.map((r) => (
                  <li key={r._id} className="px-4 py-3">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {formatRemarkWhen(r.createdAt, langCode)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {r.createdByName || '—'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
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
