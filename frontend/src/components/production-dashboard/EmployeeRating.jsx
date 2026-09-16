import { formatGrams, formatMinutes } from './formatters'

export default function EmployeeRating({ rows }) {
  const list = rows || []
  return (
    <section className="pd-panel pd-emp-rating" aria-label="Employee rating">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Employee Rating</h2>
      </div>
      {!list.length ? (
        <p className="pd-empty">No production data</p>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Emp No</th>
                <th>Name</th>
                <th>Dept</th>
                <th>Batches</th>
                <th>Qty</th>
                <th>Avg Time</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={`${r.employeeCode || r.name}-${i}`}>
                  <td>{r.employeeCode || '—'}</td>
                  <td>{r.name || '—'}</td>
                  <td>{r.department || '—'}</td>
                  <td>{r.batches || 0}</td>
                  <td>{r.quantity ? formatGrams(r.quantity) : '—'}</td>
                  <td>{r.avgTimeMin != null ? formatMinutes(r.avgTimeMin) : '—'}</td>
                  <td>{r.ratingLabel != null ? r.ratingLabel : 'Rating unavailable'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
