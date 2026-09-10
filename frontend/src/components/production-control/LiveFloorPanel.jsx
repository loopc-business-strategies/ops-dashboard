import { useState } from 'react'
import productionControlApi from '../../api/productionControl'
import { BOARD_COLUMNS, formatGrams, formatKg, formatTime } from './shared'
import { PccConfirmDialog, PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge, PccWeightDisplay } from './primitives'

export default function LiveFloorPanel({
  summary,
  flow,
  loading,
  onSelectBatch,
  onRefresh,
  onToast,
}) {
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

  const runConfirmed = async () => {
    if (!confirm) return
    const { action, batch } = confirm
    setConfirm(null)
    try {
      if (action === 'hold') await productionControlApi.holdBatch(batch._id, {})
      if (action === 'release') await productionControlApi.releaseBatch(batch._id, {})
      onToast?.(action === 'hold' ? 'Batch put on hold' : 'Batch released')
      onRefresh?.()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <PccKpiCard label="Active WOs" value={kpis.activeWorkOrders ?? 0} />
        <PccKpiCard label="Active batches" value={kpis.activeBatches ?? 0} />
        <PccKpiCard label="Metal WIP" value={formatKg(kpis.metalInProduction)} />
        <PccKpiCard label="Waiting" value={kpis.waiting ?? 0} />
        <PccKpiCard label="QC pending" value={kpis.qcPending ?? 0} />
        <PccKpiCard label="QC failed" value={kpis.qcFailed ?? 0} />
        <PccKpiCard label="On hold" value={kpis.onHold ?? 0} />
        <PccKpiCard label="Alerts" value={kpis.activeAlerts ?? 0} />
        <PccKpiCard label="Machines" value={kpis.machinesRunning ?? 0} />
        <PccKpiCard label="Pending passes" value={kpis.passesPending ?? 0} />
        <PccKpiCard label="Completed today" value={kpis.completedToday ?? 0} />
        <PccKpiCard label="Returned today" value={kpis.returnedToday ?? 0} />
      </div>

      <div className="pcc-flow">
        {stages.length === 0 ? (
          <PccEmptyState message="No production flow configured" />
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
                          <span>{b.metalType}{b.purity ? ` ${b.purity}` : ''}</span>
                          <span><PccWeightDisplay grams={b.currentWeight} /> · {b.currentDepartment || '—'}</span>
                          <span>{b.currentHolderName || 'Unassigned'} · {b.currentProcess || '—'}</span>
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
          <div className="pcc-panel-head"><h2>METAL CUSTODY</h2></div>
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
          <div className="pcc-panel-head"><h2>ATTENTION REQUIRED</h2></div>
          {(summary?.attention || []).length === 0 ? (
            <PccEmptyState message="No production alerts" />
          ) : (
            <ul className="pcc-list">
              {summary.attention.map((a) => (
                <li key={a._id}>
                  <strong>{a.title}</strong>
                  <span>{a.message}</span>
                  <PccStatusBadge status={a.severity || a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
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
