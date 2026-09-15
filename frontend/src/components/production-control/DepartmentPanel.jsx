import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatTime } from './shared'
import { PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge } from './primitives'

const DETAIL_FIELDS = {
  melting: ['recovery', 'metalType', 'purity'],
  casting: ['recovery'],
  rolling: ['thickness', 'recovery'],
  bangle_division: ['bangleType', 'size', 'pieces', 'recovery'],
  stamping: ['stampType', 'rejectedPieces'],
  polishing: ['rejectedPieces'],
  packing: ['packagingType', 'packageNumber'],
  quality_control: [],
}

export default function DepartmentPanel({ deptKey, onToast, onSelectBatch }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState([])
  const [completeForm, setCompleteForm] = useState(null)
  const [startForm, setStartForm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, mach] = await Promise.all([
        pccApi.getDepartment(deptKey),
        pccApi.listMachines().catch(() => ({ machines: [] })),
      ])
      setData(dash)
      setMachines(mach.machines || [])
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load department')
    } finally {
      setLoading(false)
    }
  }, [pccApi, deptKey, onToast])

  useEffect(() => { load() }, [load])

  const startJob = async (e) => {
    e.preventDefault()
    if (!startForm) return
    try {
      await pccApi.startProcess({
        batchId: startForm.batchId,
        process: data?.department?.process || data?.department?.label,
        department: deptKey,
        machineId: startForm.machineId || undefined,
        inputWeight: startForm.inputWeight !== '' ? Number(startForm.inputWeight) : undefined,
        details: startForm.details || {},
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Process started')
      setStartForm(null)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Start failed')
    }
  }

  const completeJob = async (e) => {
    e.preventDefault()
    if (!completeForm) return
    try {
      await pccApi.completeProcess(completeForm.processRunId, {
        outputWeight: Number(completeForm.outputWeight),
        scrap: Number(completeForm.scrap) || 0,
        loss: Number(completeForm.loss) || 0,
        remarks: completeForm.remarks || '',
        details: completeForm.details || {},
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Process completed')
      setCompleteForm(null)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Complete failed')
    }
  }

  if (loading && !data) return <div className="pcc-panel"><PccSkeleton rows={6} /></div>
  const kpis = data?.kpis || {}
  const dept = data?.department || { label: deptKey, status: 'IDLE' }
  const fields = DETAIL_FIELDS[deptKey] || []

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>{String(dept.label || deptKey).toUpperCase()}</h2>
          <PccStatusBadge status={dept.status} />
        </div>
      </div>

      <div className="pcc-kpi-row">
        <PccKpiCard label="Waiting" value={kpis.waitingJobs ?? 0} />
        <PccKpiCard label="Active" value={kpis.activeJobs ?? 0} />
        <PccKpiCard label="Completed today" value={kpis.completedToday ?? 0} />
        <PccKpiCard label="Pending" value={kpis.pendingJobs ?? 0} />
        <PccKpiCard label="Input wt" value={formatGrams(kpis.totalInputWeight)} />
        <PccKpiCard label="Output wt" value={formatGrams(kpis.totalOutputWeight)} />
        <PccKpiCard label="Scrap" value={formatGrams(kpis.scrap)} />
        <PccKpiCard label="Loss" value={formatGrams(kpis.loss)} />
        <PccKpiCard label="Recovery" value={formatGrams(kpis.recovery)} />
        <PccKpiCard label="Operators" value={kpis.operators ?? 0} />
        <PccKpiCard label="Machines" value={kpis.machines ?? 0} />
        <PccKpiCard label="Alerts" value={kpis.alerts ?? 0} />
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>JOBS</h2>
          <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
        </div>
        {!data?.jobs?.length ? (
          <PccEmptyState message="No jobs in this department" />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th><th>Stock</th><th>Product</th><th>In</th><th>Out</th>
                  <th>Operator</th><th>Machine</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.processRunId || `${j.batchId}-${j.processNumber}`}>
                    <td>
                      <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(j.batchId)}>
                        {j.batchCode}
                      </button>
                    </td>
                    <td>{j.stockCode || '—'}</td>
                    <td>{j.product || '—'}</td>
                    <td>{formatGrams(j.inputWeight)}</td>
                    <td>{formatGrams(j.outputWeight)}</td>
                    <td>{j.operator || '—'}</td>
                    <td>{j.machine || '—'}</td>
                    <td>{formatTime(j.startTime)}</td>
                    <td>{formatTime(j.endTime)}</td>
                    <td><PccStatusBadge status={j.status} /></td>
                    <td>
                      {j.status === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          className="pcc-btn-ghost"
                          onClick={() => setCompleteForm({
                            processRunId: j.processRunId,
                            outputWeight: j.inputWeight || '',
                            scrap: 0,
                            loss: 0,
                            remarks: '',
                            details: {},
                          })}
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(data?.waitingBatches || []).length > 0 && (
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>WAITING BATCHES</h2></div>
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr><th>Batch</th><th>Stock</th><th>Product</th><th>Weight</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {data.waitingBatches.map((b) => (
                  <tr key={b._id}>
                    <td>{b.batchNumber}</td>
                    <td>{b.stockCode || '—'}</td>
                    <td>{b.product || '—'}</td>
                    <td>{formatGrams(b.currentWeight)}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="pcc-btn"
                        onClick={() => setStartForm({
                          batchId: b._id,
                          inputWeight: b.currentWeight || '',
                          machineId: '',
                          details: {},
                        })}
                      >
                        Start
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {startForm && (
        <form className="pcc-panel pcc-form" onSubmit={startJob}>
          <h3>Start process</h3>
          <label>Input weight (g)
            <input className="pcc-input" type="number" step="any" value={startForm.inputWeight}
              onChange={(e) => setStartForm((s) => ({ ...s, inputWeight: e.target.value }))} />
          </label>
          <label>Machine
            <select className="pcc-input" value={startForm.machineId}
              onChange={(e) => setStartForm((s) => ({ ...s, machineId: e.target.value }))}>
              <option value="">—</option>
              {machines.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </label>
          {fields.map((f) => (
            <label key={f}>{f}
              <input className="pcc-input" value={startForm.details?.[f] || ''}
                onChange={(e) => setStartForm((s) => ({
                  ...s,
                  details: { ...s.details, [f]: e.target.value },
                }))} />
            </label>
          ))}
          <div className="pcc-row-actions">
            <button type="submit" className="pcc-btn">Start</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => setStartForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {completeForm && (
        <form className="pcc-panel pcc-form" onSubmit={completeJob}>
          <h3>Complete process</h3>
          <label>Output weight (g)
            <input className="pcc-input" type="number" step="any" required value={completeForm.outputWeight}
              onChange={(e) => setCompleteForm((s) => ({ ...s, outputWeight: e.target.value }))} />
          </label>
          <label>Scrap
            <input className="pcc-input" type="number" step="any" value={completeForm.scrap}
              onChange={(e) => setCompleteForm((s) => ({ ...s, scrap: e.target.value }))} />
          </label>
          <label>Loss
            <input className="pcc-input" type="number" step="any" value={completeForm.loss}
              onChange={(e) => setCompleteForm((s) => ({ ...s, loss: e.target.value }))} />
          </label>
          {fields.map((f) => (
            <label key={f}>{f}
              <input className="pcc-input" value={completeForm.details?.[f] || ''}
                onChange={(e) => setCompleteForm((s) => ({
                  ...s,
                  details: { ...s.details, [f]: e.target.value },
                }))} />
            </label>
          ))}
          <label>Remarks
            <input className="pcc-input" value={completeForm.remarks}
              onChange={(e) => setCompleteForm((s) => ({ ...s, remarks: e.target.value }))} />
          </label>
          <div className="pcc-row-actions">
            <button type="submit" className="pcc-btn">Complete</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => setCompleteForm(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
