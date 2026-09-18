import { formatClock, formatGrams, formatDateLong } from './formatters'
import { MATERIAL_FLOW_STEPS, matchDashboardDeptKey } from './departmentConfig'

function genealogyFromBatch(batch, stages, movements) {
  if (!batch) return []
  const dept = matchDashboardDeptKey(batch.currentDepartment || batch.currentProcess || batch.currentLocation)
  const path = []
  const seen = new Set()
  ;(movements || []).slice().reverse().forEach((m) => {
    const from = matchDashboardDeptKey(m.from) || m.from
    const to = matchDashboardDeptKey(m.to) || m.to
    ;[from, to].forEach((k) => {
      if (!k || seen.has(k)) return
      seen.add(k)
      path.push({ key: k, label: k, weight: m.weight })
    })
  })
  if (!path.length) {
    path.push({ key: 'vault', label: 'Vault / Raw', weight: batch.initialWeight || batch.issuedWeight })
    if (dept) path.push({ key: dept, label: dept, weight: batch.currentWeight })
  }
  return path.map((step) => {
    const flow = (stages || MATERIAL_FLOW_STEPS).find((s) => s.key === step.key)
    const deptLabel = MATERIAL_FLOW_STEPS.find((s) => s.key === step.key)?.label
    return {
      ...step,
      label: flow?.label || deptLabel || String(step.label || step.key).replace(/_/g, ' '),
    }
  })
}

export default function BatchTraceability({
  batchRows = [],
  selectedBatchId,
  batchDetail,
  metalMovements = [],
  onSelectBatch,
}) {
  const batch = batchDetail?.batch || null
  const selectedRow = (batchRows || []).find((r) => String(r.id) === String(selectedBatchId)) || batchRows[0] || null
  const display = batch || selectedRow
  const movements = (batchDetail?.movements?.length
    ? batchDetail.movements
    : (metalMovements || []).filter(
      (m) => String(m.batchId) === String(selectedBatchId || display?.id)
        || String(m.batch) === String(display?.batchNumber || display?.batch),
    )
  ).slice(0, 8)

  const genealogy = genealogyFromBatch(
    batch || (display ? {
      currentDepartment: display.department,
      initialWeight: display.qtyIn,
      currentWeight: display.qtyOut ?? display.qtyIn,
      batchNumber: display.batchNumber,
    } : null),
    MATERIAL_FLOW_STEPS,
    movements,
  )

  return (
    <section className="pd-panel pd-batch-trace" aria-label="Batch monitor and traceability">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Batch Monitor / Traceability</h2>
      </div>

      <div className="pd-batch-trace-layout">
        <div className="pd-batch-list-col">
          <div className="pd-table-wrap pd-table-wrap--compact">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Dept</th>
                  <th>Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(batchRows || []).slice(0, 12).map((row) => (
                  <tr
                    key={row.id || row.batchNumber}
                    className={String(selectedBatchId) === String(row.id) ? 'pd-row--selected' : ''}
                    onClick={() => onSelectBatch?.(row.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.batchNumber}</td>
                    <td>{row.department}</td>
                    <td>{row.qtyIn != null ? formatGrams(row.qtyIn) : '—'}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!batchRows?.length ? <p className="pd-empty">No active batches</p> : null}
          </div>
        </div>

        <div className="pd-batch-detail-col">
          {display ? (
            <>
              <div className="pd-batch-stats">
                <div>
                  <span className="pd-kpi-label">Batch</span>
                  <strong>{batch?.batchNumber || display.batchNumber || '—'}</strong>
                </div>
                <div>
                  <span className="pd-kpi-label">Metal</span>
                  <strong>{batch?.metalType || '—'}{batch?.purity ? ` · ${batch.purity}` : ''}</strong>
                </div>
                <div>
                  <span className="pd-kpi-label">Weight</span>
                  <strong>
                    {formatGrams(batch?.currentWeight ?? display.qtyIn ?? display.qtyOut)}
                  </strong>
                </div>
                <div>
                  <span className="pd-kpi-label">Location</span>
                  <strong>{batch?.currentDepartment || display.department || '—'}</strong>
                </div>
                <div>
                  <span className="pd-kpi-label">Created</span>
                  <strong>
                    {batch?.createdAt
                      ? formatDateLong(batch.createdAt)
                      : (display.startedAt ? formatClock(display.startedAt) : '—')}
                  </strong>
                </div>
              </div>

              <p className="pd-movement-title">Batch Genealogy</p>
              <div className="pd-genealogy-rail">
                {genealogy.map((step, idx) => (
                  <div key={`${step.key}-${idx}`} className="pd-genealogy-step">
                    {idx > 0 ? <span aria-hidden>→</span> : null}
                    <div className="pd-genealogy-node">
                      <strong>{step.label}</strong>
                      <span>{step.weight != null ? formatGrams(step.weight) : '—'}</span>
                    </div>
                  </div>
                ))}
                {!genealogy.length ? <span className="pd-muted">No genealogy yet</span> : null}
              </div>

              <p className="pd-movement-title">Recent Movements</p>
              <ul className="pd-mini-ledger">
                {movements.map((m) => (
                  <li key={m.id || m.movementNumber}>
                    <span>{m.movementNumber || m.id}</span>
                    <span>{m.from} → {m.to}</span>
                    <span>{m.weight != null ? formatGrams(m.weight) : '—'}</span>
                    <span>{m.time ? formatClock(m.time) : '—'}</span>
                  </li>
                ))}
                {!movements.length ? <li className="pd-muted">No movements for this batch</li> : null}
              </ul>
            </>
          ) : (
            <p className="pd-empty">Select a batch to view traceability</p>
          )}
        </div>
      </div>
    </section>
  )
}
