import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './production/loopcProductionDepartments'
import { BATCH_STATUS, countByStatus, eventText, historyPresets, sideStatusText } from './batchHistory'
import { formatGrams } from './floorBatchCheck'
import { formatPct } from './lossLimits'
import { formatPeriod } from './lossReport'
import { OPS_C as C } from './operationsTabTokens'
import { B, SH, StatCard, TableHead, TableWrap, TD, TH } from './operationsTabUI'

const DEPARTMENT_LABELS = Object.fromEntries(LOOPC_PRODUCTION_DEPARTMENTS.map((d) => [d.key, d.label]))
const labelOf = (key) => DEPARTMENT_LABELS[key] || key
const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback
const SEARCH_DELAY_MS = 400
const DOT = { sent: '#94a3b8', approved: '#10b981', rejected: '#ef4444', undone: '#f97316' }
const SIDE_COLOR = { APPROVED: '#065f46', PENDING: '#9a3412', REJECTED: '#b91c1c' }
const HEADERS = ['Day', 'Department', 'Batch', 'Metal In', 'Metal Out', 'Loss', 'Times sent', 'Last activity', 'Status']

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Side({ side }) {
  if (!side) return <span style={{ color: C.t4 }}>Not sent</span>
  return (
    <div style={{ whiteSpace: 'nowrap' }}>
      <div style={{ fontWeight: 700, color: C.t1 }}>{formatGrams(side.weight)}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: SIDE_COLOR[side.status] || C.t4 }}>
        {sideStatusText(side)}{side.times > 1 ? ` · sent ${side.times}×` : ''}
      </div>
    </div>
  )
}

function Timeline({ events }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: '6px 4px 6px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e, i) => {
        const t = eventText(e)
        return (
          <li key={`${e.entryId}-${e.type}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: DOT[t.tone], marginTop: 4, flex: '0 0 auto' }} />
            <span style={{ width: 120, flex: '0 0 auto', fontSize: 12, color: C.t4, whiteSpace: 'nowrap' }}>{formatWhen(e.at)}</span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: t.tone === 'rejected' ? C.red : C.t1 }}>{t.title}</span>
              {t.detail ? <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{t.detail}</div> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Operations › History: every MG Floor batch with its full story (sent, approved, rejected, undone). */
export default function TabBatchHistory() {
  const presets = useMemo(() => historyPresets(), [])
  const [range, setRange] = useState({ from: presets[2].from, to: presets[2].to })
  const [department, setDepartment] = useState('')
  const [search, setSearch] = useState({ batch: '', operator: '' })
  const [query, setQuery] = useState({ batch: '', operator: '' })
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setQuery({ batch: search.batch.trim(), operator: search.operator.trim() }), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    try {
      const res = await mgFloorBatchEntriesApi.history({ ...range, department, ...query })
      if (request !== requestRef.current) return
      setData(res)
      setLoadError('')
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(errorMessage(err, 'Could not load batch history'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [range, department, query])

  useEffect(() => {
    load()
    return () => { requestRef.current += 1 }
  }, [load])

  const batches = data?.batches || []
  const counts = countByStatus(batches)
  const toggle = (key) => setOpen((cur) => {
    const next = new Set(cur)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const control = {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: 'inherit',
    color: C.t1,
    background: '#fff',
  }
  const pill = (active) => ({
    padding: '7px 14px',
    borderRadius: 20,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: `1px solid ${active ? 'var(--brand-primary)' : C.border}`,
    background: active ? 'var(--brand-primary)' : '#fff',
    color: active ? '#fff' : C.t2,
  })
  const field = { fontSize: 12, color: C.t3, display: 'flex', flexDirection: 'column', gap: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title="Batch history"
        sub="Every Metal In / Out sent from the floor tablets and what happened to it — sent, approved, rejected or undone, by whom and when. Click a batch to see its full story."
      >
        <button type="button" className={B.sec} onClick={load}>Refresh</button>
      </SH>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button key={p.id} type="button" style={pill(p.from === range.from && p.to === range.to)} onClick={() => setRange({ from: p.from, to: p.to })}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={field}>
          From
          <input type="date" style={control} value={range.from} onChange={(e) => e.target.value && setRange((c) => ({ ...c, from: e.target.value }))} />
        </label>
        <label style={field}>
          To
          <input type="date" style={control} value={range.to} onChange={(e) => e.target.value && setRange((c) => ({ ...c, to: e.target.value }))} />
        </label>
        <label style={field}>
          Department
          <select style={control} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {LOOPC_PRODUCTION_DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label style={field}>
          Batch
          <input style={{ ...control, width: 110 }} placeholder="e.g. 12" value={search.batch} onChange={(e) => setSearch((s) => ({ ...s, batch: e.target.value }))} />
        </label>
        <label style={field}>
          Operator
          <input style={{ ...control, width: 170 }} placeholder="Name" value={search.operator} onChange={(e) => setSearch((s) => ({ ...s, operator: e.target.value }))} />
        </label>
      </div>

      {loadError ? <div role="alert" style={{ color: C.red, fontSize: 13 }}>{loadError}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11 }}>
        <StatCard label="Finished" value={counts.finished} sub="Metal In and Out approved" />
        <StatCard label="Running" value={counts.running} sub="Waiting for Metal Out" />
        <StatCard label="Waiting for F.M" value={counts.waiting} sub="Sent, not decided yet" dot={counts.waiting ? '#f97316' : undefined} />
        <StatCard label="Sent back" value={counts.sent_back} sub="Rejected or undone, not resent" dot={counts.sent_back ? '#ef4444' : undefined} />
      </div>

      <TableWrap>
        <TableHead
          title="Batches"
          subtitle={loading ? 'Loading…' : `${batches.length} batch${batches.length === 1 ? '' : 'es'} · ${formatPeriod(range.from)} – ${formatPeriod(range.to)}`}
        />
        {data?.truncated ? (
          <div role="status" style={{ padding: '10px 18px', background: '#fff7ed', color: C.orange, fontSize: 13, fontWeight: 700 }}>
            Too many entries in this range — only the oldest are shown. Pick a shorter range or a department.
          </div>
        ) : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead><tr>{HEADERS.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !batches.length ? (
                <tr><td colSpan={HEADERS.length} style={{ ...TD, textAlign: 'center', color: C.t4, padding: 28 }}>No batches in this range.</td></tr>
              ) : null}
              {batches.map((b) => {
                const isOpen = open.has(b.key)
                const status = BATCH_STATUS[b.status]
                return (
                  <Fragment key={b.key}>
                    <tr
                      onClick={() => toggle(b.key)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(b.key) } }}
                      tabIndex={0}
                      aria-expanded={isOpen}
                      style={{ cursor: 'pointer', background: isOpen ? '#fffaf5' : undefined }}
                    >
                      <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 700, color: C.t1 }}>
                        <span style={{ display: 'inline-block', width: 14, color: C.t4 }}>{isOpen ? '▾' : '▸'}</span>
                        {formatPeriod(b.entryDate)}
                      </td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{labelOf(b.department)}</td>
                      <td style={{ ...TD, fontWeight: 800, color: C.t1 }}>{b.batchLabel}</td>
                      <td style={TD}><Side side={b.metalIn} /></td>
                      <td style={TD}><Side side={b.metalOut} /></td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                        {b.loss == null ? <span style={{ color: C.t4 }}>—</span> : (
                          <>
                            <div style={{ fontWeight: 700, color: C.t1 }}>{formatGrams(b.loss)}</div>
                            <div style={{ fontSize: 11, color: C.t4 }}>{formatPct(b.lossPct)}</div>
                          </>
                        )}
                      </td>
                      <td style={{ ...TD, fontWeight: b.timesSent > 2 ? 800 : 400, color: b.timesSent > 2 ? C.orange : C.t1 }}>{b.timesSent}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 12 }}>{formatWhen(b.lastActivityAt)}</td>
                      <td style={TD}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', color: status?.color, background: status?.bg }}>
                          {status?.label || b.status}
                        </span>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr style={{ background: '#fffaf5' }}>
                        <td colSpan={HEADERS.length} style={{ ...TD, paddingTop: 4 }}>
                          <Timeline events={b.events} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}
