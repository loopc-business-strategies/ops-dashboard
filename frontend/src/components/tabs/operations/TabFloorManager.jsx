import { useCallback, useEffect, useRef, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { subscribeRealtimeEvents } from '../../../utils/realtimeEventsBus'
import { OLD_PENDING_MINUTES, compareMetalOut, formatGrams, formatWait, minutesWaiting } from './floorBatchCheck'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, TableWrap, TableHead, SH, Modal, ML, MTA, TH, TD } from './operationsTabUI'

const POLL_MS = 30000
const FILTERS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
]
const STATUS_TEXT = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' }

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MetalLines({ lines }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {(lines || []).map((l) => (
        <div key={l.metal} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700, color: C.t1 }}>{l.metal}</span>
          {' · Qty '}{l.qty ?? '—'}
          {' · Purity '}{l.purity ?? '—'}
          {' · '}{l.time || '—'}
        </div>
      ))}
    </div>
  )
}

const deptKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

function LossCheck({ entry, limits }) {
  if (entry.direction !== 'OUT') return <span style={{ color: C.t4 }}>—</span>
  const limit = limits[deptKey(entry.department)] ?? null
  const check = entry.metalIn ? compareMetalOut(entry.metalIn, entry.totals, limit) : null
  if (!check) return <span style={{ color: C.t4 }}>No Metal In for this batch</span>
  const bad = check.overLimit || check.outMoreThanIn
  const warn = { color: C.red, fontWeight: 700, fontSize: 11.5, whiteSpace: 'normal', maxWidth: 260 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ whiteSpace: 'nowrap' }}>
        In {formatGrams(check.inWeight)} → Out {formatGrams(check.outWeight)}
      </div>
      <div style={{ fontWeight: 800, color: bad ? C.red : C.t1, whiteSpace: 'nowrap' }}>
        {check.loss == null
          ? 'Loss —'
          : check.outMoreThanIn
            ? `Out is ${formatGrams(-check.loss)} more than In`
            : `Loss ${formatGrams(check.loss)} (${check.lossPct}%)`}
      </div>
      {check.overLimit ? <div style={warn}>Above the {limit}% loss limit</div> : null}
      {check.purityTooHigh ? (
        <div style={warn}>
          Fine gold out ({formatGrams(check.fineOut)}) is more than in ({formatGrams(check.fineIn)})
          {check.maxPurity != null ? ` — highest possible purity ${check.maxPurity}%` : ''}
        </div>
      ) : null}
      {entry.metalIn.status !== 'APPROVED' ? (
        <div style={{ fontSize: 11, color: C.t4 }}>Metal In not approved yet</div>
      ) : null}
    </div>
  )
}

/** Operations › FM: approve or reject MG Floor Metal In / Out batches sent from the floor tablet. */
export default function TabFloorManager({ showToast, onChanged }) {
  const [status, setStatus] = useState('PENDING')
  const [data, setData] = useState({ entries: [], counts: { PENDING: 0, APPROVED: 0, REJECTED: 0 }, canDecide: false })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [limits, setLimits] = useState({})
  const requestRef = useRef(0)

  useEffect(() => {
    let alive = true
    mgFloorBatchEntriesApi.lossLimits()
      .then((res) => { if (alive) setLimits(res?.limits || {}) })
      .catch(() => { /* loss is still shown, just without the limit */ })
    return () => { alive = false }
  }, [])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await mgFloorBatchEntriesApi.list({ status, limit: 100 })
      if (request !== requestRef.current) return
      setData({ entries: res.entries || [], counts: res.counts || {}, canDecide: Boolean(res.canDecide) })
      setLoadError('')
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(errorMessage(err, 'Could not load floor batches'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [status])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, POLL_MS)
    const unsubscribe = subscribeRealtimeEvents('mg', 'mg-floor:batch-entry', () => load())
    return () => {
      clearInterval(timer)
      unsubscribe()
      requestRef.current += 1
    }
  }, [load])

  const afterDecision = async (title, msg) => {
    showToast(title, msg)
    await load()
    onChanged?.()
  }

  const approve = async (entry) => {
    setBusyId(entry._id)
    try {
      await mgFloorBatchEntriesApi.approve(entry._id)
      await afterDecision('Batch approved', `${entry.department} · Metal ${entry.direction === 'IN' ? 'In' : 'Out'} · Batch ${entry.batchLabel}`)
    } catch (err) {
      showToast('Could not approve', errorMessage(err, 'Approve failed'))
      load()
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = async () => {
    const entry = rejecting
    const text = reason.trim()
    if (!entry || busyId) return
    if (text.length < 3) {
      setRejectError('Write at least 3 characters so the operator knows what to fix.')
      return
    }
    setBusyId(entry._id)
    setRejectError('')
    try {
      await mgFloorBatchEntriesApi.reject(entry._id, text)
      setRejecting(null)
      setReason('')
      await afterDecision('Batch rejected', `The operator will see: ${text}`)
    } catch (err) {
      setRejectError(errorMessage(err, 'Reject failed'))
      load()
    } finally {
      setBusyId(null)
    }
  }

  const counts = data.counts || {}
  const showActions = data.canDecide && status === 'PENDING'
  const headers = ['Sent', 'Department', 'In / Out', 'Batch', 'Metal (Qty · Purity · Time)', 'Loss check', 'Operator', status === 'PENDING' ? 'Status' : 'Decision']
  if (showActions) headers.push('Actions')
  const now = Date.now()
  const oldPendingCount = data.entries.filter(
    (e) => e.status === 'PENDING' && (minutesWaiting(e.submittedAt, now) ?? 0) >= OLD_PENDING_MINUTES,
  ).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title="Floor Manager approval"
        sub="Metal In / Out batches typed and confirmed on the MG Floor tablet. Approving fills the batch's row in Operations → Production and the Production Dashboard — it does not change stock, inventory or ERP."
      >
        <button type="button" className={B.sec} onClick={() => { setLoading(true); load() }}>Refresh</button>
      </SH>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = f.id === status
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1px solid ${active ? 'var(--brand-primary)' : C.border}`,
                background: active ? 'var(--brand-primary)' : '#fff',
                color: active ? '#fff' : C.t2,
              }}
            >
              {f.label} ({counts[f.id] || 0})
            </button>
          )
        })}
      </div>

      <TableWrap>
        <TableHead
          title={`${STATUS_TEXT[status]} batches`}
          subtitle={loading ? 'Loading…' : `${data.entries.length} shown · refreshes every 30 seconds`}
        />
        {oldPendingCount ? (
          <div role="status" style={{ padding: '10px 18px', background: '#fff7ed', color: C.orange, fontSize: 13, fontWeight: 700 }}>
            {oldPendingCount} batch{oldPendingCount === 1 ? ' has' : 'es have'} been waiting over {OLD_PENDING_MINUTES / 60} hour — the floor cannot close them until you decide.
          </div>
        ) : null}
        {loadError ? (
          <div style={{ padding: '14px 18px', color: C.red, fontSize: 13 }}>{loadError}</div>
        ) : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{headers.map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!loading && !data.entries.length ? (
                <tr>
                  <td colSpan={headers.length} style={{ ...TD, textAlign: 'center', color: C.t4, padding: 28 }}>
                    {status === 'PENDING' ? 'Nothing waiting for approval.' : `No ${STATUS_TEXT[status].toLowerCase()} batches yet.`}
                  </td>
                </tr>
              ) : null}
              {data.entries.map((entry) => {
                const waited = entry.status === 'PENDING' ? minutesWaiting(entry.submittedAt, now) : null
                const old = waited != null && waited >= OLD_PENDING_MINUTES
                return (
                <tr key={entry._id} style={old ? { background: '#fff7ed' } : undefined}>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: C.t1 }}>{formatWhen(entry.submittedAt)}</div>
                    <div style={{ fontSize: 11, color: C.t4 }}>Day {entry.entryDate}</div>
                    {waited != null ? (
                      <div style={{ fontSize: 11, fontWeight: old ? 800 : 600, color: old ? C.orange : C.t4 }}>
                        Waiting {formatWait(waited)}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...TD, textTransform: 'capitalize' }}>{entry.department || '—'}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{entry.direction === 'IN' ? 'Metal In' : 'Metal Out'}</td>
                  <td style={{ ...TD, fontWeight: 800, color: C.t1 }}>{entry.batchLabel}</td>
                  <td style={TD}><MetalLines lines={entry.lines} /></td>
                  <td style={TD}><LossCheck entry={entry} limits={limits} /></td>
                  <td style={TD}>{entry.employeeName || '—'}</td>
                  <td style={TD}>
                    <Badge s={STATUS_TEXT[entry.status] || entry.status} />
                    {entry.status !== 'PENDING' ? (
                      <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>
                        {entry.decidedByName || '—'} · {formatWhen(entry.decidedAt)}
                        {entry.status === 'REJECTED' && entry.rejectReason ? (
                          <div style={{ color: C.t2, marginTop: 2, whiteSpace: 'normal', maxWidth: 240 }}>{entry.rejectReason}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  {showActions ? (
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className={`${B.succ} ${B.sm}`}
                        disabled={busyId === entry._id}
                        onClick={() => approve(entry)}
                        style={{ marginRight: 8 }}
                      >
                        {busyId === entry._id ? 'Saving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className={`${B.danger} ${B.sm}`}
                        disabled={busyId === entry._id}
                        onClick={() => { setRejecting(entry); setReason(''); setRejectError('') }}
                      >
                        Reject
                      </button>
                    </td>
                  ) : null}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {rejecting ? (
        <Modal
          title="Reject batch"
          sub={`${rejecting.department} · ${rejecting.direction === 'IN' ? 'Metal In' : 'Metal Out'} · Batch ${rejecting.batchLabel} · ${rejecting.employeeName || ''}`}
          onClose={() => { if (!busyId) setRejecting(null) }}
          onSave={submitReject}
          saveLabel={busyId ? 'Saving…' : 'Reject batch'}
        >
          <ML>Reason (shown to the operator on the tablet)</ML>
          <MTA
            value={reason}
            maxLength={500}
            autoFocus
            placeholder="e.g. Gold qty looks wrong, please recheck and send again"
            onChange={(e) => { setReason(e.target.value); setRejectError('') }}
          />
          {rejectError ? (
            <div role="alert" style={{ color: C.red, fontSize: 12, fontWeight: 600, marginTop: 6 }}>{rejectError}</div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
