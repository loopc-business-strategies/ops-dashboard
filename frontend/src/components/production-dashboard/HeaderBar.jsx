import { formatClock, formatDateLong, formatShiftClock } from './formatters'
import { IconCalendar, IconMarkCube, IconRefresh, IconChevronDown } from './PdIcons'

export default function HeaderBar({
  header,
  lastUpdated,
  connection: _connection,
  hasLiveProduction,
  vaultConnected,
  onRefresh,
  loading,
}) {
  const h = header || {}
  const shiftName = h.shiftName || '—'
  const shiftHint = h.shiftStart || h.shiftEnd
    ? ` (${formatShiftClock(h.shiftStart)} – ${formatShiftClock(h.shiftEnd)})`
    : ''

  const productionConnected = Boolean(hasLiveProduction)
  const vaultOk = Boolean(vaultConnected)

  return (
    <header className="pd-header pd-header--navy pd-header--control">
      <div className="pd-header-brand">
        <span className="pd-header-mark pd-header-mark--cube" aria-hidden>
          <IconMarkCube />
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
        <span className={`pd-conn ${vaultOk ? 'pd-conn--ok' : 'pd-conn--bad'}`}>
          <span className="pd-conn-dot" aria-hidden />
          {vaultOk ? 'Vault connected' : 'Vault not connected'}
        </span>
        <span className={`pd-conn ${productionConnected ? 'pd-conn--ok' : 'pd-conn--bad'}`}>
          <span className="pd-conn-dot" aria-hidden />
          {productionConnected ? 'Production connected' : 'Production not connected'}
        </span>
        <span className="pd-header-chip pd-header-chip--shift" title={`Current shift${shiftHint}`}>
          <span className="pd-shift-label">Shift: {shiftName}</span>
          <IconChevronDown size={14} className="pd-shift-chevron" />
          <select
            className="pd-shift-select"
            value={shiftName}
            disabled
            aria-label="Current shift"
            tabIndex={-1}
          >
            <option value={shiftName}>{shiftName}</option>
          </select>
        </span>
      </div>

      <div className="pd-header-actions">
        {lastUpdated ? (
          <span className="pd-header-meta-light">
            Updated {formatClock(lastUpdated)}
          </span>
        ) : null}
        <button type="button" className="pd-btn pd-btn--refresh" onClick={onRefresh} disabled={loading}>
          <IconRefresh size={14} />
          Refresh
        </button>
      </div>
    </header>
  )
}
