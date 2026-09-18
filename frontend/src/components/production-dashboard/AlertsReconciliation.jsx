import { formatGrams } from './formatters'
import { AlertIcon } from './PdIcons'

function severityClass(tone) {
  const s = String(tone || '').toLowerCase()
  if (s.includes('critical') || s.includes('error') || s.includes('high')) return 'critical'
  if (s.includes('warn') || s.includes('medium') || s.includes('attention')) return 'warning'
  return 'info'
}

export default function AlertsReconciliation({
  reconciliationRows = [],
  mismatchAlerts = [],
  alerts = [],
  onAcknowledge,
  onResolve,
  canResolve,
}) {
  return (
    <section className="pd-panel pd-alerts-recon" aria-label="Alerts and reconciliation">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Alerts & Reconciliation</h2>
      </div>

      <div className="pd-table-wrap pd-table-wrap--compact">
        <table className="pd-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>System</th>
              <th>Physical</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {(reconciliationRows || []).map((row) => (
              <tr key={row.key} className={row.flagged ? 'pd-row--warn' : ''}>
                <td>{row.department}</td>
                <td>{row.system != null ? formatGrams(row.system) : '—'}</td>
                <td>{row.physical != null ? formatGrams(row.physical) : '—'}</td>
                <td className={row.flagged ? 'pd-text-bad' : ''}>
                  {row.diff != null ? `${row.diff > 0 ? '+' : ''}${Number(row.diff).toFixed(3)} g` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(mismatchAlerts || []).slice(0, 3).map((m) => (
        <div key={m.id} className="pd-mismatch-card" role="alert">
          <strong>Weight Mismatch Alert</strong>
          <p>{m.message}</p>
        </div>
      ))}

      <ul className="pd-alerts-list pd-alerts-list--compact">
        {(alerts || []).slice(0, 6).map((a) => {
          const tone = severityClass(a.tone)
          return (
            <li key={a.id} className={`pd-alert-item pd-alert-item--${tone}`}>
              <span className="pd-alert-icon" aria-hidden>
                <AlertIcon tone={tone} />
              </span>
              <div className="pd-alert-body">
                <strong>{a.title}</strong>
                {a.message && a.message !== a.title ? <p>{a.message}</p> : null}
                {canResolve ? (
                  <div className="pd-alert-actions">
                    <button type="button" className="pd-btn pd-btn--sm" onClick={() => onAcknowledge?.(a.id)}>
                      Ack
                    </button>
                    <button type="button" className="pd-btn pd-btn--sm pd-btn--primary" onClick={() => onResolve?.(a.id)}>
                      Resolve
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {!alerts?.length && !mismatchAlerts?.length ? (
        <p className="pd-empty">No open alerts</p>
      ) : null}
    </section>
  )
}
