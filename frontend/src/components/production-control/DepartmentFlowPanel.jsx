import { formatGrams } from './shared'
import { PccEmptyState, PccStatusBadge, PccSkeleton } from './primitives'

/**
 * Bottleneck / department summary — reuses live-floor aggregates (no new schema).
 */
export default function DepartmentFlowPanel({ summary, loading, onNavigate, onRefresh }) {
  if (loading && !summary) {
    return (
      <div className="pcc-panel">
        <PccSkeleton rows={5} />
      </div>
    )
  }

  const departments = summary?.departments || []
  const metalByDept = summary?.metalByDepartment || []
  const kpis = summary?.kpis || {}

  const metalByKey = {}
  metalByDept.forEach((row) => {
    const key = String(row.department || '').toLowerCase()
    if (!key) return
    metalByKey[key] = (metalByKey[key] || 0) + (Number(row.weight) || 0)
  })

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>DEPARTMENT FLOW</h2>
          <button type="button" className="pcc-btn-ghost" onClick={() => onRefresh?.()}>Refresh</button>
        </div>
        <p className="pcc-muted" style={{ margin: '0 0 12px' }}>
          Active vs delayed work by department — identify bottlenecks from live floor data.
        </p>
        <div className="pcc-kpi-row" style={{ marginBottom: 12 }}>
          <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeBatches ?? 0}</div><div className="pcc-kpi-label">Active batches</div></div>
          <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.delayedBatches ?? 0}</div><div className="pcc-kpi-label">Delayed</div></div>
          <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.waiting ?? 0}</div><div className="pcc-kpi-label">Waiting</div></div>
          <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcPending ?? 0}</div><div className="pcc-kpi-label">QC pending</div></div>
        </div>
        {departments.length === 0 ? (
          <PccEmptyState message="No department status available yet." />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Active</th>
                  <th>Waiting</th>
                  <th>Done today</th>
                  <th>Metal WIP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => {
                  const delayed = Number(d.delayed || d.waiting || 0)
                  return (
                    <tr key={d.key}>
                      <td><strong>{d.label || d.key}</strong></td>
                      <td><PccStatusBadge status={d.status} /></td>
                      <td>{d.active ?? 0}</td>
                      <td className={delayed > 0 ? 'pcc-text-warn' : ''}>{d.waiting ?? 0}</td>
                      <td>{d.completedToday ?? 0}</td>
                      <td>{formatGrams(metalByKey[String(d.key || '').toLowerCase()] || d.weight || 0)}</td>
                      <td>
                        <button
                          type="button"
                          className="pcc-btn-ghost"
                          onClick={() => onNavigate?.(`dept-${d.key}`)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
