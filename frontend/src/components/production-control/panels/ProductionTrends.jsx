import { useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { PccEmptyState, PccSkeleton } from '../primitives'

function dayKeys(count = 7) {
  const keys = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    keys.push(d.toISOString().slice(0, 10))
  }
  return keys
}

/**
 * 7-day production trend from existing reportDaily API.
 * Hidden entirely when the API is unavailable (e.g. missing viewReports).
 */
export default function ProductionTrends({ onNavigate }) {
  const pccApi = usePccApi()
  const [points, setPoints] = useState(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const keys = dayKeys(7)
    Promise.all(
      keys.map((date) =>
        pccApi.reportDaily({ date })
          .then((data) => {
            const report = data?.report || data || {}
            const summary = report.summary || {}
            return {
              date,
              jobs: Number(summary.jobs) || 0,
              completed: Number(summary.completed) || 0,
            }
          })
          .catch((err) => {
            const status = err?.response?.status
            if (status === 401 || status === 403) throw Object.assign(new Error('denied'), { denied: true })
            return { date, jobs: 0, completed: 0, failed: true }
          }),
      ),
    )
      .then((rows) => {
        if (cancelled) return
        setPoints(rows)
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })
    return () => { cancelled = true }
  }, [pccApi])

  if (unavailable) return null
  if (!points) {
    return (
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>7-DAY TREND</h2></div>
        <PccSkeleton rows={2} />
      </div>
    )
  }

  const maxJobs = Math.max(1, ...points.map((p) => p.jobs))
  const hasAny = points.some((p) => p.jobs > 0 || p.completed > 0)

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head">
        <h2>7-DAY TREND</h2>
        <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('reports')}>
          Reports
        </button>
      </div>
      {!hasAny ? (
        <PccEmptyState message="No daily production activity in the last 7 days." />
      ) : (
        <div className="pcc-trend">
          {points.map((p) => (
            <div key={p.date} className="pcc-trend-col" title={`${p.date}: ${p.completed}/${p.jobs} completed`}>
              <div className="pcc-trend-bars">
                <div
                  className="pcc-trend-bar jobs"
                  style={{ height: `${Math.max(4, (p.jobs / maxJobs) * 100)}%` }}
                />
                <div
                  className="pcc-trend-bar done"
                  style={{ height: `${Math.max(p.completed ? 4 : 0, (p.completed / maxJobs) * 100)}%` }}
                />
              </div>
              <span className="pcc-trend-label">
                {new Date(`${p.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="pcc-trend-value">{p.completed}/{p.jobs}</span>
            </div>
          ))}
        </div>
      )}
      <p className="pcc-muted" style={{ margin: '8px 0 0', fontSize: 11 }}>
        Jobs vs completed from Daily Production reports (not projections).
      </p>
    </div>
  )
}
