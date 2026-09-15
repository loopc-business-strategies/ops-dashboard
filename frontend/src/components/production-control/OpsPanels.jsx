import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatTime, na } from './shared'
import { PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge, PccWeightDisplay } from './primitives'

export function MetalCustodyPanel({ onSelectBatch, onToast }) {
  const pccApi = usePccApi()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await pccApi.getMetalCustody({ limit: 100 })
      setData(d)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load metal custody')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const totals = data?.totals || {}

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>METAL CUSTODY</h2>
          <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {loading && !data ? <PccSkeleton rows={4} /> : (
        <>
          <div className="pcc-kpi-row">
            <PccKpiCard label="Vault" value={`${totals.vault?.count ?? 0} / ${formatGrams(totals.vault?.weight)}`} />
            <PccKpiCard label="WIP" value={`${totals.wip?.count ?? 0} / ${formatGrams(totals.wip?.weight)}`} />
            <PccKpiCard label="Transit" value={`${totals.transit?.count ?? 0} / ${formatGrams(totals.transit?.weight)}`} />
            <PccKpiCard label="QC" value={`${totals.qc?.count ?? 0} / ${formatGrams(totals.qc?.weight)}`} />
            <PccKpiCard label="Hold" value={`${totals.hold?.count ?? 0} / ${formatGrams(totals.hold?.weight)}`} />
            <PccKpiCard label="Finished" value={`${totals.finished?.count ?? 0} / ${formatGrams(totals.finished?.weight)}`} />
            <PccKpiCard label="Rework" value={`${totals.rework?.count ?? 0} / ${formatGrams(totals.rework?.weight)}`} />
          </div>

          <div className="pcc-panel">
            <div className="pcc-panel-head"><h2>BATCHES ({data?.total ?? 0})</h2></div>
            {!data?.batches?.length ? (
              <PccEmptyState message="No batches in custody view" />
            ) : (
              <div className="pcc-table-wrap">
                <table className="pcc-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Status</th>
                      <th>Metal</th>
                      <th>Weight</th>
                      <th>Department</th>
                      <th>Holder</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.map((b) => (
                      <tr key={b._id} className="pcc-row-click" onClick={() => onSelectBatch?.(b._id)}>
                        <td>
                          <button type="button" className="pcc-link" onClick={(e) => { e.stopPropagation(); onSelectBatch?.(b._id) }}>
                            {b.batchNumber}
                          </button>
                        </td>
                        <td><PccStatusBadge status={b.status} /></td>
                        <td>{b.metalType} {b.purity || ''}</td>
                        <td><PccWeightDisplay grams={b.currentWeight} /></td>
                        <td>{na(b.currentDepartment, '—')}</td>
                        <td>{na(b.currentHolderName, '—')}</td>
                        <td>{formatTime(b.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function DelayMonitorPanel({ onSelectBatch, onToast }) {
  const pccApi = usePccApi()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await pccApi.getDelays()
      setData(d)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load delays')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const thresholds = data?.thresholds || {}

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>DELAY MONITOR</h2>
          <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
        </div>
        <p className="pcc-muted">
          Batch threshold: {thresholds.batchDelayedHours ?? '—'}h · Process threshold: {thresholds.processOverdueHours ?? '—'}h
        </p>
      </div>

      {loading && !data ? <PccSkeleton rows={5} /> : (
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>DELAYS ({data?.total ?? 0})</h2></div>
          {!data?.delays?.length ? (
            <PccEmptyState message="No delayed batches or overdue processes" />
          ) : (
            <div className="pcc-table-wrap">
              <table className="pcc-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Batch</th>
                    <th>Department</th>
                    <th>Process</th>
                    <th>Elapsed (h)</th>
                    <th>Threshold (h)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.delays.map((row, i) => (
                    <tr
                      key={`${row.type}-${row.batchId || row.processRunId || i}`}
                      className="pcc-row-click"
                      onClick={() => row.batchId && onSelectBatch?.(row.batchId)}
                    >
                      <td>{row.type}</td>
                      <td>
                        {row.batchId ? (
                          <button
                            type="button"
                            className="pcc-link"
                            onClick={(e) => { e.stopPropagation(); onSelectBatch?.(row.batchId) }}
                          >
                            {row.batchNumber || String(row.batchId).slice(-6)}
                          </button>
                        ) : (row.batchNumber || '—')}
                      </td>
                      <td>{na(row.department, '—')}</td>
                      <td>{na(row.process, '—')}</td>
                      <td>{row.elapsedHours}</td>
                      <td>{row.thresholdHours}</td>
                      <td><PccStatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ReworkQueuePanel({ onSelectBatch, onNavigate, onToast }) {
  const pccApi = usePccApi()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await pccApi.getReworkQueue({ limit: 50 })
      setData(d)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load rework queue')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>REWORK QUEUE</h2>
          <div className="pcc-row-actions">
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>Open QC</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('processes')}>Open Processes</button>
            <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
          </div>
        </div>
      </div>

      {loading && !data ? <PccSkeleton rows={5} /> : (
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>ITEMS ({data?.total ?? 0})</h2></div>
          {!data?.items?.length ? (
            <PccEmptyState message="No batches in rework" />
          ) : (
            <div className="pcc-table-wrap">
              <table className="pcc-table">
                <thead>
                  <tr>
                    <th>Original QC</th>
                    <th>Rework QC</th>
                    <th>Batch</th>
                    <th>Dept</th>
                    <th>Holder</th>
                    <th>Weight</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.batchId}>
                      <td>
                        {item.originalQc
                          ? `${item.originalQc.inspectionNumber || item.originalQc._id} (${item.originalQc.result})`
                          : '—'}
                      </td>
                      <td>
                        {item.latestQc
                          ? `${item.latestQc.inspectionNumber || item.latestQc._id} (${item.latestQc.result})`
                          : '—'}
                      </td>
                      <td>
                        <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(item.batchId)}>
                          {item.batchNumber}
                        </button>
                      </td>
                      <td>{na(item.department, '—')}</td>
                      <td>{na(item.holderName, '—')}</td>
                      <td><PccWeightDisplay grams={item.weight} /></td>
                      <td>{na(item.latestQc?.reworkReason || item.originalQc?.remarks, '—')}</td>
                      <td className="pcc-actions">
                        <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>QC</button>
                        <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('processes')}>Process</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function MaintenancePanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await pccApi.listMachines()
      const all = d.machines || []
      setRows(all.filter((m) => m.isActive !== false && ['MAINTENANCE', 'FAULT'].includes(String(m.status || '').toUpperCase())))
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load machines')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const save = async (e) => {
    e.preventDefault()
    if (!edit?._id) return
    try {
      if (typeof pccApi.updateMachine === 'function') {
        await pccApi.updateMachine(edit._id, {
          lastMaintenance: edit.lastMaintenance || null,
          nextMaintenance: edit.nextMaintenance || null,
          notes: edit.notes || '',
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : 'Maintenance fields updated')
      } else {
        onToast?.('Maintenance update API not available')
        return
      }
      setEdit(null)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Update failed')
    }
  }

  const toDateInput = (v) => {
    if (!v) return ''
    try {
      return new Date(v).toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>MAINTENANCE</h2>
          <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
        </div>
        <p className="pcc-muted">Machines in MAINTENANCE or FAULT. Edit last/next maintenance and notes.</p>
      </div>

      {loading ? <PccSkeleton rows={4} /> : !rows.length ? (
        <div className="pcc-panel"><PccEmptyState message="No machines in MAINTENANCE or FAULT" /></div>
      ) : (
        <div className="pcc-panel">
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Last</th>
                  <th>Next</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>{m.machineCode}</td>
                    <td>{m.name}</td>
                    <td>{na(m.department, '—')}</td>
                    <td><PccStatusBadge status={m.status} /></td>
                    <td>{formatTime(m.lastMaintenance)}</td>
                    <td>{formatTime(m.nextMaintenance)}</td>
                    <td>{na(m.notes, '—')}</td>
                    <td>
                      <button
                        type="button"
                        className="pcc-btn-ghost"
                        onClick={() => setEdit({
                          _id: m._id,
                          lastMaintenance: toDateInput(m.lastMaintenance),
                          nextMaintenance: toDateInput(m.nextMaintenance),
                          notes: m.notes || '',
                        })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && (
        <form className="pcc-panel pcc-form" onSubmit={save}>
          <div className="pcc-panel-head"><h3>Edit maintenance</h3></div>
          <div className="pcc-form-grid">
            <label>Last maintenance
              <input
                type="date"
                className="pcc-input"
                value={edit.lastMaintenance}
                onChange={(e) => setEdit((s) => ({ ...s, lastMaintenance: e.target.value }))}
              />
            </label>
            <label>Next maintenance
              <input
                type="date"
                className="pcc-input"
                value={edit.nextMaintenance}
                onChange={(e) => setEdit((s) => ({ ...s, nextMaintenance: e.target.value }))}
              />
            </label>
            <label>Notes
              <input
                className="pcc-input"
                value={edit.notes}
                onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))}
              />
            </label>
          </div>
          <div className="pcc-row-actions">
            <button type="submit" className="pcc-btn">Save</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
