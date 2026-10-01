import { useCallback, useEffect, useMemo, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './production/loopcProductionDepartments'
import { formatPct, limitEditState, lossTone, parseLossLimitInput } from './lossLimits'
import { OPS_C as C } from './operationsTabTokens'
import { B, SH, StatCard, TableHead, TableWrap, TD, TH } from './operationsTabUI'

const DEPARTMENT_LABELS = Object.fromEntries(LOOPC_PRODUCTION_DEPARTMENTS.map((d) => [d.key, d.label]))
const TONE = {
  over: { color: '#b91c1c', bg: '#fef2f2', label: 'Above limit' },
  near: { color: '#9a3412', bg: '#fff7ed', label: 'Close to limit' },
  ok: { color: '#065f46', bg: 'rgba(0,200,150,.12)', label: 'Within limit' },
}

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback
const limitText = (value) => (value == null ? '' : String(value))

function formatWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Operations › Loss limits: Floor / Production Managers set each department's metal loss warning %. */
export default function TabLossLimits({ showToast }) {
  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const [saving, setSaving] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await mgFloorBatchEntriesApi.lossLimitSettings()
      const list = Array.isArray(res?.departments) ? res.departments : []
      setRows(list)
      setDrafts(Object.fromEntries(list.map((r) => [r.department, limitText(r.lossLimitPct)])))
      setRowErrors({})
      setLoadError('')
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load loss limits'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (row, lossLimitPct) => {
    setSaving(row.department)
    setRowErrors((cur) => ({ ...cur, [row.department]: '' }))
    try {
      const res = await mgFloorBatchEntriesApi.setLossLimit(row.department, lossLimitPct)
      const label = DEPARTMENT_LABELS[row.department] || row.department
      showToast?.(
        'Loss limit saved',
        res.lossLimitPct == null ? `${label}: limit removed` : `${label}: ${formatPct(res.lossLimitPct)}`,
      )
      await load()
    } catch (err) {
      setRowErrors((cur) => ({ ...cur, [row.department]: errorMessage(err, 'Could not save the limit') }))
    } finally {
      setSaving('')
    }
  }

  const onSave = (row) => {
    const edit = limitEditState(drafts[row.department], row.lossLimitPct)
    if (edit === 'clean') return
    if (edit === 'cleared') {
      onRemove(row)
      return
    }
    const parsed = parseLossLimitInput(drafts[row.department])
    if (parsed.error) {
      setRowErrors((cur) => ({ ...cur, [row.department]: parsed.error }))
      return
    }
    save(row, parsed.value)
  }

  const onRemove = (row) => {
    const label = DEPARTMENT_LABELS[row.department] || row.department
    if (window.confirm(`Remove the loss limit for ${label}? Loss will no longer show red there.`)) save(row, null)
    else setDrafts((cur) => ({ ...cur, [row.department]: limitText(row.lossLimitPct) }))
  }

  const summary = useMemo(() => ({
    withLimit: rows.filter((r) => r.lossLimitPct != null).length,
    over: rows.filter((r) => lossTone(r.recent?.avgLossPct, r.lossLimitPct) === 'over').length,
    overBatches: rows.reduce((s, r) => s + (r.recent?.overLimit || 0), 0),
  }), [rows])

  const input = {
    width: 90,
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    color: C.t1,
    background: '#fff',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title="Metal loss limits"
        sub="Loss above this % of Metal In shows red on the tablets, the FM page and the Production Dashboard. Tablets pick up a change within a minute."
      >
        <button type="button" className={B.sec} onClick={() => { setLoading(true); load() }}>Refresh</button>
      </SH>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11 }}>
        <StatCard label="Departments with a limit" value={`${summary.withLimit} / ${rows.length}`} sub="Others never show red" />
        <StatCard
          label="Average above limit"
          value={summary.over}
          sub="Departments, last 30 days"
          dot={summary.over ? '#ef4444' : undefined}
        />
        <StatCard label="Batches above limit" value={summary.overBatches} sub="Last 30 days" />
      </div>

      {loadError ? <div role="alert" style={{ color: C.red, fontSize: 13 }}>{loadError}</div> : null}

      <TableWrap>
        <TableHead title="Limit per department" subtitle={loading ? 'Loading…' : 'Approved batches only'} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {['Department', 'Loss limit', 'Avg loss (30 days)', 'Batches (30 days)', 'Above limit', 'Last changed'].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dept = row.department
                const tone = TONE[lossTone(row.recent?.avgLossPct, row.lossLimitPct)]
                const busy = saving === dept
                const edit = limitEditState(drafts[dept], row.lossLimitPct)
                return (
                  <tr key={dept}>
                    <td style={{ ...TD, fontWeight: 700, color: C.t1 }}>{DEPARTMENT_LABELS[dept] || dept}</td>
                    <td style={TD}>
                      <form
                        style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', minWidth: 200 }}
                        onSubmit={(e) => { e.preventDefault(); onSave(row) }}
                      >
                        <input
                          aria-label={`Loss limit for ${DEPARTMENT_LABELS[dept] || dept}`}
                          inputMode="decimal"
                          placeholder="No limit"
                          value={drafts[dept] ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const value = e.target.value
                            setDrafts((cur) => ({ ...cur, [dept]: value }))
                            setRowErrors((cur) => ({ ...cur, [dept]: '' }))
                          }}
                          style={input}
                        />
                        <span style={{ fontWeight: 700, color: C.t2 }}>%</span>
                        {edit === 'dirty' ? (
                          <button type="submit" className={`${B.pri} ${B.sm}`} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                        ) : null}
                        {row.lossLimitPct != null && edit !== 'dirty' ? (
                          <button type="button" className={`${B.ghost} ${B.sm}`} disabled={busy} onClick={() => onRemove(row)}>
                            Remove
                          </button>
                        ) : null}
                      </form>
                      {rowErrors[dept] ? <div role="alert" style={{ color: '#b91c1c', fontSize: 11.5, marginTop: 4 }}>{rowErrors[dept]}</div> : null}
                    </td>
                    <td style={TD}>
                      {row.recent?.avgLossPct == null ? (
                        <span style={{ color: C.t4 }}>No batches</span>
                      ) : (
                        <span
                          title={tone?.label}
                          style={{
                            fontWeight: 800,
                            padding: tone ? '3px 10px' : 0,
                            borderRadius: 20,
                            color: tone?.color || C.t1,
                            background: tone?.bg || 'transparent',
                          }}
                        >
                          {formatPct(row.recent.avgLossPct)}
                        </span>
                      )}
                    </td>
                    <td style={TD}>{row.recent?.batches ?? 0}</td>
                    <td style={{ ...TD, fontWeight: 700, color: row.recent?.overLimit ? '#b91c1c' : C.t4 }}>
                      {row.recent?.overLimit == null ? '—' : row.recent.overLimit}
                    </td>
                    <td style={{ ...TD, fontSize: 12 }}>
                      {row.lossLimitSetBy ? (
                        <>
                          <div style={{ color: C.t1, fontWeight: 600 }}>{row.lossLimitSetBy}</div>
                          <div style={{ color: C.t4, fontSize: 11 }}>{formatWhen(row.lossLimitSetAt)}</div>
                        </>
                      ) : <span style={{ color: C.t4 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}
