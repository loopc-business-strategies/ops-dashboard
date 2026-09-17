import { formatClock, formatDateLong, formatShiftClock, pccHref } from './formatters'
import { IconCalendar, IconMark } from './PdIcons'

export default function HeaderBar({ header, lastUpdated, connection, onRefresh, loading }) {
  const h = header || {}
  const shiftLabel = h.shiftName
    ? `${h.shiftName}${h.shiftStart || h.shiftEnd ? ` (${formatShiftClock(h.shiftStart)} – ${formatShiftClock(h.shiftEnd)})` : ''}`
    : '—'

  return (
    <header className="pd-header pd-header--navy">
      <div className="pd-header-brand">
        <span className="pd-header-mark" aria-hidden>
          <IconMark />
        </span>
        <div>
          <h1 className="pd-title">{h.title || 'PRODUCTION CONTROL CENTER'}</h1>
          <p className="pd-header-sub">{h.subtitle || 'Jewelry & Precious Metal Manufacturing'}</p>
        </div>
      </div>

      <div className="pd-header-center">
        <span className="pd-header-chip">
          <IconCalendar size={14} />
          {h.dateLabel || formatDateLong()}
          {h.timeLabel ? ` | ${h.timeLabel}` : ''}
        </span>
        <span className={`pd-factory-status pd-factory-status--${h.statusTone || 'muted'}`}>
          <span className="pd-factory-pulse" aria-hidden />
          {h.status || 'No production activity today'}
        </span>
        <span className="pd-header-chip pd-header-chip--shift" title="Current shift">
          Shift: {shiftLabel}
        </span>
      </div>

      <div className="pd-header-actions">
        {lastUpdated ? (
          <span className="pd-header-meta-light">
            Updated {formatClock(lastUpdated)} · {connection}
          </span>
        ) : null}
        {h.floorManager ? (
          <span className="pd-header-avatar" title={h.floorManager}>
            {String(h.floorManager).slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <span className="pd-header-avatar pd-header-avatar--muted" title="Manager not assigned">—</span>
        )}
        <a className="pd-btn pd-btn--ghost-light" href={pccHref('batches')}>Open PCC</a>
        <button type="button" className="pd-btn pd-btn--primary" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>
    </header>
  )
}
