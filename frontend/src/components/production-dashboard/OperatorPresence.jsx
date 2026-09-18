import { formatClock } from './formatters'

export default function OperatorPresence({
  rows = [],
  onRowClick,
  onOperatorIn,
  onOperatorOut,
  selectedId,
  canFloorSession,
}) {
  return (
    <section className="pd-panel pd-operator-presence" aria-label="Operator presence">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Operator Presence</h2>
        <div className="pd-panel-actions">
          <button
            type="button"
            className="pd-btn pd-btn--sm pd-btn--ok"
            onClick={() => onOperatorIn?.()}
            disabled={!canFloorSession}
            title={canFloorSession ? 'Operator IN' : 'No floor session permission'}
          >
            IN
          </button>
          <button
            type="button"
            className="pd-btn pd-btn--sm pd-btn--danger"
            onClick={() => onOperatorOut?.()}
            disabled={!canFloorSession}
            title={canFloorSession ? 'Operator OUT' : 'No floor session permission'}
          >
            OUT
          </button>
        </div>
      </div>
      <div className="pd-table-wrap pd-table-wrap--compact">
        <table className="pd-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>IN/OUT</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => {
              const onDuty = row.status === 'On Duty'
              return (
                <tr
                  key={row.id}
                  className={selectedId === row.id ? 'pd-row--selected' : ''}
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.employee}</td>
                  <td>{row.department}</td>
                  <td>
                    <span className={`pd-status-pill pd-status-pill--sm ${onDuty ? 'pd-status-pill--ok' : 'pd-status-pill--bad'}`}>
                      {row.direction}
                    </span>
                  </td>
                  <td>{row.time ? formatClock(row.time) : '—'}</td>
                  <td>
                    <span className={`pd-status-pill pd-status-pill--sm ${onDuty ? 'pd-status-pill--ok' : 'pd-status-pill--bad'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows?.length ? <p className="pd-empty">No operator presence data</p> : null}
      </div>
    </section>
  )
}
