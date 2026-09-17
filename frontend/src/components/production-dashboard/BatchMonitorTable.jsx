import { formatClock, formatGrams, formatMinutes } from './formatters'

function statusClass(status) {
  return String(status || 'Idle').toLowerCase().replace(/\s+/g, '-')
}

function progressPct(progress) {
  if (progress == null) return 0
  if (typeof progress === 'number') return Math.max(0, Math.min(100, progress))
  const n = Number(progress?.percent ?? progress?.pct ?? progress?.value)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
}

export default function BatchMonitorTable({ rows }) {
  const list = rows || []

  return (
    <section className="pd-panel pd-batch-monitor" aria-label="Batch monitor">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Batch Monitor</h2>
      </div>
      {!list.length ? (
        <p className="pd-empty">No active batches</p>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table pd-batch-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Department</th>
                <th>Qty In</th>
                <th>Qty Out</th>
                <th>Employee</th>
                <th>Start</th>
                <th>Duration</th>
                <th>Metal Loss</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const tone = statusClass(row.status)
                const pct = progressPct(row.progress)
                return (
                  <tr key={row.id || row.batchNumber}>
                    <td>{row.batchNumber || '—'}</td>
                    <td>{row.department || '—'}</td>
                    <td>{row.qtyIn != null ? formatGrams(row.qtyIn) : '—'}</td>
                    <td>{row.qtyOut != null ? formatGrams(row.qtyOut) : '—'}</td>
                    <td>{row.employee || '—'}</td>
                    <td>{row.startedAt ? formatClock(row.startedAt) : '—'}</td>
                    <td>{row.durationMin != null ? formatMinutes(row.durationMin) : '—'}</td>
                    <td>{row.metalLoss != null ? formatGrams(row.metalLoss) : '—'}</td>
                    <td>
                      <span className={`pd-status-pill pd-status-pill--sm pd-status-pill--${tone}`}>
                        {row.status || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="pd-progress-cell" title={`${pct}%`}>
                        <div className="pd-progress">
                          <div className="pd-progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pd-progress-label">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
