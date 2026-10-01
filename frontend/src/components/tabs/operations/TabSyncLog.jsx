import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './production/loopcProductionDepartments'
import { historyPresets } from './batchHistory'
import { formatGrams } from './floorBatchCheck'
import { formatPeriod } from './lossReport'
import { formatDelay, shortDevice, syncItemKind, syncStatusPill } from './syncLog'
import { OPS_C as C } from './operationsTabTokens'
import { B, SH, StatCard, TableHead, TableWrap, TD, TH } from './operationsTabUI'

const DEPARTMENT_LABELS = Object.fromEntries(LOOPC_PRODUCTION_DEPARTMENTS.map((d) => [d.key, d.label]))
const labelOf = (key) => DEPARTMENT_LABELS[key] || key || '—'
const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback
const HEADERS = ['Saved on tablet', 'Reached server', 'Delay', 'Operator', 'Department', 'Batch', 'Weight', 'Status', 'Tablet']
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'synced', label: 'Received' },
  { id: 'problem', label: 'Problems' },
]
const NONE = <span style={{ color: C.t4 }}>—</span>

function formatWhen(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Row({ item }) {
  const pill = syncStatusPill(item)
  return (
    <tr style={pill.problem ? { background: '#fef2f2' } : undefined}>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{formatWhen(item.savedAt) || NONE}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
        {formatWhen(item.syncedAt) || (
          <span style={{ color: C.red, fontSize: 12 }}>Not received{item.firstTriedAt ? ` · tried ${formatWhen(item.firstTriedAt)}` : ''}</span>
        )}
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: item.late ? 800 : 400, color: item.late ? C.orange : C.t1 }}>
        {formatDelay(item.delayMinutes)}
        {item.arrivedLaterDay ? <div style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>Arrived on a later day</div> : null}
      </td>
      <td style={{ ...TD, fontWeight: 700, color: C.t1, whiteSpace: 'nowrap' }}>{item.operator || NONE}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{labelOf(item.department)}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 800, color: C.t1 }}>{item.batchLabel ? `${syncItemKind(item)} · ${item.batchLabel}` : syncItemKind(item)}</div>
        {item.entryDate ? <div style={{ fontSize: 11, color: C.t4 }}>For {formatPeriod(item.entryDate)}</div> : null}
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{item.weight ? formatGrams(item.weight) : NONE}</td>
      <td style={TD}>
        <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', color: pill.color, background: pill.bg }}>
          {pill.label}
        </span>
        {item.errorMessage && pill.problem ? <div style={{ fontSize: 11.5, color: C.red, marginTop: 4, maxWidth: 260 }}>{item.errorMessage}</div> : null}
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 12 }} title={item.deviceId || undefined}>
        {shortDevice(item.deviceId)}
        {item.appVersion ? <div style={{ fontSize: 11, color: C.t4 }}>App {item.appVersion}</div> : null}
      </td>
    </tr>
  )
}

/** Operations › Offline sync: batches the tablets saved without a connection and sent later. */
export default function TabSyncLog() {
  const presets = useMemo(() => historyPresets(), [])
  const [range, setRange] = useState({ from: presets[2].from, to: presets[2].to })
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    try {
      const res = await mgFloorBatchEntriesApi.syncLog({ ...range, department, status })
      if (request !== requestRef.current) return
      setData(res)
      setLoadError('')
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(errorMessage(err, 'Could not load the offline sync log'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [range, department, status])

  useEffect(() => {
    load()
    return () => { requestRef.current += 1 }
  }, [load])

  const items = data?.items || []
  const summary = data?.summary
  const lateMinutes = data?.lateMinutes ?? 60

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
        title="Offline sync"
        sub={`Batches a tablet saved without a connection (or when sending failed) and sent later. Late = reached the server more than ${formatDelay(lateMinutes)} after it was saved. Red rows never reached the server — check that tablet.`}
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
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUS_FILTERS.map((s) => (
            <button key={s.id} type="button" style={pill(status === s.id)} aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>{s.label}</button>
          ))}
        </div>
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
      </div>

      {loadError ? <div role="alert" style={{ color: C.red, fontSize: 13 }}>{loadError}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 11 }}>
        <StatCard label="Sent offline" value={summary?.total ?? 0} sub={`${summary?.synced ?? 0} received`} />
        <StatCard
          label="Not received"
          value={summary?.problems ?? 0}
          sub={summary?.problems ? 'Failed or stuck — red rows below' : 'Nothing stuck'}
          dot={summary?.problems ? '#ef4444' : undefined}
        />
        <StatCard
          label="Late"
          value={summary?.late ?? 0}
          sub={summary?.arrivedLaterDay ? `${summary.arrivedLaterDay} arrived on a later day` : `More than ${formatDelay(lateMinutes)} after saving`}
          dot={summary?.late ? '#f97316' : undefined}
        />
        <StatCard
          label="Longest delay"
          value={formatDelay(summary?.maxDelayMinutes)}
          sub={summary?.avgDelayMinutes != null ? `Average ${formatDelay(summary.avgDelayMinutes)}` : 'No received batches'}
        />
      </div>

      <TableWrap>
        <TableHead
          title="Offline batches"
          subtitle={loading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'} · saved ${formatPeriod(range.from)} – ${formatPeriod(range.to)} · newest first`}
        />
        {data?.truncated ? (
          <div role="status" style={{ padding: '10px 18px', background: '#fff7ed', color: C.orange, fontSize: 13, fontWeight: 700 }}>
            Too many items in this range — only the newest are shown. Pick a shorter range or a department.
          </div>
        ) : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead><tr>{HEADERS.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !items.length ? (
                <tr><td colSpan={HEADERS.length} style={{ ...TD, textAlign: 'center', color: C.t4, padding: 28 }}>No offline batches in this range — every batch was sent straight away.</td></tr>
              ) : null}
              {items.map((item) => <Row key={item.operationId} item={item} />)}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}
