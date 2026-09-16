import { useState } from 'react'
import { formatGrams, formatMinutes, formatPct, formatDelta } from './formatters'

const TABS = [
  { id: 'day', label: 'Today vs Yesterday' },
  { id: 'week', label: 'This Week vs Last Week' },
  { id: 'month', label: 'This Month vs Last Month' },
]

function formatMetricValue(m) {
  if (m.current == null) return '—'
  if (m.isPercent) return formatPct(m.current)
  if (m.key === 'batches') return String(m.current)
  if (m.key === 'avgTime') return formatMinutes(m.current)
  return formatGrams(m.current)
}

export default function TimeComparison({ comparisons }) {
  const [tab, setTab] = useState('day')
  const data = comparisons?.[tab]

  return (
    <section className="pd-panel pd-time-compare" aria-label="Time comparison">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Time Comparison</h2>
        <div className="pd-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pd-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {!data?.available ? (
        <p className="pd-empty">No comparison data</p>
      ) : (
        <div className="pd-compare-grid">
          {(data.metrics || []).filter((m) => m.key !== 'avgTime' || m.current != null).map((m) => {
            const delta = formatDelta(m.delta)
            return (
              <div key={m.key} className="pd-compare-item">
                <span className="pd-kpi-label">{m.label}</span>
                <span className="pd-kpi-value">{formatMetricValue(m)}</span>
                <span className={`pd-delta pd-delta--${delta.tone}`}>{delta.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
