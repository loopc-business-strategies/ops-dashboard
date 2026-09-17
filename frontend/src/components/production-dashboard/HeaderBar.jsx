import { formatClock, formatDateLong, pccHref } from './formatters'

export default function HeaderBar({ header, lastUpdated, connection, onRefresh, loading }) {
  const h = header || {}
  return (
    <header className="pd-header">
      <div className="pd-header-main">
        <div className="pd-header-title-row">
          <h1 className="pd-title">Production</h1>
          <span className="pd-header-sep">|</span>
          <span className="pd-header-meta">{h.dateLabel || formatDateLong()}</span>
          <span className="pd-header-sep">|</span>
          <span className={`pd-status-dot pd-status-dot--${h.statusTone === 'ok' ? 'active' : 'muted'}`} aria-hidden />
          <span className="pd-header-meta">{h.status || 'No production activity today'}</span>
        </div>
        <div className="pd-header-facts">
          <span><strong>Shift:</strong> {h.shiftName || '—'}</span>
          <span><strong>Manager:</strong> {h.floorManager || 'Manager not assigned'}</span>
          <span><strong>Employees:</strong> {h.employeeCount != null ? h.employeeCount : '—'}</span>
          <span>
            <strong>Batches:</strong>{' '}
            {h.activeBatches != null
              ? `${h.activeBatches}${h.totalBatches != null ? ` / ${h.totalBatches}` : ''}`
              : '—'}
          </span>
        </div>
      </div>
      <div className="pd-header-actions">
        {lastUpdated ? (
          <span className="pd-muted">Updated {formatClock(lastUpdated)} · {connection}</span>
        ) : null}
        <a className="pd-btn pd-btn--ghost" href={pccHref('batches')}>View All Batches</a>
        <a className="pd-btn pd-btn--ghost" href={pccHref('batches')}>New Batch</a>
        <button type="button" className="pd-btn pd-btn--primary" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>
    </header>
  )
}
