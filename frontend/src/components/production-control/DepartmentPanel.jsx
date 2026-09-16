import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatTime } from './shared'
import {
  PccContextDrawer,
  PccEmptyState,
  PccKpiCard,
  PccSkeleton,
  PccStatusBadge,
} from './primitives'

const DETAIL_FIELDS = {
  melting: ['recovery', 'metalType', 'purity', 'alloyAdded', 'alloyWeight', 'purityBefore', 'purityAfter', 'furnace'],
  casting: ['mouldType', 'castTemperature', 'pieces', 'recovery', 'remarks'],
  rolling: ['thickness', 'width', 'passes', 'recovery'],
  bangle_division: ['bangleType', 'size', 'pieces', 'recovery', 'scrapPieces'],
  stamping: ['stampType', 'designCode', 'pieces', 'rejectedPieces'],
  polishing: ['polishType', 'media', 'rejectedPieces', 'recovery'],
  packing: ['packagingType', 'packageNumber', 'pieces', 'labelCode'],
  quality_control: [],
}

export default function DepartmentPanel({ deptKey, onToast, onSelectBatch }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState([])
  const [shift, setShift] = useState(null)
  const [completeForm, setCompleteForm] = useState(null)
  const [startForm, setStartForm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, mach, shiftRes] = await Promise.all([
        pccApi.getDepartment(deptKey),
        pccApi.listMachines().catch(() => ({ machines: [] })),
        typeof pccApi.getCurrentShift === 'function'
          ? pccApi.getCurrentShift().catch(() => null)
          : Promise.resolve(null),
      ])
      setData(dash)
      setMachines(mach.machines || [])
      setShift(shiftRes?.current || shiftRes || null)
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

  const activeJobs = useMemo(
    () => (data?.jobs || []).filter((j) => j.status === 'IN_PROGRESS'),
    [data],
  )
  const waitingBatches = data?.waitingBatches || []
  const fields = DETAIL_FIELDS[deptKey] || []

  if (loading && !data) return <div className="pcc-panel"><PccSkeleton rows={6} /></div>
  const kpis = data?.kpis || {}
  const dept = data?.department || { label: deptKey, status: 'IDLE' }
  const shiftLabel = shift?.name || shift?.shiftName
  const shiftWindow = shift
    ? `${shift.startLabel || shift.startTime || '—'} → ${shift.endLabel || shift.endTime || '—'}`
    : null

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <div>
            <h2>{String(dept.label || deptKey).toUpperCase()}</h2>
            {shiftLabel ? (
              <p className="pcc-muted" style={{ margin: '4px 0 0' }}>
                {shiftLabel}{shiftWindow ? ` · ${shiftWindow}` : ''}
              </p>
            ) : null}
          </div>
          <div className="pcc-actions">
            <PccStatusBadge status={dept.status} />
            <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
          </div>
        </div>
      </div>

      <div className="pcc-kpi-row pcc-dept-kpi-primary">
        <PccKpiCard label="Waiting" value={kpis.waitingJobs ?? 0} />
        <PccKpiCard label="Active" value={kpis.activeJobs ?? 0} />
        <PccKpiCard label="Completed" value={kpis.completedToday ?? 0} />
        <PccKpiCard label="Alerts" value={kpis.alerts ?? 0} />
      </div>
      <div className="pcc-kpi-row pcc-kpi-row-secondary">
        <PccKpiCard label="Input" value={formatGrams(kpis.totalInputWeight)} />
        <PccKpiCard label="Output" value={formatGrams(kpis.totalOutputWeight)} />
        <PccKpiCard label="Scrap" value={formatGrams(kpis.scrap)} />
        <PccKpiCard label="Loss" value={formatGrams(kpis.loss)} />
        <PccKpiCard label="Recovery" value={formatGrams(kpis.recovery)} />
        <PccKpiCard label="Operators" value={kpis.operators ?? 0} />
        <PccKpiCard label="Machines" value={kpis.machines ?? 0} />
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>ACTIVE JOBS</h2></div>
        {!activeJobs.length ? (
          <PccEmptyState
            message="No active jobs"
            hint="Start a waiting batch to begin work in this department."
          />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th><th>Stock</th><th>Product</th><th>In</th><th>Out</th>
                  <th>Operator</th><th>Machine</th><th>Start</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeJobs.map((j) => (
                  <tr key={j.processRunId || `${j.batchId}-${j.processNumber}`}>
                    <td>
                      {j.batchId ? (
                        <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(j.batchId)}>
                          {j.batchCode || 'Open'}
                        </button>
                      ) : (j.batchCode || '—')}
                    </td>
                    <td>{j.stockCode || '—'}</td>
                    <td>{j.product || '—'}</td>
                    <td>{formatGrams(j.inputWeight)}</td>
                    <td>{formatGrams(j.outputWeight)}</td>
                    <td>{j.operator || '—'}</td>
                    <td>{j.machine || '—'}</td>
                    <td>{formatTime(j.startTime)}</td>
                    <td><PccStatusBadge status={j.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="pcc-btn"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>WAITING BATCHES</h2></div>
        {!waitingBatches.length ? (
          <PccEmptyState
            message="No waiting batches"
            hint="Batches arrive here when issued or handed over to this department."
          />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr><th>Batch</th><th>Stock</th><th>Product</th><th>Weight</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {waitingBatches.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(b._id)}>
                        {b.batchNumber}
                      </button>
                    </td>
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
        )}
      </div>

      <PccContextDrawer
        open={!!startForm}
        title="Start process"
        onClose={() => setStartForm(null)}
      >
        {startForm ? (
          <form className="pcc-form" onSubmit={startJob}>
            <div className="pcc-form-grid">
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
            </div>
            <div className="pcc-row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="pcc-btn-ghost" onClick={() => setStartForm(null)}>Cancel</button>
              <button type="submit" className="pcc-btn">Start</button>
            </div>
          </form>
        ) : null}
      </PccContextDrawer>

      <PccContextDrawer
        open={!!completeForm}
        title="Complete process"
        onClose={() => setCompleteForm(null)}
      >
        {completeForm ? (
          <form className="pcc-form" onSubmit={completeJob}>
            <div className="pcc-form-grid">
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
            </div>
            <div className="pcc-row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="pcc-btn-ghost" onClick={() => setCompleteForm(null)}>Cancel</button>
              <button type="submit" className="pcc-btn">Complete</button>
            </div>
          </form>
        ) : null}
      </PccContextDrawer>
    </div>
  )
}
