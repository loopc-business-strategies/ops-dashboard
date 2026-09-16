import { formatGrams } from '../shared'
import {
  PccEmptyState,
  PccSkeleton,
} from '../primitives'

const FLOW_STAGES = [
  { key: 'work-orders', label: 'Work Orders', section: 'work-orders', kpi: 'activeWorkOrders' },
  { key: 'batches', label: 'Batches', section: 'batches', kpi: 'activeBatches' },
  { key: 'material', label: 'Material', section: 'stock-processing', stock: 'underProcessing' },
  { key: 'processing', label: 'Processing', section: 'processes', kpi: 'activeBatches' },
  { key: 'qc', label: 'QC', section: 'qc', kpi: 'qcPending' },
  { key: 'rework', label: 'Rework', section: 'rework', kpi: 'rework' },
  { key: 'finished', label: 'Finished', section: 'stock-finished', stock: 'finished' },
]

function stageCount(stage, kpis, stock) {
  if (stage.stock) return stock?.[stage.stock]?.count ?? 0
  if (stage.kpi === 'rework') return kpis.rework ?? 0
  return kpis[stage.kpi] ?? 0
}

function openException(item, { onSelectBatch, onNavigate }) {
  if (item?.batchId) {
    onSelectBatch?.(item.batchId)
    return
  }
  const code = String(item?.code || item?.category || '').toUpperCase()
  if (code.includes('MACHINE') || item?.machineId) {
    onNavigate?.('machines')
    return
  }
  if (code.includes('PASS') || item?.passId) {
    onNavigate?.('passes')
    return
  }
  if (code.includes('DELAY')) {
    onNavigate?.('delay-monitor')
    return
  }
  onNavigate?.('alerts')
}

export default function OverviewPanel({
  summary,
  flow,
  loading,
  error,
  onRetry,
  onNavigate,
  onSelectBatch,
}) {
  if (loading && !summary) {
    return (
      <div className="pcc-panel">
        <PccSkeleton rows={6} />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="pcc-panel">
        <PccEmptyState
          message="Unable to load Production Overview. The production service did not respond."
        />
        {onRetry ? (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="pcc-btn" onClick={onRetry}>Retry</button>
          </div>
        ) : null}
      </div>
    )
  }

  const kpis = summary?.kpis || {}
  const stock = summary?.stock || {}
  const statusCounts = summary?.statusCounts || []
  const metalByDept = summary?.metalByDepartment || []
  const rework = kpis.rework ?? statusCounts.find((s) => s.status === 'REWORK')?.count ?? 0
  const hold = kpis.onHold ?? statusCounts.find((s) => s.status === 'HOLD')?.count ?? 0
  const openAlerts = summary?.openAlerts || summary?.attention || []
  const criticalAlerts = openAlerts.filter((a) => String(a.severity || '').toLowerCase() === 'critical')
  const attentionAlerts = (summary?.attention || openAlerts).filter(
    (a) => String(a.severity || '').toLowerCase() !== 'critical',
  )
  const configuredStages = flow?.stages?.length
    ? flow.stages.map((s, idx) => ({
      key: s.key || `stage-${idx}`,
      label: s.label || s.key,
      section: s.key ? `dept-${String(s.key).toLowerCase()}` : 'live',
      count: null,
    }))
    : FLOW_STAGES.map((s) => ({
      ...s,
      count: stageCount(s, { ...kpis, rework }, stock),
    }))

  const maxMetal = Math.max(1, ...metalByDept.map((r) => Number(r.weight) || 0))

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeWorkOrders ?? 0}</div><div className="pcc-kpi-label">Active WOs</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeBatches ?? 0}</div><div className="pcc-kpi-label">Active batches</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.completedToday ?? 0}</div><div className="pcc-kpi-label">Completed today</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcPending ?? 0}</div><div className="pcc-kpi-label">QC pending</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcFailed ?? 0}</div><div className="pcc-kpi-label">QC failed</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{rework}</div><div className="pcc-kpi-label">Rework</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.delayedBatches ?? 0}</div><div className="pcc-kpi-label">Delayed</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{hold}</div><div className="pcc-kpi-label">On hold</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.metalInProduction)}</div><div className="pcc-kpi-label">Metal WIP</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeAlerts ?? openAlerts.length}</div><div className="pcc-kpi-label">Open alerts</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.machinesRunning ?? 0}</div><div className="pcc-kpi-label">Machines running</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.machinesFaulted ?? 0}</div><div className="pcc-kpi-label">Machines faulted</div></div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>REQUIRES IMMEDIATE ACTION</h2></div>
        <ul className="pcc-list">
          {criticalAlerts.slice(0, 8).map((a) => (
            <li key={a._id || a.id}>
              <button type="button" className="pcc-link" onClick={() => openException(a, { onSelectBatch, onNavigate })}>
                <strong>{a.title || a.code || 'Critical'}</strong>
              </button>
              <span>{a.message || a.department || a.code || ''}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => openException(a, { onSelectBatch, onNavigate })}>Open</button>
            </li>
          ))}
          {(kpis.qcFailed || 0) > 0 && (
            <li>
              <strong>QC failures</strong>
              <span>{kpis.qcFailed} batch(es)</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>Open QC</button>
            </li>
          )}
          {(kpis.machinesFaulted || 0) > 0 && (
            <li>
              <strong>Machine faults / maintenance</strong>
              <span>{kpis.machinesFaulted}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('maintenance')}>Maintenance</button>
            </li>
          )}
          {criticalAlerts.length === 0 && !(kpis.qcFailed > 0) && !(kpis.machinesFaulted > 0) && (
            <li className="pcc-muted">No critical production exceptions</li>
          )}
        </ul>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>ATTENTION REQUIRED</h2></div>
        <ul className="pcc-list">
          {attentionAlerts.slice(0, 8).map((item, i) => (
            <li key={item._id || item.id || item.batchNumber || i}>
              <button type="button" className="pcc-link" onClick={() => openException(item, { onSelectBatch, onNavigate })}>
                <strong>{item.title || item.batchNumber || item.type || 'Attention'}</strong>
              </button>
              <span>{item.message || item.reason || item.status || ''}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => openException(item, { onSelectBatch, onNavigate })}>Open</button>
            </li>
          ))}
          {(kpis.qcPending || 0) > 0 && (
            <li>
              <strong>Pending QC</strong>
              <span>{kpis.qcPending}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>QC</button>
            </li>
          )}
          {(kpis.delayedBatches || 0) > 0 && (
            <li>
              <strong>Delayed batches</strong>
              <span>{kpis.delayedBatches}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('delay-monitor')}>Delays</button>
            </li>
          )}
          {rework > 0 && (
            <li>
              <strong>Open rework</strong>
              <span>{rework}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('rework')}>Rework</button>
            </li>
          )}
          {(kpis.passesPending || 0) > 0 && (
            <li>
              <strong>Unacknowledged passes</strong>
              <span>{kpis.passesPending}</span>
              <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('passes')}>Passes</button>
            </li>
          )}
          {attentionAlerts.length === 0
            && !(kpis.qcPending > 0)
            && !(kpis.delayedBatches > 0)
            && !(rework > 0)
            && !(kpis.passesPending > 0) && (
            <li className="pcc-muted">No attention items</li>
          )}
        </ul>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>PRODUCTION FLOW</h2></div>
        <div className="pcc-flow pcc-flow-clickable">
          {configuredStages.map((stage, idx) => (
            <button
              key={stage.key || idx}
              type="button"
              className="pcc-flow-stage pcc-flow-stage-btn"
              onClick={() => onNavigate?.(stage.section || 'live')}
            >
              <span>{stage.label}</span>
              {stage.count != null ? <strong>{stage.count}</strong> : null}
              {idx < configuredStages.length - 1 ? <span className="pcc-flow-arrow" aria-hidden>→</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>METAL BY DEPARTMENT</h2></div>
          {metalByDept.length === 0 ? (
            <PccEmptyState message="No metal in production" />
          ) : (
            <div className="pcc-bars">
              {metalByDept.map((row, i) => (
                <div key={`${row.department}-${row.metalType}-${i}`} className="pcc-bar-row">
                  <span>{String(row.department || '').toUpperCase()} · {row.metalType}</span>
                  <div className="pcc-bar-track">
                    <div className="pcc-bar-fill" style={{ width: `${(Number(row.weight) / maxMetal) * 100}%` }} />
                  </div>
                  <strong>{formatGrams(row.weight)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>CUSTODY SNAPSHOT</h2></div>
          {(summary?.custody || []).length === 0 ? (
            <PccEmptyState message="No custody rows" />
          ) : (
            <ul className="pcc-list">
              {summary.custody.slice(0, 10).map((c, i) => (
                <li key={`${c.person}-${i}`}>
                  <strong>{c.person}</strong>
                  <span>{c.department} · {formatGrams(c.weight)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(summary?.recentActivity || summary?.activity || []).length > 0 && (
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>RECENT ACTIVITY</h2></div>
          <ul className="pcc-list">
            {(summary.recentActivity || summary.activity).slice(0, 10).map((ev, i) => (
              <li key={ev._id || ev.id || i}>
                <strong>{ev.title || ev.action || ev.type || 'Update'}</strong>
                <span>{ev.message || ev.batchNumber || ev.entity || ''}</span>
                {ev.batchId ? (
                  <button type="button" className="pcc-btn-ghost" onClick={() => onSelectBatch?.(ev.batchId)}>Open</button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
