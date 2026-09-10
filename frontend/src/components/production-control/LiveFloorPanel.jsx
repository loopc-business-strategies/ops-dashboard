import { EmptyState, KpiTile, StatusPill, formatGrams, formatKg, formatTime } from './shared'

export default function LiveFloorPanel({
  summary,
  flow,
  loading,
  onSelectBatch,
  onRefresh,
}) {
  if (loading && !summary) {
    return <div className="pcc-panel">Loading live floor…</div>
  }

  const kpis = summary?.kpis || {}
  const stages = flow?.stages || []

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <KpiTile label="ACTIVE" value={kpis.activeBatches ?? 0} />
        <KpiTile label="METAL WIP" value={formatKg(kpis.metalInProduction)} />
        <KpiTile label="WAITING" value={kpis.waiting ?? 0} />
        <KpiTile label="QC" value={kpis.qcPending ?? 0} />
        <KpiTile label="HOLD" value={kpis.onHold ?? 0} />
        <KpiTile label="ALERTS" value={kpis.activeAlerts ?? 0} />
        <KpiTile label="MACHINES" value={kpis.machinesRunning ?? 0} />
        <KpiTile label="PASS" value={kpis.passesPending ?? 0} />
      </div>

      <div className="pcc-flow">
        {stages.length === 0 ? (
          <EmptyState message="No production flow configured" />
        ) : (
          stages.map((stage, idx) => (
            <div key={stage.key || idx} className="pcc-flow-stage">
              <span>{stage.label}</span>
              {idx < stages.length - 1 && <span className="pcc-flow-arrow">→</span>}
            </div>
          ))
        )}
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>ACTIVE PRODUCTION</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onRefresh}>Refresh</button>
        </div>
        {(summary?.activeBatches || []).length === 0 ? (
          <EmptyState message="No active batches" />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Metal</th>
                  <th>Weight</th>
                  <th>Process</th>
                  <th>Person</th>
                  <th>Machine</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.activeBatches.map((b) => (
                  <tr key={b._id} className="pcc-row-click" onClick={() => onSelectBatch?.(b._id)}>
                    <td>{b.batchNumber}</td>
                    <td>{b.metalType}{b.purity ? ` ${b.purity}` : ''}</td>
                    <td>{formatGrams(b.currentWeight)}</td>
                    <td>{b.currentProcess || b.currentDepartment || '—'}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentMachineName || '—'}</td>
                    <td><StatusPill status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>METAL CUSTODY</h2></div>
          {(summary?.custody || []).length === 0 ? (
            <EmptyState message="No current metal custody" />
          ) : (
            <ul className="pcc-list">
              {summary.custody.map((c, i) => (
                <li key={`${c.person}-${c.department}-${i}`}>
                  <strong>{c.person}</strong>
                  <span>{c.department} · {c.metalType} {c.purity}</span>
                  <span>{formatKg(c.weight)} · {c.batches} batch{c.batches === 1 ? '' : 'es'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>ATTENTION REQUIRED</h2></div>
          {(summary?.attention || []).length === 0 ? (
            <EmptyState message="No production alerts" />
          ) : (
            <ul className="pcc-list">
              {summary.attention.map((a) => (
                <li key={a._id}>
                  <strong>{a.title}</strong>
                  <span>{a.message}</span>
                  <StatusPill status={a.severity || a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>RECENT ACTIVITY</h2></div>
        {(summary?.recentActivity || []).length === 0 ? (
          <EmptyState message="No recent movements" />
        ) : (
          <ul className="pcc-list">
            {summary.recentActivity.map((m) => (
              <li key={m._id}>
                <strong>{m.movementNumber}</strong>
                <span>{m.fromDepartment} → {m.toDepartment} · {formatGrams(m.weight)}</span>
                <span>{formatTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
