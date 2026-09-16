import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { formatTime } from '../shared'
import {
  PccContextDrawer,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { toastMsg } from './panelHelpers'

const PROCESS_TABS = [
  { id: '', label: 'All' },
  { id: 'PENDING', label: 'Waiting' },
  { id: 'IN_PROGRESS', label: 'Active' },
  { id: 'COMPLETED', label: 'History' },
  { id: 'CANCELLED', label: 'Cancelled' },
]

export default function ProcessesPanel({ onToast, onSelectBatch }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('IN_PROGRESS')
  const [startOpen, setStartOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    batchId: '', process: 'Melting', department: 'melting', inputWeight: '', machineId: '',
  })
  const [complete, setComplete] = useState({
    id: '', outputWeight: '', scrap: '0', loss: '0', sopFollowed: 'yes', sopReason: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b, m] = await Promise.all([
        pccApi.listProcesses({ limit: 100, status: statusFilter || undefined }),
        pccApi.listBatches({ limit: 100 }),
        pccApi.listMachines(),
      ])
      setRows(p.processes || [])
      setBatches(b.batches || [])
      setMachines(m.machines || [])
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load processes')
    } finally {
      setLoading(false)
    }
  }, [pccApi, statusFilter, onToast])

  useEffect(() => { load() }, [load])

  const availableMachines = machines.filter((m) => !['FAULT', 'OFFLINE', 'MAINTENANCE'].includes(m.status))
  const activeRows = useMemo(() => rows.filter((r) => r.status === 'IN_PROGRESS'), [rows])
  const waitingRows = useMemo(() => rows.filter((r) => r.status === 'PENDING'), [rows])

  const openStart = (batchPrefill) => {
    if (batchPrefill) {
      setForm((f) => ({
        ...f,
        batchId: String(batchPrefill._id || batchPrefill),
        inputWeight: batchPrefill.currentWeight != null ? String(batchPrefill.currentWeight) : f.inputWeight,
        department: batchPrefill.currentDepartment || f.department,
        process: batchPrefill.currentProcess || f.process,
      }))
    }
    setStartOpen(true)
  }

  const openComplete = (run) => {
    setComplete({
      id: run?._id || '',
      outputWeight: run?.inputWeight != null ? String(run.inputWeight) : '',
      scrap: '0',
      loss: '0',
      sopFollowed: 'yes',
      sopReason: '',
    })
    setCompleteOpen(true)
  }

  const start = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
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
      setStartOpen(false)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Start failed')
    } finally {
      setSubmitting(false)
    }
  }

  const finish = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
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
      setCompleteOpen(false)
      setComplete({ id: '', outputWeight: '', scrap: '0', loss: '0', sopFollowed: 'yes', sopReason: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Complete failed')
    } finally {
      setSubmitting(false)
    }
  }

  const renderTable = (list, emptyMsg) => {
    if (!list.length) return <PccEmptyState message={emptyMsg} />
    return (
      <div className="pcc-table-wrap">
        <table className="pcc-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Batch</th>
              <th>Process</th>
              <th>Department</th>
              <th>Machine</th>
              <th>Operator</th>
              <th>In</th>
              <th>Out</th>
              <th>Started</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id}>
                <td>{r.processNumber}</td>
                <td>
                  {r.batchId ? (
                    <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(r.batchId)}>
                      {r.batchNumber || 'Open'}
                    </button>
                  ) : (r.batchNumber || '—')}
                </td>
                <td>{r.process}</td>
                <td>{r.department || '—'}</td>
                <td>{r.machineName || '—'}</td>
                <td>{r.operatorName || r.startedByName || '—'}</td>
                <td><PccWeightDisplay grams={r.inputWeight} /></td>
                <td>{r.outputWeight == null ? '—' : <PccWeightDisplay grams={r.outputWeight} />}</td>
                <td>{formatTime(r.startTime)}</td>
                <td><PccStatusBadge status={r.status} /></td>
                <td>
                  <div className="pcc-actions">
                    {r.status === 'IN_PROGRESS' ? (
                      <button type="button" className="pcc-btn" onClick={() => openComplete(r)}>Complete</button>
                    ) : null}
                    {r.batchId ? (
                      <button type="button" className="pcc-btn-ghost" onClick={() => onSelectBatch?.(r.batchId)}>Batch</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>PROCESSES</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => openStart()}>+ Start Process</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => setCompleteOpen(true)}>Complete Process</button>
          </div>
        </div>
        <div className="pcc-status-tabs" role="tablist" aria-label="Process status">
          {PROCESS_TABS.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              className={statusFilter === tab.id ? 'active' : ''}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="pcc-panel"><PccSkeleton rows={5} /></div> : (
        <>
          {(statusFilter === '' || statusFilter === 'IN_PROGRESS') && (
            <div className="pcc-panel">
              <div className="pcc-panel-head"><h3>ACTIVE PROCESSES</h3></div>
              {renderTable(statusFilter === 'IN_PROGRESS' ? rows : activeRows, 'No active processes')}
            </div>
          )}
          {(statusFilter === '' || statusFilter === 'PENDING') && (
            <div className="pcc-panel">
              <div className="pcc-panel-head"><h3>WAITING PROCESSES</h3></div>
              {renderTable(statusFilter === 'PENDING' ? rows : waitingRows, 'No waiting processes')}
            </div>
          )}
          {(statusFilter === '' || statusFilter === 'COMPLETED' || statusFilter === 'CANCELLED') && (
            <div className="pcc-panel">
              <div className="pcc-panel-head"><h3>HISTORY</h3></div>
              {renderTable(
                statusFilter === ''
                  ? rows.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED')
                  : rows,
                'No process history',
              )}
            </div>
          )}
        </>
      )}

      <PccContextDrawer open={startOpen} title="Start Process" onClose={() => !submitting && setStartOpen(false)}>
        <form className="pcc-form" onSubmit={start}>
          <div className="pcc-form-grid">
            <label>Batch
              <select required value={form.batchId} onChange={(e) => {
                const batch = batches.find((b) => String(b._id) === e.target.value)
                setForm({
                  ...form,
                  batchId: e.target.value,
                  inputWeight: batch?.currentWeight != null ? String(batch.currentWeight) : form.inputWeight,
                  department: batch?.currentDepartment || form.department,
                })
              }}
              >
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
          <div className="pcc-actions" style={{ marginTop: 12 }}>
            <button type="button" className="pcc-btn-ghost" disabled={submitting} onClick={() => setStartOpen(false)}>Cancel</button>
            <button type="submit" className="pcc-btn" disabled={submitting}>{submitting ? 'Starting…' : 'Start'}</button>
          </div>
        </form>
      </PccContextDrawer>

      <PccContextDrawer open={completeOpen} title="Complete Process" onClose={() => !submitting && setCompleteOpen(false)}>
        <form className="pcc-form" onSubmit={finish}>
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
          <div className="pcc-actions" style={{ marginTop: 12 }}>
            <button type="button" className="pcc-btn-ghost" disabled={submitting} onClick={() => setCompleteOpen(false)}>Cancel</button>
            <button type="submit" className="pcc-btn" disabled={submitting}>{submitting ? 'Saving…' : 'Complete'}</button>
          </div>
        </form>
      </PccContextDrawer>
    </div>
  )
}
