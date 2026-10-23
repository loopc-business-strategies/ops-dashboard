import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import erpAccountingAPI from '../../../../api/erp-accounting'

const MODULES = [
  { value: '', label: 'All modules' },
  { value: 'auth', label: 'Auth' },
  { value: 'voucher', label: 'Vouchers' },
  { value: 'journal', label: 'Journal' },
  { value: 'account', label: 'Accounts' },
  { value: 'period', label: 'Period closing' },
]

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'logout_all', label: 'Logout all' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'submit', label: 'Submit' },
  { value: 'approve', label: 'Approve' },
  { value: 'post', label: 'Post' },
  { value: 'void', label: 'Void' },
  { value: 'return', label: 'Return' },
  { value: 'reject', label: 'Reject' },
  { value: 'delete', label: 'Delete' },
  { value: 'PERIOD_CLOSED', label: 'Period closed' },
  { value: 'PERIOD_REOPENED', label: 'Period reopened' },
  { value: 'YEAR_CLOSED', label: 'Year closed' },
  { value: 'YEAR_REOPENED', label: 'Year reopened' },
]

function currentMonthKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function currentYear() {
  return String(new Date().getUTCFullYear())
}

const YEAR_OPTIONS = (() => {
  const y = new Date().getUTCFullYear()
  return [y, y - 1, y - 2, y - 3].map(String)
})()

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const selectStyle = {
  padding: '0.4rem 0.55rem',
  borderRadius: 6,
  border: '1px solid #D1D5DB',
  background: '#fff',
  fontSize: '0.85rem',
  minWidth: 140,
}

const inputStyle = {
  ...selectStyle,
  minWidth: 160,
}

export default function ERPActivityLogTab({ C }) {
  const { token } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    q: '',
    /** 'month' = one calendar month; 'year' = Jan–Dec of that year */
    period: 'month',
    month: currentMonthKey(),
    year: currentYear(),
    page: 1,
  })

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = {
        page: filters.page,
        limit: 50,
      }
      if (filters.module) params.module = filters.module
      if (filters.action) params.action = filters.action
      if (filters.q) params.q = filters.q
      if (filters.period === 'year') {
        params.financialYear = filters.year
      } else if (filters.month) {
        params.month = filters.month
      }
      const data = await erpAccountingAPI.getActivityLogs(token, params)
      setItems(Array.isArray(data.items) ? data.items : [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load activity log')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, filters])

  useEffect(() => { load() }, [load])

  const setFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }))
  }

  const setPeriod = (period) => {
    setFilters((prev) => {
      if (period === prev.period) return prev
      if (period === 'year') {
        const yearFromMonth = String(prev.month || currentMonthKey()).slice(0, 4)
        return { ...prev, period: 'year', year: yearFromMonth || currentYear(), page: 1 }
      }
      let month = prev.month
      if (!/^\d{4}-\d{2}$/.test(month) || month.slice(0, 4) !== String(prev.year)) {
        month = `${prev.year || currentYear()}-01`
      }
      return { ...prev, period: 'month', month, page: 1 }
    })
  }

  const ink = C?.ink || '#111827'
  const soft = C?.inkSoft || '#6B7280'
  const border = C?.p2 || '#E5E7EB'
  const panel = C?.p1 || '#F9FAFB'
  const accent = C?.accent || '#1E3A5F'
  const periodBtn = (active) => ({
    padding: '0.4rem 0.75rem',
    borderRadius: 6,
    border: `1px solid ${active ? accent : '#D1D5DB'}`,
    background: active ? accent : '#fff',
    color: active ? '#fff' : ink,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: ink, fontSize: '1.25rem', fontWeight: 700 }}>Activity Log</h3>
          <p style={{ margin: '0.35rem 0 0', color: soft, fontSize: '0.85rem' }}>
            Who signed in, created accounts, posted vouchers, and closed periods — with date/time filters.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: 6,
            border: `1px solid ${border}`,
            background: '#fff',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: ink,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.65rem',
        alignItems: 'center',
        padding: '0.85rem',
        background: panel,
        border: `1px solid ${border}`,
        borderRadius: 8,
        marginBottom: '1rem',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: soft }}>
          Module
          <select value={filters.module} onChange={(e) => setFilter('module', e.target.value)} style={selectStyle}>
            {MODULES.map((m) => <option key={m.value || 'all'} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: soft }}>
          Action
          <select value={filters.action} onChange={(e) => setFilter('action', e.target.value)} style={selectStyle}>
            {ACTIONS.map((a) => <option key={a.value || 'all'} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: soft }}>
          Show
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => setPeriod('month')} style={periodBtn(filters.period === 'month')}>
              Month
            </button>
            <button type="button" onClick={() => setPeriod('year')} style={periodBtn(filters.period === 'year')}>
              Year
            </button>
            {filters.period === 'month' ? (
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilter('month', e.target.value)}
                style={inputStyle}
                aria-label="Month"
              />
            ) : (
              <select
                value={filters.year}
                onChange={(e) => setFilter('year', e.target.value)}
                style={selectStyle}
                aria-label="Year"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: soft, flex: '1 1 180px' }}>
          Search
          <input
            type="search"
            placeholder="User, doc no, detail…"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </label>
      </div>

      {error && (
        <div style={{ marginBottom: '0.75rem', color: '#991B1B', fontSize: '0.875rem' }}>{error}</div>
      )}

      <div style={{ overflowX: 'auto', border: `1px solid ${border}`, borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: panel, textAlign: 'left', color: soft }}>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>When</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>User</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>Module</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>Action</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>Document</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '1.25rem 0.75rem', color: soft, textAlign: 'center' }}>
                  No activity recorded for this filter yet.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row._id} style={{ borderTop: `1px solid ${border}` }}>
                <td style={{ padding: '0.6rem 0.75rem', color: ink, whiteSpace: 'nowrap' }}>{formatWhen(row.createdAt)}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: ink }}>
                  <div style={{ fontWeight: 600 }}>{row.actorName || 'system'}</div>
                  {row.actorRole ? <div style={{ color: soft, fontSize: '0.75rem' }}>{row.actorRole}</div> : null}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: soft, textTransform: 'capitalize' }}>{row.module || '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: ink, fontWeight: 600 }}>{row.action}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: soft, fontFamily: 'ui-monospace, monospace' }}>{row.documentNo || '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: ink }}>{row.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ color: soft, fontSize: '0.8rem' }}>
          {pagination.total || 0} event{(pagination.total || 0) === 1 ? '' : 's'}
          {loading ? ' · loading…' : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={filters.page <= 1 || loading}
            onClick={() => setFilter('page', filters.page - 1)}
            style={{ ...selectStyle, cursor: filters.page <= 1 ? 'not-allowed' : 'pointer', opacity: filters.page <= 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontSize: '0.8rem', color: soft }}>
            Page {pagination.page || filters.page} / {pagination.pages || 1}
          </span>
          <button
            type="button"
            disabled={filters.page >= (pagination.pages || 1) || loading}
            onClick={() => setFilter('page', filters.page + 1)}
            style={{ ...selectStyle, cursor: filters.page >= (pagination.pages || 1) ? 'not-allowed' : 'pointer', opacity: filters.page >= (pagination.pages || 1) ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
