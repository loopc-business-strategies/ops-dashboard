import { formatClock } from './formatters'

function severityClass(tone) {
  const s = String(tone || '').toLowerCase()
  if (s.includes('critical') || s.includes('error') || s.includes('high')) return 'critical'
  if (s.includes('warn') || s.includes('medium') || s.includes('attention')) return 'warning'
  if (s.includes('success') || s.includes('ok')) return 'success'
  if (s.includes('info') || s.includes('low')) return 'info'
  return 'muted'
}

function severityLabel(tone) {
  const s = severityClass(tone)
  if (s === 'critical') return 'Critical'
  if (s === 'warning') return 'Warning'
  if (s === 'success') return 'OK'
  if (s === 'info') return 'Info'
  return 'Alert'
}

export default function AlertsPanel({ alerts }) {
  const list = alerts || []

  return (
    <section className="pd-panel pd-alerts-panel" aria-label="Alerts">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Alerts</h2>
        <span className="pd-alerts-count">{list.length}</span>
      </div>
      {!list.length ? (
        <p className="pd-empty">No open alerts</p>
      ) : (
        <ul className="pd-alerts-list">
          {list.map((a) => {
            const tone = severityClass(a.tone || a.severity)
            return (
              <li key={a.id || a.message} className={`pd-alert-item pd-alert-item--${tone}`}>
                <span className={`pd-alert-severity pd-alert-severity--${tone}`}>
                  {severityLabel(a.tone || a.severity)}
                </span>
                <div className="pd-alert-body">
                  <strong>{a.title || a.message || 'Alert'}</strong>
                  {a.message && a.title && a.message !== a.title ? <p>{a.message}</p> : null}
                  {a.createdAt ? <time>{formatClock(a.createdAt)}</time> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
