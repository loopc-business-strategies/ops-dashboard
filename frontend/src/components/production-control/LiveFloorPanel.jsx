import { useState } from 'react'
import { BOARD_COLUMNS, formatGrams, formatKg, formatMinutes, formatTime } from './shared'
import { PccConfirmDialog, PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge, PccWeightDisplay } from './primitives'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'

export default function LiveFloorPanel({
  summary,
  flow,
  loading,
  onSelectBatch,
  onRefresh,
  onToast,
  onNavigate,
}) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [confirm, setConfirm] = useState(null)

  if (loading && !summary) {
    return (
      <div className="pcc-panel">
        <PccSkeleton rows={6} />
      </div>
    )
  }

  const kpis = summary?.kpis || {}
  const stages = flow?.stages || []
  const board = summary?.board || {}
  const stock = summary?.stock || {}
  const shift = summary?.currentShift
  const openAlerts = summary?.openAlerts || summary?.attention || []
  const attentionItems = summary?.attention || summary?.openAlerts || []
  const criticalAlerts = openAlerts.filter((a) => String(a.severity || '').toLowerCase() === 'critical')
  const attentionAlerts = attentionItems.filter((a) => String(a.severity || '').toLowerCase() !== 'critical')

  const openException = (item) => {
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
    onNavigate?.('alerts')
  }

  const runConfirmed = async () => {
    if (!confirm) return
    const { action, batch } = confirm
    setConfirm(null)
    try {
      if (action === 'hold') await pccApi.holdBatch(batch._id, {})
      if (action === 'release') await pccApi.releaseBatch(batch._id, {})
      onToast?.(isDemo ? DEMO_WRITE_MSG : (action === 'hold' ? 'Batch put on hold' : 'Batch released'))
      onRefresh?.()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>EXCEPTIONS FIRST</h2></div>
        <div className="pcc-split">
          <div>
            <h3 className="pcc-muted">CRITICAL</h3>
            <ul className="pcc-list">
              {criticalAlerts.slice(0, 8).map((a) => (
                <li key={a._id || a.id}>
                  <button type="button" className="pcc-link" onClick={() => openException(a)}>
                    <strong>{a.title || a.code || 'Critical'}</strong>
                  </button>
                  <span>{a.message || a.code || ''}</span>
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
                  <strong>Machines faulted / maintenance</strong>
                  <span>{kpis.machinesFaulted}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('maintenance')}>Maintenance</button>
                </li>
              )}
              {criticalAlerts.length === 0 && !(kpis.qcFailed > 0) && !(kpis.machinesFaulted > 0) && (
                <li className="pcc-muted">No critical issues</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="pcc-muted">ATTENTION</h3>
            <ul className="pcc-list">
              {attentionAlerts.slice(0, 8).map((item, i) => (
                <li key={item._id || item.id || item.batchNumber || i}>
                  <button type="button" className="pcc-link" onClick={() => openException(item)}>
                    <strong>{item.title || item.batchNumber || item.type || 'Attention'}</strong>
                  </button>
                  <span>{item.message || item.reason || item.status || ''}</span>
                </li>
              ))}
              {(kpis.waiting || 0) > 0 && (
                <li>
                  <strong>Waiting jobs</strong>
                  <span>{kpis.waiting}</span>
                </li>
              )}
              {(kpis.delayedBatches || 0) > 0 && (
                <li>
                  <strong>Delayed batches</strong>
                  <span>{kpis.delayedBatches}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('delay-monitor')}>Delay Monitor</button>
                </li>
              )}
              {attentionAlerts.length === 0 && !(kpis.waiting > 0) && !(kpis.delayedBatches > 0) && (
                <li className="pcc-muted">No attention items</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="pcc-muted">NORMAL</h3>
            <ul className="pcc-list">
              <li>
                <strong>Active production</strong>
                <span>{kpis.activeBatches ?? 0} batches</span>
              </li>
              <li>
                <strong>Metal in transit</strong>
                <span>{formatKg(kpis.metalInTransit)}</span>
                <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('passes')}>Passes</button>
              </li>
              <li>
                <strong>Machines running</strong>
                <span>{kpis.machinesRunning ?? 0}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {shift && (
        <div className="pcc-panel pcc-shift-banner">
          <div>
            <strong>CURRENT SHIFT</strong>
            <div>{shift.name}</div>
          </div>
          <div>
            <div>Start: {shift.startLabel || shift.startTime}</div>
            <div>End: {shift.endLabel || shift.endTime}</div>
          </div>
          <div>
            <div>Elapsed: {formatMinutes(shift.timeElapsedMinutes)}</div>
            <div>Remaining: {formatMinutes(shift.timeRemainingMinutes)}</div>
          </div>
          <div>
            <div>Managers: {(summary?.managersPresent || []).length}</div>
            <div>Operators: {(summary?.operatorsPresent || []).length}</div>
          </div>
        </div>
      )}

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>COMMAND KPIs</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => onNavigate?.('batches')}>+ Create Batch</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-selection')}>Issue Metal</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('processes')}>Start Process</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('passes')}>Record Handover</button>
          </div>
        </div>
        <div className="pcc-kpi-row pcc-kpi-row-primary">
          <PccKpiCard label="ACTIVE" value={kpis.activeBatches ?? 0} />
          <PccKpiCard label="WAITING" value={kpis.waiting ?? 0} />
          <PccKpiCard label="HOLD" value={kpis.onHold ?? 0} />
          <PccKpiCard label="QC PENDING" value={kpis.qcPending ?? 0} />
        </div>
        <div className="pcc-kpi-row pcc-kpi-row-secondary" style={{ marginTop: 10 }}>
          <PccKpiCard label="Metal WIP" value={formatKg(kpis.metalInProduction)} />
          <PccKpiCard label="In transit" value={formatKg(kpis.metalInTransit)} />
          <PccKpiCard label="Delayed" value={kpis.delayedBatches ?? 0} />
          <PccKpiCard label="Rework" value={kpis.rework ?? 0} />
          <PccKpiCard label="Alerts" value={kpis.activeAlerts ?? 0} />
          <PccKpiCard label="Passes pending" value={kpis.passesPending ?? 0} />
          <PccKpiCard label="Completed today" value={kpis.completedToday ?? 0} />
          <PccKpiCard label="Active WOs" value={kpis.activeWorkOrders ?? 0} />
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>STOCK</h2>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-overview')}>Open Stock</button>
        </div>
        <div className="pcc-kpi-row pcc-kpi-row-secondary">
          <PccKpiCard label="New Stock" value={stock.newStock?.count ?? 0} />
          <PccKpiCard label="Available" value={stock.available?.count ?? 0} />
          <PccKpiCard label="Selected" value={stock.selected?.count ?? 0} />
          <PccKpiCard label="Under Processing" value={stock.underProcessing?.count ?? 0} />
          <PccKpiCard label="Finished" value={stock.finished?.count ?? 0} />
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>PRODUCTION FLOW</h2>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('dept-flow')}>Full flow</button>
        </div>
        {(summary?.departments || []).length || stages.length ? (
          <div className="pcc-flow-card-grid">
            {(summary?.departments || []).length
              ? (summary.departments || []).map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="pcc-flow-card"
                  onClick={() => onNavigate?.(`dept-${d.key}`)}
                >
                  <strong>{d.label}</strong>
                  <span>● {d.active ?? 0} Active</span>
                  <span>{d.waiting ?? 0} Waiting</span>
                  <span>⚠ {d.alerts ?? d.alertCount ?? 0} Alert</span>
                  {d.weight != null || d.metalGrams != null ? (
                    <span>{formatKg(d.weight ?? d.metalGrams)}</span>
                  ) : null}
                  <span className="pcc-muted">Open Department</span>
                </button>
              ))
              : stages.map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  className="pcc-flow-card"
                  onClick={() => onNavigate?.(stage.key === 'vault' || stage.key === 'vault_return' ? 'stock-overview' : `dept-${stage.key}`)}
                >
                  <strong>{stage.label}</strong>
                  <span className="pcc-muted">Open stage</span>
                </button>
              ))}
          </div>
        ) : (
          <PccEmptyState message="Department status will appear when flow is active" />
        )}
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>LIVE FLOOR BOARD</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="pcc-board">
          {BOARD_COLUMNS.map((col) => {
            const cards = board[col.id] || []
            return (
              <div key={col.id} className="pcc-board-col">
                <div className="pcc-board-col-head">
                  <span>{col.label}</span>
                  <span>{cards.length}</span>
                </div>
                <div className="pcc-board-col-body">
                  {cards.length === 0 ? (
                    <PccEmptyState message="Empty" />
                  ) : (
                    cards.map((b) => (
                      <div key={b._id} className="pcc-board-card-wrap">
                        <button type="button" className="pcc-board-card" onClick={() => onSelectBatch?.(b._id)}>
                          <strong>{b.batchNumber}</strong>
                          {b.stockCode && <span className="pcc-card-meta">{b.stockCode}</span>}
                          <span className="pcc-card-primary">
                            {b.workOrderNumber ? `${b.workOrderNumber} · ` : ''}
                            {b.product || b.metalType}
                            {b.purity ? ` ${b.purity}` : ''}
                          </span>
                          <span><PccWeightDisplay grams={b.currentWeight} /> · {b.currentDepartment || '—'}</span>
                          {String(b.currentDepartment || '').toLowerCase() === 'packing' && b.status !== 'COMPLETED' && (
                            <span className="pcc-card-meta">Packaging ready</span>
                          )}
                          <span className="pcc-card-meta">
                            {b.currentProcess || '—'} · {b.currentHolderName || 'Unassigned'}
                            {b.currentMachineName ? ` · ${b.currentMachineName}` : ''}
                          </span>
                          <PccStatusBadge status={b.status} />
                        </button>
                        <div className="pcc-board-card-actions">
                          {b.status !== 'HOLD' && !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(b.status) && (
                            <button
                              type="button"
                              className="pcc-btn-ghost"
                              onClick={() => setConfirm({ action: 'hold', batch: b })}
                            >
                              Hold
                            </button>
                          )}
                          {b.status === 'HOLD' && (
                            <button
                              type="button"
                              className="pcc-btn-ghost"
                              onClick={() => setConfirm({ action: 'release', batch: b })}
                            >
                              Release
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head">
            <h2>METAL CUSTODY</h2>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('metal-custody')}>Full view</button>
          </div>
          {(summary?.custody || []).length === 0 ? (
            <PccEmptyState message="No current metal custody" />
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
          <div className="pcc-panel-head"><h2>RECENT ACTIVITY</h2></div>
          {(summary?.recentActivity || []).length === 0 ? (
            <PccEmptyState message="No recent movements" />
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

      <PccConfirmDialog
        open={!!confirm}
        title={confirm?.action === 'hold' ? 'Put batch on hold?' : 'Release batch?'}
        message={
          confirm
            ? `${confirm.action === 'hold' ? 'Hold' : 'Release'} ${confirm.batch.batchNumber} (${formatGrams(confirm.batch.currentWeight)}).`
            : ''
        }
        confirmLabel={confirm?.action === 'hold' ? 'Hold batch' : 'Release'}
        danger={confirm?.action === 'hold'}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmed}
      />
    </div>
  )
}
