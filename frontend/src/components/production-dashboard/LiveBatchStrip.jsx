import { formatGrams, formatMinutes, formatClock, formatPct, pccHref } from './formatters'

function ProgressBar({ progress }) {
  const mode = progress?.mode || 'indeterminate'
  const pct = progress?.percent
  const warn = progress?.warn
  const error = progress?.error
  const trackCls = [
    'pd-load-track',
    warn ? 'pd-load-track--warn' : '',
    error ? 'pd-load-track--error' : '',
  ].filter(Boolean).join(' ')
  const barCls = [
    'pd-load-fill',
    mode === 'indeterminate' ? 'pd-load-fill--indet' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="pd-load" aria-label="Progress">
      <div className={trackCls}>
        <div
          className={barCls}
          style={mode === 'determinate' && pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <span className="pd-load-label">
        {mode === 'determinate' && pct != null ? `${pct}%` : (error ? 'Stopped' : warn ? 'Delayed' : 'In progress')}
      </span>
    </div>
  )
}

function LiveCard({ card }) {
  const statusClass = String(card.status || '').toLowerCase().replace(/\s+/g, '-')
  return (
    <article className={`pd-live-card pd-live-card--${statusClass}${card.isMelting ? ' pd-live-card--melting' : ''}`}>
      <div className="pd-live-card-head">
        <h3 className="pd-live-card-title">{card.name}</h3>
        <span className={`pd-badge pd-badge--${statusClass}`}>{card.status}</span>
      </div>
      <div className="pd-live-grid">
        <div>
          <span className="pd-kpi-label">Batch</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{card.batchNumber || 'No active batches'}</span>
        </div>
        <div>
          <span className="pd-kpi-label">Employee</span>
          <span className="pd-kpi-value pd-kpi-value--sm">
            {card.employeeCode || card.employeeName
              ? [card.employeeCode, card.employeeName].filter(Boolean).join(' · ')
              : 'Employee not assigned'}
          </span>
        </div>
        <div>
          <span className="pd-kpi-label">Floor Manager</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{card.floorManager || 'Manager not assigned'}</span>
        </div>
        <div>
          <span className="pd-kpi-label">Shift</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{card.shiftName || '—'}</span>
        </div>
        <div>
          <span className="pd-kpi-label">Start</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{card.startedAt ? formatClock(card.startedAt) : '—'}</span>
        </div>
        <div>
          <span className="pd-kpi-label">{card.completedAt ? 'End' : 'Elapsed'}</span>
          <span className="pd-kpi-value pd-kpi-value--sm">
            {card.completedAt
              ? formatClock(card.completedAt)
              : (card.elapsedMin != null ? formatMinutes(card.elapsedMin) : '—')}
          </span>
        </div>
      </div>

      {card.isMelting ? (
        <div className="pd-metal-mini">
          <div><span className="pd-kpi-label">Metal IN</span><strong>{card.metalIn != null ? formatGrams(card.metalIn) : 'Weight pending'}</strong></div>
          <div><span className="pd-kpi-label">Metal OUT</span><strong>{card.metalOut != null ? formatGrams(card.metalOut) : 'Weight pending'}</strong></div>
          <div><span className="pd-kpi-label">Loss</span><strong>{card.metalLoss != null ? formatGrams(card.metalLoss) : '—'}</strong></div>
          <div><span className="pd-kpi-label">Loss %</span><strong>{card.lossPct != null ? formatPct(card.lossPct, 1) : '—'}</strong></div>
          {card.confirmState ? <span className="pd-badge pd-badge--confirm">{card.confirmState}</span> : null}
        </div>
      ) : null}

      <ProgressBar progress={card.progress} />

      {card.batchId ? (
        <a className="pd-link" href={pccHref('batches', { batch: card.batchId })}>Open Batch</a>
      ) : null}
    </article>
  )
}

export default function LiveBatchStrip({ cards }) {
  const list = cards || []
  return (
    <section className="pd-panel pd-live-strip" aria-label="Live production">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Live Production / Active Batches</h2>
        <a className="pd-link" href={pccHref('passes')}>Metal Control</a>
      </div>
      {!list.length ? (
        <p className="pd-empty">No active batches</p>
      ) : (
        <div className="pd-live-scroll">
          {list.map((card) => (
            <LiveCard key={card.key} card={card} />
          ))}
        </div>
      )}
    </section>
  )
}
