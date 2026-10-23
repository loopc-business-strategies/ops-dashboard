import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import erpAccountingAPI from '../../../api/erp-accounting'
import { btn, S } from './voucherTabShared'

function currentMonthKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

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
  })
}

/**
 * Compact Activity Log scoped to one voucher type (Payment, Receipt, Metal Sale, …).
 */
export default function VoucherActivityLogModal({
  open,
  onClose,
  voucherType,
  voucherLabel,
}) {
  const { token } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(currentMonthKey())
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const typeKey = String(voucherType || '').trim().toLowerCase()
  const title = `${voucherLabel || 'Voucher'} — Activity Log`

  const load = useCallback(async () => {
    if (!token || !open || !typeKey) return
    setLoading(true)
    setError('')
    try {
      const params = {
        page,
        limit: 50,
        transactionType: typeKey,
        module: 'voucher',
      }
      if (month) params.month = month
      if (action) params.action = action
      if (q.trim()) params.q = q.trim()
      const data = await erpAccountingAPI.getActivityLogs(token, params)
      setItems(Array.isArray(data.items) ? data.items : [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load activity log')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, open, typeKey, page, month, action, q])

  useEffect(() => {
    if (!open) return undefined
    setPage(1)
    setMonth(currentMonthKey())
    setAction('')
    setQ('')
    return undefined
  }, [open, typeKey])

  useEffect(() => {
    load()
  }, [load])

  if (!open) return null

  const control = {
    padding: '0.28rem 0.45rem',
    borderRadius: 5,
    border: `1px solid ${S.border}`,
    fontSize: '0.78rem',
    background: '#fff',
  }
  const smallBtn = {
    ...btn('gray'),
    padding: '0.28rem 0.55rem',
    fontSize: '0.78rem',
  }
  const cell = { padding: '0.4rem 0.5rem' }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          width: 'min(640px, 100%)',
          maxHeight: '68vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
        }}
      >
        <div
          style={{
            background: 'var(--brand-dark, var(--brand-primary))',
            color: 'var(--brand-on-solid, #fff)',
            padding: '0.55rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.25 }}>{title}</div>
          <button
            type="button"
            aria-label="Close activity log"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0.2rem 0.35rem',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '0.5rem 0.75rem',
          borderBottom: `1px solid ${S.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          alignItems: 'center',
        }}
        >
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1) }}
            aria-label="Month"
            style={{ ...control, width: '9.5rem' }}
          />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
            aria-label="Action"
            style={{ ...control, minWidth: 100, maxWidth: 120 }}
          >
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="submit">Submit</option>
            <option value="post">Post</option>
            <option value="void">Void</option>
            <option value="return">Return</option>
            <option value="reject">Reject</option>
            <option value="delete">Delete</option>
          </select>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Search…"
            style={{ ...control, flex: '1 1 120px', minWidth: 100 }}
          />
          <button type="button" style={smallBtn} onClick={load} disabled={loading} title="Refresh">
            {loading ? '…' : '↺'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem 0.75rem' }}>
          {error ? (
            <div style={{ color: '#991B1B', fontSize: '0.78rem', marginBottom: '0.45rem' }}>{error}</div>
          ) : null}
          <div style={{ overflowX: 'auto', border: `1px solid ${S.border}`, borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', textAlign: 'left', color: S.muted }}>
                  <th style={{ ...cell, fontWeight: 600 }}>When</th>
                  <th style={{ ...cell, fontWeight: 600 }}>User</th>
                  <th style={{ ...cell, fontWeight: 600 }}>Action</th>
                  <th style={{ ...cell, fontWeight: 600 }}>Document</th>
                  <th style={{ ...cell, fontWeight: 600 }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...cell, color: S.muted, textAlign: 'center', padding: '0.9rem 0.5rem' }}>
                      No {voucherLabel || 'voucher'} activity for this filter yet.
                    </td>
                  </tr>
                ) : null}
                {items.map((row) => (
                  <tr key={row._id} style={{ borderTop: `1px solid ${S.border}` }}>
                    <td style={{ ...cell, color: S.ink, whiteSpace: 'nowrap' }}>{formatWhen(row.createdAt)}</td>
                    <td style={{ ...cell, color: S.ink }}>
                      <div style={{ fontWeight: 600 }}>{row.actorName || 'system'}</div>
                      {row.actorRole ? <div style={{ color: S.muted, fontSize: '0.7rem' }}>{row.actorRole}</div> : null}
                    </td>
                    <td style={{ ...cell, color: S.ink, fontWeight: 600 }}>{row.action}</td>
                    <td style={{ ...cell, color: S.muted, fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>{row.documentNo || '—'}</td>
                    <td style={{ ...cell, color: S.ink, maxWidth: 220 }}>{row.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{
          borderTop: `1px solid ${S.border}`,
          padding: '0.45rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          background: '#F9FAFB',
        }}
        >
          <span style={{ color: S.muted, fontSize: '0.74rem' }}>
            {pagination.total || 0} event{(pagination.total || 0) === 1 ? '' : 's'}
            {loading ? ' · …' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ ...smallBtn, opacity: page <= 1 ? 0.5 : 1 }}
            >
              Prev
            </button>
            <span style={{ fontSize: '0.74rem', color: S.muted }}>
              {pagination.page || page}/{pagination.pages || 1}
            </span>
            <button
              type="button"
              disabled={page >= (pagination.pages || 1) || loading}
              onClick={() => setPage((p) => p + 1)}
              style={{ ...smallBtn, opacity: page >= (pagination.pages || 1) ? 0.5 : 1 }}
            >
              Next
            </button>
            <button type="button" style={smallBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
