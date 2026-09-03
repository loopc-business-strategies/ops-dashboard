import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import erpAccountingAPI from '../../../../api/erp-accounting'
import { canManageAccountingPeriods } from '../accessPolicy'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatRange(start, end) {
  if (!start || !end) return '—'
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d) => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${fmt(s)} – ${fmt(e)}`
}

function StatusBadge({ status }) {
  const closed = String(status || '').toUpperCase() === 'CLOSED'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      fontWeight: 700,
      fontSize: '0.82rem',
      color: closed ? '#991B1B' : '#166534',
    }}>
      {closed ? '🔒 CLOSED' : '🟢 OPEN'}
    </span>
  )
}

export default function ERPPeriodClosingTab({ C }) {
  const { token, user } = useAuth()
  const canManage = canManageAccountingPeriods(user)
  const [financialYear, setFinancialYear] = useState(() => new Date().getUTCFullYear())
  const [yearly, setYearly] = useState(null)
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checklist, setChecklist] = useState(null)
  const [modal, setModal] = useState(null) // { mode: 'close'|'reopen', period }
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const data = await erpAccountingAPI.getAccountingPeriods(token, financialYear)
      setYearly(data.yearly || null)
      setMonths(Array.isArray(data.months) ? data.months : [])
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load periods')
      setYearly(null)
      setMonths([])
    } finally {
      setLoading(false)
    }
  }, [token, financialYear])

  useEffect(() => { load() }, [load])

  const openModal = async (mode, period) => {
    setMessage('')
    setPassword('')
    setReason('')
    setChecklist(null)
    setModal({ mode, period })
    if (mode === 'close' && period?._id) {
      try {
        const data = await erpAccountingAPI.getAccountingPeriodClosingCheck(token, period._id)
        setChecklist(data.checklist || null)
      } catch (err) {
        setChecklist(null)
        setMessage(err?.response?.data?.message || 'Could not load closing checklist')
      }
    }
  }

  const submitModal = async () => {
    if (!modal?.period?._id) return
    setBusy(true)
    setMessage('')
    try {
      if (modal.mode === 'close') {
        await erpAccountingAPI.closeAccountingPeriod(token, modal.period._id, { password, reason })
        setMessage('Period closed successfully.')
      } else {
        await erpAccountingAPI.reopenAccountingPeriod(token, modal.period._id, { password, reason })
        setMessage('Period reopened successfully.')
      }
      setModal(null)
      await load()
    } catch (err) {
      const body = err?.response?.data
      if (body?.checklist) setChecklist(body.checklist)
      setMessage(body?.message || err.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const ink = C?.ink || '#111827'
  const soft = C?.inkSoft || '#6B7280'
  const border = C?.p2 || '#E5E7EB'
  const panel = C?.p1 || '#F9FAFB'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: ink, fontSize: '1.25rem', fontWeight: 700 }}>Period Closing</h3>
          <p style={{ margin: '0.35rem 0 0', color: soft, fontSize: '0.85rem' }}>
            Close or reopen monthly and yearly accounting books. Closed periods are read-only.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: ink, fontWeight: 600 }}>
          FINANCIAL YEAR
          <input
            type="number"
            value={financialYear}
            onChange={(e) => setFinancialYear(Number(e.target.value) || new Date().getUTCFullYear())}
            style={{ width: 100, padding: '0.4rem 0.55rem', border: `1px solid ${border}`, borderRadius: 6 }}
          />
        </label>
      </div>

      {error ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B' }}>
          {error}
        </div>
      ) : null}
      {message && !modal ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46' }}>
          {message}
        </div>
      ) : null}

      <div style={{ marginBottom: '1rem', padding: '1rem', background: panel, border: `1px solid ${border}`, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, color: ink }}>FY {financialYear}</div>
            <div style={{ color: soft, fontSize: '0.85rem' }}>{formatRange(yearly?.startDate, yearly?.endDate)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <StatusBadge status={yearly?.status || 'OPEN'} />
            {canManage && yearly ? (
              String(yearly.status).toUpperCase() === 'CLOSED' ? (
                <button type="button" onClick={() => openModal('reopen', yearly)} style={btnSecondary}>Reopen Year</button>
              ) : (
                <button type="button" onClick={() => openModal('close', yearly)} style={btnPrimary}>Close Year</button>
              )
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${border}`, borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: panel, textAlign: 'left' }}>
              <th style={th}>Month</th>
              <th style={th}>Period</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={td}>Loading…</td></tr>
            ) : months.length === 0 ? (
              <tr><td colSpan={4} style={td}>No periods found for this year.</td></tr>
            ) : months.map((row) => {
              const yearClosed = String(yearly?.status || '').toUpperCase() === 'CLOSED'
              const closed = yearClosed || String(row.status).toUpperCase() === 'CLOSED'
              return (
                <tr key={row._id || row.month} style={{ borderTop: `1px solid ${border}` }}>
                  <td style={td}>{MONTH_NAMES[(row.month || 1) - 1]}</td>
                  <td style={td}>{formatRange(row.startDate, row.endDate)}</td>
                  <td style={td}><StatusBadge status={closed ? 'CLOSED' : 'OPEN'} /></td>
                  <td style={td}>
                    {canManage ? (
                      yearClosed ? (
                        <span style={{ color: soft, fontSize: '0.82rem' }}>View only — reopen year first</span>
                      ) : closed ? (
                        <button type="button" onClick={() => openModal('reopen', row)} style={btnSecondary}>Reopen</button>
                      ) : (
                        <button type="button" onClick={() => openModal('close', row)} style={btnPrimary}>Close</button>
                      )
                    ) : (
                      <span style={{ color: soft }}>{closed ? 'View only' : '—'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: '1rem',
        }}>
          <div style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 10, padding: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}>
            <h4 style={{ marginTop: 0, color: ink }}>
              {modal.mode === 'close' ? 'Close' : 'Reopen'}{' '}
              {modal.period.periodType === 'YEARLY'
                ? `FY ${modal.period.financialYear}`
                : `${MONTH_NAMES[(modal.period.month || 1) - 1]} ${modal.period.financialYear}`}
            </h4>
            {modal.mode === 'close' && modal.period.periodType === 'YEARLY' ? (
              <p style={{ marginTop: 0, color: soft, fontSize: '0.85rem' }}>
                Closing the financial year will also close all 12 months. Accounting entries become view-only until Super Admin reopens periods.
              </p>
            ) : null}
            {modal.mode === 'reopen' && modal.period.periodType === 'YEARLY' ? (
              <p style={{ marginTop: 0, color: soft, fontSize: '0.85rem' }}>
                Reopening the financial year will also reopen all 12 months so accounting entries can be edited again.
              </p>
            ) : null}

            {modal.mode === 'close' && checklist ? (
              <div style={{ marginBottom: '1rem', maxHeight: 220, overflowY: 'auto', border: `1px solid ${border}`, borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: ink }}>CLOSING CHECK</div>
                {[...(checklist.blocking || []), ...(checklist.informational || [])].map((item) => (
                  <div key={item.id} style={{ fontSize: '0.85rem', color: item.ok ? '#166534' : '#991B1B', marginBottom: 4 }}>
                    {item.ok ? '✓' : '✗'} {item.label}
                  </div>
                ))}
                {!checklist.canClose ? (
                  <div style={{ marginTop: '0.5rem', color: '#991B1B', fontWeight: 700 }}>CANNOT CLOSE PERIOD</div>
                ) : null}
              </div>
            ) : null}

            <label style={labelStyle}>
              Super Admin password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              {modal.mode === 'reopen' ? 'Reopen reason (required)' : 'Close reason (optional)'}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </label>

            {message ? (
              <div style={{ marginBottom: '0.75rem', color: '#991B1B', fontSize: '0.85rem' }}>{message}</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" disabled={busy} onClick={() => setModal(null)} style={btnSecondary}>Cancel</button>
              <button
                type="button"
                disabled={busy || (modal.mode === 'close' && checklist && !checklist.canClose)}
                onClick={submitModal}
                style={btnPrimary}
              >
                {busy ? 'Working…' : modal.mode === 'close' ? 'Confirm Close' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const th = { padding: '0.7rem 0.85rem', fontWeight: 700, color: '#374151' }
const td = { padding: '0.7rem 0.85rem', color: '#111827', verticalAlign: 'middle' }
const labelStyle = { display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: '#111827', fontSize: '0.85rem' }
const inputStyle = { display: 'block', width: '100%', marginTop: 6, padding: '0.55rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 6, boxSizing: 'border-box' }
const btnPrimary = { background: '#0F766E', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.85rem', fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { background: '#F3F4F6', color: '#111827', border: '1px solid #D1D5DB', borderRadius: 6, padding: '0.45rem 0.85rem', fontWeight: 600, cursor: 'pointer' }
