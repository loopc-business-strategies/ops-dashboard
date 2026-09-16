import { useMemo, useState } from 'react'
import { BOARD_COLUMNS, formatGrams, formatKg, formatMinutes, formatTime } from './shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccKpiCard,
  PccKpiRow,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from './primitives'
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
  connection,
  lastUpdated,
}) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [confirm, setConfirm] = useState(null)

  const kpis = summary?.kpis || {}
  const stages = flow?.stages || []
  const board = summary?.board || {}
  const shift = summary?.currentShift
  const openAlerts = summary?.openAlerts || summary?.attention || []
  const attentionItems = summary?.attention || summary?.openAlerts || []
  const criticalAlerts = openAlerts.filter((a) => String(a.severity || '').toLowerCase() === 'critical')
  const attentionAlerts = attentionItems.filter((a) => String(a.severity || '').toLowerCase() !== 'critical')
  const normalAlerts = openAlerts.filter((a) => {
    const s = String(a.severity || '').toLowerCase()
    return s && s !== 'critical' && s !== 'warning' && s !== 'attention'
  })

  const activeBatches = useMemo(() => {
    const ids = new Set()
    const list = []
    for (const col of BOARD_COLUMNS) {
      for (const b of board[col.id] || []) {
        if (ids.has(b._id)) continue
        if (['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(b.status)) continue
        ids.add(b._id)
        list.push(b)
      }
    }
    return list
  }, [board])

  const waitingBatches = useMemo(
    () => activeBatches.filter((b) => ['WAITING', 'AWAITING_ISSUE', 'CREATED', 'QUEUED'].includes(b.status)
      || String(b.waitReason || b.blockedReason || '').trim()),
    [activeBatches],
  )

  if (loading && !summary) {
    return (
      <div className="pcc-panel">
        <PccSkeleton rows={6} />
      </div>
    )
  }

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
      {/* A. Exceptions first */}
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
              {(kpis.delayedBatches || 0) > 0 && (
                <li>
                  <strong>Delayed batches</strong>
                  <span>{kpis.delayedBatches}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('delay-monitor')}>Delays</button>
                </li>
              )}
              {(kpis.rework || 0) > 0 && (
                <li>
                  <strong>Rework</strong>
                  <span>{kpis.rework}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('rework')}>Rework</button>
                </li>
              )}
              {attentionAlerts.length === 0 && !(kpis.delayedBatches > 0) && !(kpis.rework > 0) && (
                <li className="pcc-muted">No attention items</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="pcc-muted">NORMAL</h3>
            <ul className="pcc-list">
              {normalAlerts.slice(0, 4).map((a) => (
                <li key={a._id || a.id}>
                  <button type="button" className="pcc-link" onClick={() => openException(a)}>
                    <strong>{a.title || a.code || 'Info'}</strong>
                  </button>
                </li>
              ))}
              <li>
                <strong>Active production</strong>
                <span>{kpis.activeBatches ?? 0} batches</span>
              </li>
              <li>
                <strong>Metal in transit</strong>
                <span>{formatKg(kpis.metalInTransit)}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* B. Current shift */}
      <div className="pcc-panel pcc-shift-banner">
        <div>
          <strong>CURRENT SHIFT</strong>
          <div>{shift?.name || '—'}{summary?.floorManagerName ? ` · ${summary.floorManagerName}` : ''}</div>
        </div>
        <div>
          <div>Start: {shift?.startLabel || shift?.startTime || '—'}</div>
          <div>End: {shift?.endLabel || shift?.endTime || '—'}</div>
        </div>
        <div>
          <div>Elapsed: {formatMinutes(shift?.timeElapsedMinutes)}</div>
          <div>Remaining: {formatMinutes(shift?.timeRemainingMinutes)}</div>
        </div>
        <div>
          <div>Connection: {connection || '—'}</div>
          <div>Updated: {lastUpdated ? formatTime(lastUpdated) : '—'}</div>
        </div>
      </div>

      {/* C. Active production KPIs */}
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>ACTIVE PRODUCTION</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => onNavigate?.('batches')}>+ Create Batch</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-selection')}>Issue Metal</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('processes')}>Start Process</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('passes')}>Record Handover</button>
          </div>
        </div>
        <PccKpiRow className="pcc-kpi-row-primary">
          <PccKpiCard label="ACTIVE" value={kpis.activeBatches ?? 0} />
          <PccKpiCard label="WAITING" value={kpis.waiting ?? 0} />
          <PccKpiCard label="HOLD" value={kpis.onHold ?? 0} />
          <PccKpiCard label="QC PENDING" value={kpis.qcPending ?? 0} />
        </PccKpiRow>
      </div>

      {/* D. Active batches */}
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>ACTIVE BATCHES</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onRefresh}>Refresh</button>
        </div>
        {activeBatches.length === 0 ? (
          <PccEmptyState message="No active batches on the floor" hint="Create or issue a batch to see it here." />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Product</th>
                  <th>Metal</th>
                  <th>Weight</th>
                  <th>Purity</th>
                  <th>Department</th>
                  <th>Process</th>
                  <th>Holder</th>
                  <th>Machine</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {activeBatches.slice(0, 40).map((b) => (
                  <tr key={b._id}>
                    <td>
                      <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(b._id)}>
                        <strong>{b.batchNumber}</strong>
                      </button>
                    </td>
                    <td>{b.product || '—'}</td>
                    <td>{b.metalType || '—'}</td>
                    <td><PccWeightDisplay grams={b.currentWeight} /></td>
                    <td>{b.purity || '—'}</td>
                    <td>{b.currentDepartment || '—'}</td>
                    <td>{b.currentProcess || '—'}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentMachineName || '—'}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                    <td>{formatTime(b.updatedAt || b.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* E. Production flow */}
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

      {/* F. Blocked / waiting */}
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>BLOCKED / WAITING</h2>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('delay-monitor')}>Delays</button>
        </div>
        {waitingBatches.length === 0 ? (
          <PccEmptyState message="Nothing waiting right now" />
        ) : (
          <ul className="pcc-list">
            {waitingBatches.slice(0, 12).map((b) => (
              <li key={b._id}>
                <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(b._id)}>
                  <strong>{b.batchNumber}</strong>
                </button>
                <span>
                  {b.waitReason || b.blockedReason || b.status}
                  {b.currentDepartment ? ` · ${b.currentDepartment}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* G + H Metal + activity */}
      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head">
            <h2>METAL CONTROL</h2>
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
                  {c.batchId ? (
                    <button type="button" className="pcc-btn-ghost" onClick={() => onSelectBatch?.(c.batchId)}>Open</button>
                  ) : null}
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
                  {m.batchId ? (
                    <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(m.batchId)}>
                      <strong>{m.movementNumber || m.batchNumber || 'Activity'}</strong>
                    </button>
                  ) : (
                    <strong>{m.movementNumber || 'Activity'}</strong>
                  )}
                  <span>{m.fromDepartment} → {m.toDepartment} · {formatGrams(m.weight)}</span>
                  <span>{formatTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Compact board for status columns */}
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>FLOOR BOARD</h2></div>
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
                          <span><PccWeightDisplay grams={b.currentWeight} /> · {b.currentDepartment || '—'}</span>
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
