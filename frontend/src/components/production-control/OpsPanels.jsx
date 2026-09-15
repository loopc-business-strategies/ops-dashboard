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
  const [workOrders, setWorkOrders] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    machineId: '',
    type: 'PREVENTIVE',
    title: '',
    technicianName: '',
    scheduledAt: '',
    nextMaintenanceAt: '',
    notes: '',
    setMachineStatus: 'MAINTENANCE',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [woRes, machRes] = await Promise.all([
        typeof pccApi.listMaintenance === 'function' ? pccApi.listMaintenance() : Promise.resolve({ workOrders: [] }),
        pccApi.listMachines(),
      ])
      setWorkOrders(woRes.workOrders || [])
      setMachines((machRes.machines || []).filter((m) => m.isActive !== false))
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load maintenance')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!form.machineId) {
      onToast?.('Select a machine')
      return
    }
    try {
      await pccApi.createMaintenance({
        machineId: form.machineId,
        type: form.type,
        title: form.title,
        technicianName: form.technicianName,
        scheduledAt: form.scheduledAt || undefined,
        nextMaintenanceAt: form.nextMaintenanceAt || undefined,
        notes: form.notes,
        setMachineStatus: form.setMachineStatus || undefined,
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Maintenance work order created')
      setCreateOpen(false)
      setForm({
        machineId: '',
        type: 'PREVENTIVE',
        title: '',
        technicianName: '',
        scheduledAt: '',
        nextMaintenanceAt: '',
        notes: '',
        setMachineStatus: 'MAINTENANCE',
      })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Create failed')
    }
  }

  const complete = async (id) => {
    try {
      await pccApi.completeMaintenance(id, { machineStatus: 'IDLE' })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Maintenance completed')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Complete failed')
    }
  }

  const evaluate = async () => {
    try {
      const res = await pccApi.evaluateMaintenanceOverdue()
      onToast?.(isDemo ? DEMO_WRITE_MSG : `Overdue check: ${(res.alerts || []).length} alert(s)`)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Evaluate failed')
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>MAINTENANCE</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => setCreateOpen((v) => !v)}>
              {createOpen ? 'Cancel' : 'New work order'}
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={evaluate}>Evaluate overdue</button>
            <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
          </div>
        </div>
        <p className="pcc-muted">Preventive and breakdown work orders. Completing a WO updates machine last/next maintenance.</p>
      </div>

      {createOpen && (
        <form className="pcc-panel pcc-form" onSubmit={create}>
          <div className="pcc-panel-head"><h3>New maintenance WO</h3></div>
          <div className="pcc-form-grid">
            <label>
              Machine
              <select
                className="pcc-input"
                value={form.machineId}
                onChange={(e) => setForm((s) => ({ ...s, machineId: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {machines.map((m) => (
                  <option key={m._id} value={m._id}>{m.machineCode} — {m.name}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                className="pcc-input"
                value={form.type}
                onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
              >
                <option value="PREVENTIVE">PREVENTIVE</option>
                <option value="BREAKDOWN">BREAKDOWN</option>
                <option value="CORRECTIVE">CORRECTIVE</option>
                <option value="INSPECTION">INSPECTION</option>
              </select>
            </label>
            <label>
              Title
              <input className="pcc-input" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
            </label>
            <label>
              Technician
              <input className="pcc-input" value={form.technicianName} onChange={(e) => setForm((s) => ({ ...s, technicianName: e.target.value }))} />
            </label>
            <label>
              Scheduled
              <input type="date" className="pcc-input" value={form.scheduledAt} onChange={(e) => setForm((s) => ({ ...s, scheduledAt: e.target.value }))} />
            </label>
            <label>
              Next due
              <input type="date" className="pcc-input" value={form.nextMaintenanceAt} onChange={(e) => setForm((s) => ({ ...s, nextMaintenanceAt: e.target.value }))} />
            </label>
            <label>
              Set machine status
              <select className="pcc-input" value={form.setMachineStatus} onChange={(e) => setForm((s) => ({ ...s, setMachineStatus: e.target.value }))}>
                <option value="">(no change)</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="FAULT">FAULT</option>
                <option value="IDLE">IDLE</option>
              </select>
            </label>
            <label>
              Notes
              <input className="pcc-input" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            </label>
          </div>
          <button type="submit" className="pcc-btn">Create</button>
        </form>
      )}

      {loading ? <PccSkeleton rows={4} /> : !workOrders.length ? (
        <div className="pcc-panel"><PccEmptyState message="No maintenance work orders" /></div>
      ) : (
        <div className="pcc-panel">
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>WO</th>
                  <th>Machine</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Technician</th>
                  <th>Scheduled</th>
                  <th>Next</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo._id}>
                    <td>{wo.woNumber}</td>
                    <td>{wo.machineCode || wo.machineName}</td>
                    <td>{wo.type}</td>
                    <td><PccStatusBadge status={wo.status} /></td>
                    <td>{na(wo.technicianName, '—')}</td>
                    <td>{formatTime(wo.scheduledAt)}</td>
                    <td>{formatTime(wo.nextMaintenanceAt)}</td>
                    <td>
                      {wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' && (
                        <button type="button" className="pcc-btn-ghost" onClick={() => complete(wo._id)}>Complete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

