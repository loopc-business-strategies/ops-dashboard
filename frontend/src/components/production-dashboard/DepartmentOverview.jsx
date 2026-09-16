import { formatGrams, formatMinutes, pccHref } from './formatters'

export default function DepartmentOverview({ rows }) {
  const list = rows || []
  return (
    <section className="pd-panel pd-dept-overview" aria-label="Department overview">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Department Overview</h2>
      </div>
      {!list.length ? (
        <p className="pd-empty">No production data</p>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Batch</th>
                <th>Employee</th>
                <th>Quantity</th>
                <th>Input</th>
                <th>Output</th>
                <th>Time Taken</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.key}
                  className={r.batchId ? 'pd-table-row--click' : undefined}
                  onClick={() => {
                    if (r.batchId) window.location.href = pccHref('batches', { batch: r.batchId })
                  }}
                >
                  <td>{r.department}</td>
                  <td>{r.batch || '—'}</td>
                  <td>{r.employee || 'Employee not assigned'}</td>
                  <td>{r.quantity != null ? formatGrams(r.quantity) : '—'}</td>
                  <td>{r.input != null ? formatGrams(r.input) : '—'}</td>
                  <td>{r.output != null ? formatGrams(r.output) : '—'}</td>
                  <td>{r.timeTakenMin != null ? formatMinutes(r.timeTakenMin) : '—'}</td>
                  <td><span className={`pd-badge pd-badge--${String(r.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
