import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkOrdersApi } from './demo/usePccApi'
import { formatTime, statusTone } from './shared'
import { PccEmptyState, PccSkeleton, PccStatusBadge } from './primitives'

const DAY_MS = 86400000

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function buildGanttRows(workOrders) {
  const rows = []
  for (const wo of workOrders || []) {
    const start = toDate(wo.startDate) || toDate(wo.createdAt)
    const end = toDate(wo.targetDate)
    if (!start && !end) continue
    rows.push({
      id: wo._id,
      woNumber: wo.woNumber || 'WO',
      product: wo.product || '',
      status: wo.status || 'pending',
      stage: wo.stage || '',
      progress: Number(wo.progress) || 0,
      start: start || end,
      end: end || start,
      milestone: !end || !start || start.getTime() === end.getTime(),
    })
  }
  return rows.sort((a, b) => a.start - b.start)
}

function buildRange(rows) {
  if (!rows.length) {
    const today = startOfDay(new Date())
    return { rangeStart: today, rangeEnd: new Date(today.getTime() + 7 * DAY_MS), totalMs: 7 * DAY_MS }
  }
  let min = rows[0].start.getTime()
  let max = rows[0].end.getTime()
  for (const row of rows) {
    min = Math.min(min, row.start.getTime(), row.end.getTime())
    max = Math.max(max, row.start.getTime(), row.end.getTime())
  }
  const rangeStart = startOfDay(new Date(min))
  let rangeEnd = startOfDay(new Date(max))
  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    rangeEnd = new Date(rangeStart.getTime() + DAY_MS)
  } else {
    rangeEnd = new Date(rangeEnd.getTime() + DAY_MS)
  }
  const totalMs = Math.max(DAY_MS, rangeEnd.getTime() - rangeStart.getTime())
  return { rangeStart, rangeEnd, totalMs }
}

function dayTicks(rangeStart, rangeEnd) {
  const ticks = []
  for (let t = rangeStart.getTime(); t < rangeEnd.getTime(); t += DAY_MS) {
    ticks.push(new Date(t))
  }
  return ticks.length > 21 ? ticks.filter((_, i) => i % Math.ceil(ticks.length / 14) === 0) : ticks
}

/**
 * Planning / Gantt from real work-order dates (createdAt/startDate → targetDate).
 * No invented schedules — undated WOs are listed separately.
 */
export default function PlanningPanel({ onToast, onOpenWorkOrders }) {
  const workOrdersApi = useWorkOrdersApi()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workOrdersApi.getWorkOrders({ page: 1, limit: 100 })
      setRows(res.workOrders || [])
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load planning')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [workOrdersApi, onToast])

  useEffect(() => { load() }, [load])

  const ganttRows = useMemo(() => buildGanttRows(rows), [rows])
  const undated = useMemo(
    () => rows.filter((wo) => !toDate(wo.startDate) && !toDate(wo.createdAt) && !toDate(wo.targetDate)),
    [rows],
  )
  const { rangeStart, rangeEnd, totalMs } = useMemo(() => buildRange(ganttRows), [ganttRows])
  const ticks = useMemo(() => dayTicks(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  const todayPct = useMemo(() => {
    const now = Date.now()
    if (now < rangeStart.getTime() || now > rangeEnd.getTime()) return null
    return ((now - rangeStart.getTime()) / totalMs) * 100
  }, [rangeStart, rangeEnd, totalMs])

  if (loading) {
    return (
      <div className="pcc-panel">
        <PccSkeleton rows={6} />
      </div>
    )
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>PLANNING</h2>
          <div className="pcc-row-actions">
            <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onOpenWorkOrders?.()}>Work Orders</button>
          </div>
        </div>
        <p className="pcc-muted" style={{ margin: '0 0 12px' }}>
          Schedule bars use each work order&apos;s start (or created) date through its target date.
          {' '}
          {rangeStart.toLocaleDateString()} – {new Date(rangeEnd.getTime() - DAY_MS).toLocaleDateString()}
        </p>

        {ganttRows.length === 0 ? (
          <PccEmptyState message="No work orders with dates to chart. Set target dates on Work Orders." />
        ) : (
          <div className="pcc-gantt">
            <div className="pcc-gantt-axis">
              <div className="pcc-gantt-label-col" />
              <div className="pcc-gantt-track-col">
                {ticks.map((d) => (
                  <span
                    key={d.toISOString()}
                    className="pcc-gantt-tick"
                    style={{ left: `${((d.getTime() - rangeStart.getTime()) / totalMs) * 100}%` }}
                  >
                    {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            </div>

            {ganttRows.map((row) => {
              const left = ((row.start.getTime() - rangeStart.getTime()) / totalMs) * 100
              const width = Math.max(1.2, ((row.end.getTime() - row.start.getTime()) / totalMs) * 100)
              const tone = statusTone(row.status)
              return (
                <div key={row.id} className="pcc-gantt-row">
                  <div className="pcc-gantt-label-col">
                    <strong>{row.woNumber}</strong>
                    <span className="pcc-muted">{row.product || row.stage || '—'}</span>
                    <PccStatusBadge status={row.status} />
                  </div>
                  <div className="pcc-gantt-track-col">
                    {todayPct != null && <div className="pcc-gantt-today" style={{ left: `${todayPct}%` }} />}
                    {row.milestone ? (
                      <div
                        className={`pcc-gantt-milestone tone-${tone}`}
                        style={{ left: `${left}%` }}
                        title={`${row.woNumber}: ${formatTime(row.start)}`}
                      />
                    ) : (
                      <div
                        className={`pcc-gantt-bar tone-${tone}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${row.woNumber}: ${formatTime(row.start)} → ${formatTime(row.end)}`}
                      >
                        <span>{row.progress > 0 ? `${row.progress}%` : row.stage || ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {undated.length > 0 && (
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>UNDATED WORK ORDERS</h2></div>
          <ul className="pcc-list">
            {undated.map((wo) => (
              <li key={wo._id}>
                <strong>{wo.woNumber}</strong>
                <span>{wo.product || wo.stage || '—'}</span>
                <PccStatusBadge status={wo.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
