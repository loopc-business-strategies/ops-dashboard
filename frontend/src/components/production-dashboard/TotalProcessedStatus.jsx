import { useState } from 'react'
import { formatGrams } from './formatters'

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
]

export default function TotalProcessedStatus({ totalsByPeriod, statusSummary }) {
  const [period, setPeriod] = useState('today')
  const totals = totalsByPeriod?.[period]
  const status = statusSummary || {}

  return (
    <section className="pd-panel pd-totals" aria-label="Total processed and status">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Total Processed / Status</h2>
        <div className="pd-tabs" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={`pd-tab${period === p.id ? ' is-active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!totals ? (
        <p className="pd-empty">No production data</p>
      ) : (
        <div className="pd-totals-grid">
          <div>
            <span className="pd-kpi-label">Quantity / Weight In</span>
            <span className="pd-kpi-value">{totals.weightIn != null ? formatGrams(totals.weightIn) : '—'}</span>
          </div>
          <div>
            <span className="pd-kpi-label">Weight</span>
            <span className="pd-kpi-value">{totals.weightOut != null ? formatGrams(totals.weightOut) : '—'}</span>
          </div>
          <div>
            <span className="pd-kpi-label">Batches</span>
            <span className="pd-kpi-value">{totals.jobs != null ? totals.jobs : '—'}</span>
          </div>
          <div>
            <span className="pd-kpi-label">Completed</span>
            <span className="pd-kpi-value">{totals.completed != null ? totals.completed : '—'}</span>
          </div>
          <div>
            <span className="pd-kpi-label">Active / Pending</span>
            <span className="pd-kpi-value">{totals.pending != null ? totals.pending : '—'}</span>
          </div>
        </div>
      )}

      <div className="pd-status-counts">
        <div><span className="pd-kpi-label">Active</span><strong>{status.active ?? 0}</strong></div>
        <div><span className="pd-kpi-label">Completed</span><strong>{status.completed ?? 0}</strong></div>
        <div><span className="pd-kpi-label">Pending</span><strong>{status.pending ?? 0}</strong></div>
        <div><span className="pd-kpi-label">Delayed</span><strong>{status.delayed ?? 0}</strong></div>
        <div><span className="pd-kpi-label">Stopped</span><strong>{status.stopped ?? 0}</strong></div>
      </div>
    </section>
  )
}
