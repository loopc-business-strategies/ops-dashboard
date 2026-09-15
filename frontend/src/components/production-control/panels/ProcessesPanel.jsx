import { useCallback, useEffect, useState } from 'react'
import { usePccApi, useWorkOrdersApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { DEMO_WRITE_MSG } from '../demo/pccApiAdapter'
import { formatGrams, formatTime, canPcc, na, rowsToCsv, downloadCsv } from '../shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { inventoryApi } from '../../../api/operations/inventory'
import { useDebounced, canIssueGate, toastMsg } from './panelHelpers'

export default function ProcessesPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [machines, setMachines] = useState([])
  const [form, setForm] = useState({ batchId: '', process: 'Melting', department: 'melting', inputWeight: '', machineId: '' })
  const [complete, setComplete] = useState({
    id: '', outputWeight: '', scrap: '0', loss: '0', sopFollowed: 'yes', sopReason: '',
  })

  const load = useCallback(async () => {
    const [p, b, m] = await Promise.all([
      pccApi.listProcesses({ limit: 100 }),
      pccApi.listBatches({ limit: 100 }),
      pccApi.listMachines(),
    ])
    setRows(p.processes || [])
    setBatches(b.batches || [])
    setMachines(m.machines || [])
  }, [pccApi])

  useEffect(() => { load().catch(() => {}) }, [load])

  const availableMachines = machines.filter((m) => !['FAULT', 'OFFLINE', 'MAINTENANCE'].includes(m.status))

  const start = async (e) => {
    e.preventDefault()
    try {
      const machine = machines.find((x) => String(x._id) === form.machineId)
      await pccApi.startProcess({
        batchId: form.batchId,
        process: form.process,
        department: form.department,
        inputWeight: form.inputWeight === '' ? undefined : Number(form.inputWeight),
        machineId: form.machineId || undefined,
        machineName: machine?.name || '',
      })
      onToast?.(toastMsg(isDemo, 'Process started'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Start failed')
    }
  }

  const finish = async (e) => {
    e.preventDefault()
    try {
      await pccApi.completeProcess(complete.id, {
        outputWeight: Number(complete.outputWeight),
        scrap: Number(complete.scrap) || 0,
        loss: Number(complete.loss) || 0,
        sopFollowed: complete.sopFollowed === 'yes' ? true : complete.sopFollowed === 'no' ? false : null,
        sopReason: complete.sopFollowed === 'no' ? complete.sopReason : undefined,
        completeIdempotencyKey: `complete-${complete.id}-${Date.now()}`,
      })
      onToast?.(toastMsg(isDemo, 'Process completed'))
      setComplete({ id: '', outputWeight: '', scrap: '0', loss: '0', sopFollowed: 'yes', sopReason: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Complete failed')
    }
  }

  return (
    <div className="pcc-stack">
      <form className="pcc-panel pcc-form" onSubmit={start}>
        <div className="pcc-panel-head"><h2>START PROCESS</h2></div>
        <div className="pcc-form-grid">
          <label>Batch
            <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Select…</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber}</option>)}
            </select>
          </label>
          <label>Process
            <select value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })}>
              {['Melting', 'Casting', 'Rolling', 'Bangle Division', 'Stamping', 'Polishing', 'Quality Control', 'Packing'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>Department
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label>Machine
            <select value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
              <option value="">— Optional —</option>
              {availableMachines.map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.status})</option>
              ))}
            </select>
          </label>
          <label>Input weight (g)
            <input type="number" step="0.001" value={form.inputWeight} onChange={(e) => setForm({ ...form, inputWeight: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="pcc-btn">Start</button>
      </form>

      <form className="pcc-panel pcc-form" onSubmit={finish}>
        <div className="pcc-panel-head"><h2>COMPLETE PROCESS</h2></div>
        <div className="pcc-form-grid">
          <label>In-progress run
            <select required value={complete.id} onChange={(e) => setComplete({ ...complete, id: e.target.value })}>
              <option value="">Select…</option>
              {rows.filter((r) => r.status === 'IN_PROGRESS').map((r) => (
                <option key={r._id} value={r._id}>{r.processNumber} · {r.process}</option>
              ))}
            </select>
          </label>
          <label>Output weight
            <input type="number" step="0.001" required value={complete.outputWeight} onChange={(e) => setComplete({ ...complete, outputWeight: e.target.value })} />
          </label>
          <label>Scrap
            <input type="number" step="0.001" value={complete.scrap} onChange={(e) => setComplete({ ...complete, scrap: e.target.value })} />
          </label>
          <label>Loss
            <input type="number" step="0.001" value={complete.loss} onChange={(e) => setComplete({ ...complete, loss: e.target.value })} />
          </label>
          <label>SOP followed?
            <select value={complete.sopFollowed} onChange={(e) => setComplete({ ...complete, sopFollowed: e.target.value })}>
              <option value="yes">YES</option>
              <option value="no">NO</option>
              <option value="">N/A</option>
            </select>
          </label>
          {complete.sopFollowed === 'no' && (
            <label>SOP reason (required)
              <input required value={complete.sopReason} onChange={(e) => setComplete({ ...complete, sopReason: e.target.value })} />
            </label>
          )}
        </div>
        <button type="submit" className="pcc-btn">Complete</button>
      </form>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>PROCESS HISTORY</h2></div>
        {rows.length === 0 ? <PccEmptyState message="No process runs" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr><th>Run</th><th>Batch</th><th>Process</th><th>In</th><th>Out</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.processNumber}</td>
                    <td>{r.batchNumber}</td>
                    <td>{r.process}</td>
                    <td><PccWeightDisplay grams={r.inputWeight} /></td>
                    <td>{r.outputWeight == null ? '—' : <PccWeightDisplay grams={r.outputWeight} />}</td>
                    <td><PccStatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

