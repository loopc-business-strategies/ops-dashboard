import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { downloadCsv, downloadXlsxSheets, printStatementHtml } from '../erp/exportHelpers'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './production/loopcProductionDepartments'
import { formatGrams } from './floorBatchCheck'
import { formatPct } from './lossLimits'
import { formatDowntime, formatPeriod, monthEnd, operatorName, reportPresets, reportPrintHtml, reportSheets } from './lossReport'
import { OPS_C as C } from './operationsTabTokens'
import { B, SH, StatCard, TableHead, TableWrap, TD, TH } from './operationsTabUI'

const DEPARTMENT_LABELS = Object.fromEntries(LOOPC_PRODUCTION_DEPARTMENTS.map((d) => [d.key, d.label]))
const labelOf = (key) => DEPARTMENT_LABELS[key] || key
const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback
const OVER = { background: '#fef2f2' }
const NUM = { ...TD, whiteSpace: 'nowrap' }

/** showLimit=false (per-operator summary): no single limit, but still count each batch against its own department's limit. */
function Cells({ r, limit, showLimit = true, showBreakdowns = true }) {
  const none = <span style={{ color: C.t4 }}>—</span>
  const countOver = r.batches && (!showLimit || limit != null)
  return (
    <>
      <td style={NUM}>{r.batches || none}</td>
      <td style={NUM}>{r.batches ? formatGrams(r.metalIn) : none}</td>
      <td style={NUM}>{r.batches ? formatGrams(r.metalOut) : none}</td>
      <td style={{ ...NUM, fontWeight: 700, color: r.overLimit ? C.red : C.t1 }}>{r.batches ? formatGrams(r.loss) : none}</td>
      <td style={{ ...NUM, fontWeight: 800, color: r.overLimit ? C.red : C.t1 }}>
        {r.lossPct == null ? none : formatPct(r.lossPct)}
      </td>
      {showLimit ? <td style={NUM}>{limit == null ? none : formatPct(limit)}</td> : null}
      <td style={{ ...NUM, fontWeight: 700, color: r.overLimitBatches ? C.red : C.t4 }}>
        {countOver ? r.overLimitBatches : '—'}
      </td>
      <td style={{ ...NUM, color: r.fineLoss < 0 ? C.red : C.t1 }}>
        {r.fineLoss == null ? none : formatGrams(r.fineLoss)}
        {r.fineLoss < 0 ? <div style={{ fontSize: 11, fontWeight: 700 }}>Out more than in — check purity</div> : null}
      </td>
      {showBreakdowns ? <BreakdownCells r={r} none={none} /> : null}
    </>
  )
}

function BreakdownCells({ r, none }) {
  return (
    <>
      <td style={NUM}>
        {r.breakdowns ? (
          <>
            {r.breakdowns}
            {r.breakdownsNotFixed ? <div style={{ fontSize: 11, color: C.orange }}>{r.breakdownsNotFixed} not fixed</div> : null}
          </>
        ) : none}
      </td>
      <td style={NUM}>{r.downtimeMinutes ? formatDowntime(r.downtimeMinutes) : none}</td>
    </>
  )
}

const METAL_COLUMNS = ['Batches', 'Metal In', 'Metal Out', 'Loss', 'Loss %']
const COLUMNS = [...METAL_COLUMNS, 'Limit', 'Batches above limit', 'Fine gold loss', 'Breakdowns', 'Downtime']
const OPERATOR_SUMMARY_COLUMNS = ['Operator', 'Departments', ...METAL_COLUMNS, 'Batches above limit', 'Fine gold loss']
const OPERATOR_DETAIL_COLUMNS = ['Operator', 'Department', ...METAL_COLUMNS, 'Limit', 'Batches above limit', 'Fine gold loss']
const NOT_RECORDED = { fontStyle: 'italic', color: C.t4 }

/** Operations › Loss report: metal loss per department per day or month, with downloads and print. */
export default function TabLossReport({ showToast }) {
  const presets = useMemo(() => reportPresets(), [])
  const [range, setRange] = useState({ groupBy: 'day', from: presets[0].from, to: presets[0].to })
  const [department, setDepartment] = useState('')
  const [view, setView] = useState('department')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    try {
      const res = await mgFloorBatchEntriesApi.lossReport({ ...range, department, view })
      if (request !== requestRef.current) return
      setData(res)
      setLoadError('')
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(errorMessage(err, 'Could not load the loss report'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [range, department, view])

  useEffect(() => {
    load()
    return () => { requestRef.current += 1 }
  }, [load])

  const byMonth = range.groupBy === 'month'
  const byOperator = data?.view === 'operator'
  const departmentLabel = department ? labelOf(department) : 'All departments'
  const fileBase = `metal-loss-${range.from}-to-${range.to}${department ? `-${department}` : ''}${byOperator ? '-by-operator' : ''}`
  const limits = data?.limits || {}
  const total = data?.total
  const overPeriods = (data?.rows || []).filter((r) => r.overLimit).length
  const topOperator = byOperator ? (data?.byOperator || []).find((o) => o.loss > 0) : null

  const setGroupBy = (groupBy) => {
    if (groupBy === range.groupBy) return
    setRange((cur) => (groupBy === 'month'
      ? { groupBy, from: `${cur.from.slice(0, 7)}-01`, to: monthEnd(cur.to.slice(0, 7)) }
      : { ...cur, groupBy }))
  }

  const download = async (kind) => {
    if (!data) return
    const { summary, detail } = reportSheets(data, labelOf)
    try {
      if (kind === 'xlsx') {
        await downloadXlsxSheets([
          { rows: summary, sheetName: byOperator ? 'Per operator' : 'Per department' },
          { rows: detail, sheetName: byMonth ? 'By month' : 'By day' },
        ], `${fileBase}.xlsx`)
      } else if (kind === 'csv') {
        downloadCsv(detail, `${fileBase}.csv`)
      } else {
        await printStatementHtml(reportPrintHtml(data, { labelOf, departmentLabel }))
      }
    } catch (err) {
      showToast?.('Could not export', errorMessage(err, kind === 'print' ? 'Allow pop-ups to print' : 'Export failed'))
    }
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title="Metal loss report"
        sub={view === 'operator'
          ? "Finished batches (Metal In and Metal Out approved) from Operations → Production. Loss counts against the operator who sent Metal Out. Red = above the department's current loss limit."
          : "Finished batches (Metal In and Metal Out approved) from Operations → Production, per department. Red = above the department's current loss limit. Downtime counts from a tablet breakdown report until it is marked fixed."}
      >
        <button type="button" className={B.sec} onClick={() => download('xlsx')} disabled={!data}>Excel</button>
        <button type="button" className={B.sec} onClick={() => download('csv')} disabled={!data}>CSV</button>
        <button type="button" className={B.sec} onClick={() => download('print')} disabled={!data}>Print</button>
      </SH>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {presets.map((p) => {
          const active = p.groupBy === range.groupBy && p.from === range.from && p.to === range.to
          return (
            <button key={p.id} type="button" style={pill(active)} onClick={() => setRange({ groupBy: p.groupBy, from: p.from, to: p.to })}>
              {p.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={pill(view === 'department')} aria-pressed={view === 'department'} onClick={() => setView('department')}>By department</button>
          <button type="button" style={pill(view === 'operator')} aria-pressed={view === 'operator'} onClick={() => setView('operator')}>By operator</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={pill(!byMonth)} onClick={() => setGroupBy('day')}>By day</button>
          <button type="button" style={pill(byMonth)} onClick={() => setGroupBy('month')}>By month</button>
        </div>
        <label style={{ fontSize: 12, color: C.t3, display: 'flex', flexDirection: 'column', gap: 4 }}>
          From
          {byMonth ? (
            <input type="month" style={control} value={range.from.slice(0, 7)} onChange={(e) => e.target.value && setRange((c) => ({ ...c, from: `${e.target.value}-01` }))} />
          ) : (
            <input type="date" style={control} value={range.from} onChange={(e) => e.target.value && setRange((c) => ({ ...c, from: e.target.value }))} />
          )}
        </label>
        <label style={{ fontSize: 12, color: C.t3, display: 'flex', flexDirection: 'column', gap: 4 }}>
          To
          {byMonth ? (
            <input type="month" style={control} value={range.to.slice(0, 7)} onChange={(e) => e.target.value && setRange((c) => ({ ...c, to: monthEnd(e.target.value) }))} />
          ) : (
            <input type="date" style={control} value={range.to} onChange={(e) => e.target.value && setRange((c) => ({ ...c, to: e.target.value }))} />
          )}
        </label>
        <label style={{ fontSize: 12, color: C.t3, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Department
          <select style={control} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {LOOPC_PRODUCTION_DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
      </div>

      {loadError ? <div role="alert" style={{ color: C.red, fontSize: 13 }}>{loadError}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 11 }}>
        <StatCard
          label="Total loss"
          value={total?.batches ? formatGrams(total.loss) : '—'}
          sub={total?.lossPct != null ? `${formatPct(total.lossPct)} of ${formatGrams(total.metalIn)} in` : 'No finished batches'}
        />
        <StatCard label="Finished batches" value={total?.batches ?? 0} sub={departmentLabel} />
        <StatCard
          label={byMonth ? 'Months above limit' : 'Days above limit'}
          value={overPeriods}
          sub={byOperator ? 'Operator rows in red below' : 'Department rows in red below'}
          dot={overPeriods ? '#ef4444' : undefined}
        />
        {byOperator ? (
          <StatCard
            label="Most loss"
            value={topOperator ? operatorName(topOperator.operator) : '—'}
            sub={topOperator
              ? `${formatGrams(topOperator.loss)}${topOperator.lossPct != null ? ` · ${formatPct(topOperator.lossPct)}` : ''} · ${topOperator.batches} batch${topOperator.batches === 1 ? '' : 'es'}`
              : 'No loss in this range'}
          />
        ) : (
          <StatCard
            label="Breakdown downtime"
            value={formatDowntime(total?.downtimeMinutes)}
            sub={total?.breakdowns
              ? `${total.breakdowns} breakdown${total.breakdowns === 1 ? '' : 's'}${total.breakdownsNotFixed ? ` · ${total.breakdownsNotFixed} not fixed` : ''}`
              : 'No breakdowns'}
            dot={total?.breakdownsNotFixed ? '#f97316' : undefined}
          />
        )}
      </div>

      {byOperator ? (
        <OperatorTables data={data} loading={loading} byMonth={byMonth} range={range} limits={limits} />
      ) : (
        <DepartmentTables data={data} loading={loading} byMonth={byMonth} range={range} limits={limits} />
      )}
    </div>
  )
}

function OperatorTables({ data, loading, byMonth, range, limits }) {
  const total = data?.total
  const name = (operator) => (operator ? operator : <span style={NOT_RECORDED}>{operatorName(operator)}</span>)
  return (
    <>
      <TableWrap>
        <TableHead title="Per operator" subtitle={loading ? 'Loading…' : `${formatPeriod(range.from)} – ${formatPeriod(range.to)} · most loss first`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{OPERATOR_SUMMARY_COLUMNS.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !data?.byOperator?.length ? (
                <tr><td colSpan={OPERATOR_SUMMARY_COLUMNS.length} style={{ ...NUM, textAlign: 'center', color: C.t4, padding: 28 }}>No finished batches in this range.</td></tr>
              ) : null}
              {(data?.byOperator || []).map((r) => (
                <tr key={r.operator || '-'}>
                  <td style={{ ...NUM, fontWeight: 700, color: C.t1 }}>{name(r.operator)}</td>
                  <td style={TD}>{(r.departments || []).map(labelOf).join(', ')}</td>
                  <Cells r={r} showLimit={false} showBreakdowns={false} />
                </tr>
              ))}
              {data?.byOperator?.length > 1 && total ? (
                <tr style={{ background: '#fff7ed' }}>
                  <td style={{ ...NUM, fontWeight: 800, color: C.t1 }}>All operators</td>
                  <td style={TD} />
                  <Cells r={total} showLimit={false} showBreakdowns={false} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title={byMonth ? 'By month' : 'By day'} subtitle={loading ? 'Loading…' : `${data?.rows?.length || 0} row${data?.rows?.length === 1 ? '' : 's'}`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead><tr>{[byMonth ? 'Month' : 'Day', ...OPERATOR_DETAIL_COLUMNS].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !data?.rows?.length ? (
                <tr><td colSpan={OPERATOR_DETAIL_COLUMNS.length + 1} style={{ ...NUM, textAlign: 'center', color: C.t4, padding: 28 }}>Nothing in this range.</td></tr>
              ) : null}
              {(data?.rows || []).map((r) => (
                <tr key={`${r.period}|${r.operator}|${r.department}`} style={r.overLimit ? OVER : undefined}>
                  <td style={{ ...NUM, fontWeight: 700, color: C.t1 }}>{formatPeriod(r.period)}</td>
                  <td style={NUM}>{name(r.operator)}</td>
                  <td style={NUM}>{labelOf(r.department)}</td>
                  <Cells r={r} limit={limits[r.department] ?? null} showBreakdowns={false} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </>
  )
}

function DepartmentTables({ data, loading, byMonth, range, limits }) {
  const total = data?.total
  return (
    <>
      <TableWrap>
        <TableHead title="Per department" subtitle={loading ? 'Loading…' : `${formatPeriod(range.from)} – ${formatPeriod(range.to)}`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead><tr>{['Department', ...COLUMNS].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !data?.byDepartment?.length ? (
                <tr><td colSpan={COLUMNS.length + 1} style={{ ...NUM, textAlign: 'center', color: C.t4, padding: 28 }}>No finished batches or breakdowns in this range.</td></tr>
              ) : null}
              {(data?.byDepartment || []).map((r) => (
                <tr key={r.department} style={r.overLimit ? OVER : undefined}>
                  <td style={{ ...NUM, fontWeight: 700, color: C.t1 }}>{labelOf(r.department)}</td>
                  <Cells r={r} limit={limits[r.department] ?? null} />
                </tr>
              ))}
              {data?.byDepartment?.length > 1 && total ? (
                <tr style={{ background: '#fff7ed' }}>
                  <td style={{ ...NUM, fontWeight: 800, color: C.t1 }}>All departments</td>
                  <Cells r={total} limit={null} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title={byMonth ? 'By month' : 'By day'} subtitle={loading ? 'Loading…' : `${data?.rows?.length || 0} row${data?.rows?.length === 1 ? '' : 's'}`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead><tr>{[byMonth ? 'Month' : 'Day', 'Department', ...COLUMNS].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && !data?.rows?.length ? (
                <tr><td colSpan={COLUMNS.length + 2} style={{ ...NUM, textAlign: 'center', color: C.t4, padding: 28 }}>Nothing in this range.</td></tr>
              ) : null}
              {(data?.rows || []).map((r) => (
                <tr key={`${r.period}|${r.department}`} style={r.overLimit ? OVER : undefined}>
                  <td style={{ ...NUM, fontWeight: 700, color: C.t1, whiteSpace: 'nowrap' }}>{formatPeriod(r.period)}</td>
                  <td style={NUM}>{labelOf(r.department)}</td>
                  <Cells r={r} limit={limits[r.department] ?? null} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </>
  )
}
