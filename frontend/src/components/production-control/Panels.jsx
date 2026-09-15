import { useCallback, useEffect, useState } from 'react'
import { usePccApi, useWorkOrdersApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatTime, canPcc, na, rowsToCsv, downloadCsv } from './shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from './primitives'
import { inventoryApi } from '../../api/operations/inventory'

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function canIssueGate(batch) {
  return Boolean(batch && ['CREATED', 'AWAITING_ISSUE'].includes(batch.status))
}

function toastMsg(isDemo, fallback, res) {
  if (isDemo) return DEMO_WRITE_MSG
  return res?.message || fallback
}

export function BatchesPanel({ onSelectBatch, onToast }) {
  const pccApi = usePccApi()
  const workOrdersApi = useWorkOrdersApi()
  const { isDemo } = useDemoMode()
  const [batches, setBatches] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [department, setDepartment] = useState('')
  const [workOrders, setWorkOrders] = useState([])
  const [form, setForm] = useState({
    metalType: 'Gold',
    purity: '18K',
    initialWeight: '',
    product: '',
    purpose: '',
    workOrderId: '',
  })
  const debouncedSearch = useDebounced(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await pccApi.listBatches({
        search: debouncedSearch || undefined,
        status: status || undefined,
        department: department || undefined,
        limit: 50,
      })
      setBatches(data.batches || [])
      setTotal(data.total ?? (data.batches || []).length)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, department, onToast, pccApi])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    workOrdersApi.getWorkOrders({ limit: 50, page: 1 })
      .then((d) => setWorkOrders(d.workOrders || []))
      .catch(() => {})
  }, [workOrdersApi])

  const create = async (e) => {
    e.preventDefault()
    try {
      const wo = workOrders.find((w) => String(w._id) === form.workOrderId)
      await pccApi.createBatch({
        metalType: form.metalType,
        purity: form.purity,
        initialWeight: Number(form.initialWeight),
        product: form.product,
        purpose: form.purpose,
        workOrderId: form.workOrderId || null,
        workOrderNumber: wo?.woNumber || '',
        idempotencyKey: `ui-batch-${Date.now()}`,
      })
      onToast?.(toastMsg(isDemo, 'Batch created'))
      setForm((f) => ({ ...f, initialWeight: '', product: '', purpose: '', workOrderId: '' }))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Create failed')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setDepartment('')
  }

  return (
    <div className="pcc-stack">
      <form className="pcc-panel pcc-form" onSubmit={create}>
        <div className="pcc-panel-head"><h2>CREATE BATCH</h2></div>
        <div className="pcc-form-grid">
          <label>Metal
            <select value={form.metalType} onChange={(e) => setForm({ ...form, metalType: e.target.value })}>
              {['Gold', 'Silver', 'Platinum', 'Other'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>Purity
            <select value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })}>
              {['', '14K', '18K', '22K', '24K'].map((p) => <option key={p || 'none'} value={p}>{p || '—'}</option>)}
            </select>
          </label>
          <label>Initial weight (g)
            <input type="number" step="0.001" min="0" required value={form.initialWeight}
              onChange={(e) => setForm({ ...form, initialWeight: e.target.value })} />
          </label>
          <label>Product
            <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </label>
          <label>Purpose
            <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </label>
          <label>Work order (optional)
            <select value={form.workOrderId} onChange={(e) => setForm({ ...form, workOrderId: e.target.value })}>
              <option value="">— None —</option>
              {workOrders.map((wo) => (
                <option key={wo._id} value={wo._id}>{wo.woNumber}{wo.product ? ` · ${wo.product}` : ''}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="pcc-btn">Create batch</button>
      </form>

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>BATCHES</h2>
          <span>{total} total</span>
        </div>
        <div className="pcc-toolbar">
          <label>Search
            <input type="search" placeholder="Batch, WO, product, holder…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'IN_TRANSIT', 'RECEIVED', 'IN_PROCESS', 'WAITING', 'QC', 'QC_FAILED', 'REWORK', 'HOLD', 'COMPLETED', 'RETURNED_TO_VAULT'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. polishing" />
          </label>
          {(search || status || department) && (
            <button type="button" className="pcc-btn-ghost" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
        {loading ? <PccSkeleton rows={4} /> : batches.length === 0 ? (
          <PccEmptyState message="No batches" />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th><th>WO</th><th>Product</th><th>Metal</th><th>Weight</th><th>Process</th>
                  <th>Department</th><th>Operator</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id}>
                    <td>{b.batchNumber}</td>
                    <td>{b.workOrderNumber || '—'}</td>
                    <td>{b.product || '—'}</td>
                    <td>{b.metalType} {b.purity}</td>
                    <td><PccWeightDisplay grams={b.currentWeight} /></td>
                    <td>{b.currentProcess || '—'}</td>
                    <td>{b.currentDepartment}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                    <td><button type="button" className="pcc-btn-ghost" onClick={() => onSelectBatch(b._id)}>Open</button></td>
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

export function PassesPanel({ onToast, productionRole }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [passes, setPasses] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({
    batchId: '', fromDepartment: '', toDepartment: 'melting', weight: '', purpose: '',
  })
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [receiveDlg, setReceiveDlg] = useState(null)
  const [receiveForm, setReceiveForm] = useState({ receivedWeight: '', varianceReason: '' })

  const selectedBatch = batches.find((b) => String(b._id) === String(form.batchId))

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([
        pccApi.listPasses({ limit: 100 }),
        pccApi.listBatches({ limit: 100 }),
      ])
      setPasses(p.passes || [])
      setBatches(b.batches || [])
    } catch {
      onToast?.('Failed to load passes')
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (selectedBatch) {
      setForm((f) => ({
        ...f,
        fromDepartment: selectedBatch.currentDepartment || selectedBatch.currentLocation || 'vault',
        weight: f.weight || String(selectedBatch.currentWeight || ''),
      }))
    }
  }, [selectedBatch?._id])

  const create = async (e) => {
    e.preventDefault()
    try {
      await pccApi.createPass({
        ...form,
        fromDepartment: form.fromDepartment || selectedBatch?.currentDepartment || 'vault',
        weight: Number(form.weight),
        idempotencyKey: `ui-pass-${Date.now()}`,
      })
      onToast?.(toastMsg(isDemo, 'Pass created'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  const act = async (id, action) => {
    try {
      if (action === 'approve') await pccApi.approvePass(id)
      if (action === 'issue') await pccApi.issuePass(id)
      onToast?.(toastMsg(isDemo, `Pass ${action} OK`))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  const openReceive = (p) => {
    setReceiveDlg(p)
    setReceiveForm({ receivedWeight: String(p.weight ?? ''), varianceReason: '' })
  }

  const confirmReceive = async () => {
    if (!receiveDlg) return
    const issued = Number(receiveDlg.weight)
    const rw = Number(receiveForm.receivedWeight)
    const variancePct = issued > 0 ? (Math.abs(rw - issued) / issued) * 100 : 0
    try {
      await pccApi.receivePass(receiveDlg._id, {
        receivedWeight: rw,
        varianceReason: receiveForm.varianceReason || undefined,
        receiveIdempotencyKey: `recv-${receiveDlg._id}-${Date.now()}`,
      })
      onToast?.(toastMsg(isDemo, variancePct > 0.5 ? `Received with ${variancePct.toFixed(2)}% variance` : 'Pass received'))
      setReceiveDlg(null)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Receive failed')
    }
  }

  const doCancel = async () => {
    if (!confirmCancel) return
    const id = confirmCancel._id
    setConfirmCancel(null)
    try {
      await pccApi.cancelPass(id)
      onToast?.(toastMsg(isDemo, 'Pass cancelled'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Cancel failed')
    }
  }

  const canCreate = !productionRole || canPcc(productionRole, 'createPass')
  const canApprove = !productionRole || canPcc(productionRole, 'approvePass')
  const canIssue = !productionRole || canPcc(productionRole, 'issueMetal')
  const canReceive = !productionRole || canPcc(productionRole, 'receivePass')

  const issuedW = receiveDlg ? Number(receiveDlg.weight) : 0
  const recvW = Number(receiveForm.receivedWeight)
  const recvVarPct = Number.isFinite(issuedW) && issuedW > 0 && Number.isFinite(recvW)
    ? (Math.abs(recvW - issuedW) / issuedW) * 100
    : 0

  return (
    <div className="pcc-stack">
      {canCreate && (
        <form className="pcc-panel pcc-form" onSubmit={create}>
          <div className="pcc-panel-head"><h2>CREATE PASS / HANDOVER</h2></div>
          <div className="pcc-form-grid">
            <label>Batch
              <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                <option value="">Select…</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.batchNumber} · {b.currentDepartment || '—'} · {formatGrams(b.currentWeight)}
                  </option>
                ))}
              </select>
            </label>
            <label>From (batch location — verified by server)
              <input
                value={form.fromDepartment}
                readOnly
                title="Derived from batch current department"
              />
            </label>
            <label>To department
              <input required value={form.toDepartment} onChange={(e) => setForm({ ...form, toDepartment: e.target.value })} />
            </label>
            <label>Weight (g)
              <input type="number" step="0.001" required value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </label>
            <label>Purpose
              <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="pcc-btn">Create pass</button>
        </form>
      )}

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>HANDOVERS</h2></div>
        {passes.length === 0 ? <PccEmptyState message="No pending handovers" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Pass</th><th>Batch</th><th>From</th><th>To</th>
                  <th>Issued</th><th>Received</th><th>Variance</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p) => {
                  const vAbs = p.varianceAbs != null ? p.varianceAbs : (p.receivedWeight != null ? Math.abs(Number(p.receivedWeight) - Number(p.weight)) : null)
                  const vPct = p.variancePct != null ? p.variancePct : (p.weight > 0 && p.receivedWeight != null
                    ? (Math.abs(Number(p.receivedWeight) - Number(p.weight)) / Number(p.weight)) * 100
                    : null)
                  return (
                    <tr key={p._id}>
                      <td>{p.passNumber}</td>
                      <td>{p.batchNumber}</td>
                      <td>{p.fromDepartment}<div className="pcc-muted">{p.fromPersonName || '—'}</div></td>
                      <td>{p.toDepartment}<div className="pcc-muted">{p.toPersonName || '—'}</div></td>
                      <td><PccWeightDisplay grams={p.weight} /></td>
                      <td>{p.receivedWeight != null ? <PccWeightDisplay grams={p.receivedWeight} /> : '—'}</td>
                      <td>{vPct != null ? `${Number(vPct).toFixed(2)}% (${formatGrams(vAbs)})` : '—'}</td>
                      <td><PccStatusBadge status={p.status} /></td>
                      <td className="pcc-actions">
                        {p.status === 'REQUESTED' && canApprove && (
                          <button type="button" className="pcc-btn-ghost" onClick={() => act(p._id, 'approve')}>Approve</button>
                        )}
                        {['REQUESTED', 'APPROVED'].includes(p.status) && canIssue && (
                          <button type="button" className="pcc-btn-ghost" onClick={() => act(p._id, 'issue')}>Issue</button>
                        )}
                        {['ISSUED', 'IN_TRANSIT'].includes(p.status) && canReceive && (
                          <button type="button" className="pcc-btn" onClick={() => openReceive(p)}>Receive</button>
                        )}
                        {!['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(p.status) && canApprove && (
                          <button type="button" className="pcc-btn-ghost" onClick={() => setConfirmCancel(p)}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PccConfirmDialog
        open={!!confirmCancel}
        title="Cancel pass?"
        message={confirmCancel ? `Cancel ${confirmCancel.passNumber} for batch ${confirmCancel.batchNumber}?` : ''}
        confirmLabel="Cancel pass"
        danger
        onCancel={() => setConfirmCancel(null)}
        onConfirm={doCancel}
      />

      <PccConfirmDialog
        open={!!receiveDlg}
        title={receiveDlg ? `Confirm receive ${receiveDlg.passNumber}` : 'Confirm receive'}
        message={
          receiveDlg
            ? `Confirm receipt of metal for ${receiveDlg.batchNumber}. Issued ${formatGrams(receiveDlg.weight)}.`
            : ''
        }
        confirmLabel="Confirm receive"
        onCancel={() => setReceiveDlg(null)}
        onConfirm={confirmReceive}
        details={(
          <div className="pcc-form-grid">
            <label>Received weight (g)
              <input
                type="number"
                step="0.001"
                min="0"
                value={receiveForm.receivedWeight}
                onChange={(e) => setReceiveForm({ ...receiveForm, receivedWeight: e.target.value })}
              />
            </label>
            {recvVarPct > 0.01 && (
              <label>
                Variance {recvVarPct.toFixed(2)}% — reason {recvVarPct > 0.5 ? '(required if over tolerance)' : ''}
                <input
                  value={receiveForm.varianceReason}
                  onChange={(e) => setReceiveForm({ ...receiveForm, varianceReason: e.target.value })}
                  placeholder="Reason for weight difference"
                />
              </label>
            )}
          </div>
        )}
      />
    </div>
  )
}

export function MovementsPanel({ onToast }) {
  const pccApi = usePccApi()
  const [rows, setRows] = useState([])
  useEffect(() => {
    pccApi.listMovements({ limit: 100 })
      .then((d) => setRows(d.movements || []))
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load movements'))
  }, [pccApi, onToast])
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>METAL MOVEMENTS</h2></div>
      {rows.length === 0 ? <PccEmptyState message="No metal movements" /> : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead>
              <tr><th>Movement</th><th>Batch</th><th>From</th><th>To</th><th>Weight</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m._id}>
                  <td>{m.movementNumber}</td>
                  <td>{m.batchNumber}</td>
                  <td>{m.fromDepartment} / {m.fromPersonName || '—'}</td>
                  <td>{m.toDepartment} / {m.toPersonName || '—'}</td>
                  <td><PccWeightDisplay grams={m.weight} /></td>
                  <td><PccStatusBadge status={m.status} /></td>
                  <td>{formatTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ProcessesPanel({ onToast }) {
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

export function QcPanel({ onToast, onNavigate }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({ batchId: '', result: 'PASS', remarks: '', failureReason: '' })
  const [confirm, setConfirm] = useState(null)
  const [lastPassBatchId, setLastPassBatchId] = useState(null)

  const load = useCallback(async () => {
    const [q, b] = await Promise.all([
      pccApi.listQc({ limit: 100 }),
      pccApi.listBatches({ limit: 100 }),
    ])
    setRows(q.inspections || [])
    setBatches(b.batches || [])
  }, [pccApi])

  useEffect(() => { load().catch(() => {}) }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (['FAIL', 'REWORK'].includes(form.result)) {
      setConfirm({ ...form })
      return
    }
    await doSubmit(form)
  }

  const doSubmit = async (payload) => {
    try {
      const res = await pccApi.submitQc({
        ...payload,
        failureReason: payload.result === 'FAIL' ? (payload.failureReason || payload.remarks) : payload.failureReason,
        idempotencyKey: `qc-${payload.batchId}-${Date.now()}`,
      })
      onToast?.(toastMsg(isDemo, res?.message || 'QC submitted'))
      setConfirm(null)
      if (payload.result === 'PASS') {
        setLastPassBatchId(payload.batchId)
        onToast?.(isDemo ? DEMO_WRITE_MSG : 'QC PASS — batch sent to Packaging')
      }
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'QC failed')
    }
  }

  return (
    <div className="pcc-stack">
      <form className="pcc-panel pcc-form" onSubmit={submit}>
        <div className="pcc-panel-head"><h2>QC INSPECTION</h2></div>
        <div className="pcc-form-grid">
          <label>Batch
            <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Select…</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber}</option>)}
            </select>
          </label>
          <label>Result
            <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
              {['PASS', 'FAIL', 'HOLD', 'REWORK'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label>Remarks
            <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </label>
          {form.result === 'FAIL' && (
            <label>Failure reason
              <input value={form.failureReason} onChange={(e) => setForm({ ...form, failureReason: e.target.value })} />
            </label>
          )}
        </div>
        <button type="submit" className="pcc-btn">Submit QC</button>
        {lastPassBatchId && (
          <button
            type="button"
            className="pcc-btn-ghost"
            onClick={() => onNavigate?.('dept-packing')}
          >
            Open Packaging
          </button>
        )}
      </form>
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>QC HISTORY</h2></div>
        {rows.length === 0 ? <PccEmptyState message="No QC records" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Inspection</th><th>Batch</th><th>Result</th><th>Inspector</th><th>When</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.inspectionNumber}</td>
                    <td>{r.batchNumber}</td>
                    <td><PccStatusBadge status={r.result} /></td>
                    <td>{r.inspectorName}</td>
                    <td>{formatTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PccConfirmDialog
        open={!!confirm}
        title={`Confirm QC ${confirm?.result}?`}
        message={confirm ? `Mark selected batch as ${confirm.result}. This updates batch status.` : ''}
        confirmLabel={`Submit ${confirm?.result || 'QC'}`}
        danger={confirm?.result === 'FAIL'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => doSubmit(confirm)}
      />
    </div>
  )
}

export function MachinesPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ machineCode: '', name: '', department: '', process: '' })

  const load = useCallback(async () => {
    const d = await pccApi.listMachines()
    setRows(d.machines || [])
  }, [pccApi])

  useEffect(() => { load().catch(() => {}) }, [load])

  const create = async (e) => {
    e.preventDefault()
    try {
      await pccApi.createMachine(form)
      onToast?.(toastMsg(isDemo, 'Machine added'))
      setForm({ machineCode: '', name: '', department: '', process: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  const setStatus = async (id, status) => {
    try {
      await pccApi.updateMachineStatus(id, { status })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Status update failed')
    }
  }

  return (
    <div className="pcc-stack">
      <form className="pcc-panel pcc-form" onSubmit={create}>
        <div className="pcc-panel-head"><h2>ADD MACHINE</h2></div>
        <div className="pcc-form-grid">
          <label>
            Code
            <input required value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} />
          </label>
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Department
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label>
            Process
            <input value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="pcc-btn">Add</button>
      </form>
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>MACHINES</h2></div>
        {rows.length === 0 ? <PccEmptyState message="No machines registered" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Code</th><th>Name</th><th>Dept</th><th>Status</th><th>Batch</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>{m.machineCode}</td>
                    <td>{m.name}</td>
                    <td>{m.department || '—'}</td>
                    <td><PccStatusBadge status={m.status} /></td>
                    <td>{m.currentBatchNumber || '—'}</td>
                    <td className="pcc-actions">
                      {['RUNNING', 'IDLE', 'STOPPED', 'MAINTENANCE', 'FAULT', 'OFFLINE'].map((s) => (
                        <button key={s} type="button" className="pcc-btn-ghost" onClick={() => setStatus(m._id, s)}>{s}</button>
                      ))}
                    </td>
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

export function AlertsPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const load = useCallback(async () => {
    const d = await pccApi.listAlerts({ limit: 100 })
    setRows(d.alerts || [])
  }, [pccApi])
  useEffect(() => { load().catch(() => {}) }, [load])

  const acknowledge = async (id) => {
    try {
      await pccApi.acknowledgeAlert(id)
      onToast?.(toastMsg(isDemo, 'Alert acknowledged'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Acknowledge failed')
    }
  }

  const resolve = async (id) => {
    try {
      await pccApi.resolveAlert(id)
      onToast?.(toastMsg(isDemo, 'Alert resolved'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Resolve failed')
    }
  }

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>ALERTS</h2></div>
      {rows.length === 0 ? <PccEmptyState message="No production alerts" /> : (
        <ul className="pcc-list">
          {rows.map((a) => (
            <li key={a._id}>
              <strong>{a.alertNumber} · {a.title}</strong>
              <span>{a.message}</span>
              <span><PccStatusBadge status={a.status} /> {a.severity} · {formatTime(a.createdAt)}</span>
              <span className="pcc-actions">
                {a.status === 'OPEN' && (
                  <button type="button" className="pcc-btn-ghost" onClick={() => acknowledge(a._id)}>Acknowledge</button>
                )}
                {a.status !== 'RESOLVED' && (
                  <button type="button" className="pcc-btn-ghost" onClick={() => resolve(a._id)}>Resolve</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MyTasksPanel({ onToast, onNavigate, onSelectBatch }) {
  const pccApi = usePccApi()
  const [tasks, setTasks] = useState([])
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await pccApi.getMyTasks()
      setTasks(data.tasks || [])
      setCounts(data.counts || null)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const openTask = (t) => {
    if (t.type === 'receive_pass' || t.type === 'handover_pending') {
      onNavigate?.('passes')
      return
    }
    if (t.type === 'complete_process') {
      onNavigate?.('processes')
      return
    }
    if (t.type === 'qc_pending') {
      if (t.batchId) onSelectBatch?.(t.batchId)
      onNavigate?.('qc')
      return
    }
    if (t.type === 'alert') {
      onNavigate?.('alerts')
    }
  }

  const groups = [
    { id: 'critical', label: 'CRITICAL', items: tasks.filter((t) => t.priority === 'critical') },
    { id: 'attention', label: 'ATTENTION', items: tasks.filter((t) => t.priority === 'attention') },
    { id: 'normal', label: 'NORMAL', items: tasks.filter((t) => t.priority === 'normal') },
  ]

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-strip">
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.total, 0)}</div><div className="pcc-kpi-label">Total</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.receive, 0)}</div><div className="pcc-kpi-label">Receive</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.handover, 0)}</div><div className="pcc-kpi-label">Handover</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.process, 0)}</div><div className="pcc-kpi-label">Process</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.qc, 0)}</div><div className="pcc-kpi-label">QC</div></div>
      </div>
      {loading ? <PccSkeleton rows={4} /> : tasks.length === 0 ? (
        <PccEmptyState message="No tasks assigned to you" />
      ) : groups.map((g) => (
        g.items.length === 0 ? null : (
          <div key={g.id} className="pcc-panel">
            <div className="pcc-panel-head"><h2>{g.label}</h2></div>
            <ul className="pcc-list">
              {g.items.map((t) => (
                <li key={t.id}>
                  <strong>{t.title}</strong>
                  <span>{t.subtitle}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => openTask(t)}>Open</button>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}
    </div>
  )
}

export function AuditPanel({ onToast }) {
  const pccApi = usePccApi()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    pccApi.listAudit()
      .then((d) => setRows(d.logs || []))
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load audit'))
      .finally(() => setLoading(false))
  }, [pccApi, onToast])
  const filtered = search
    ? rows.filter((r) =>
      [r.actorName, r.action, r.resource, r.detail].some((x) => String(x || '').toLowerCase().includes(search.toLowerCase())))
    : rows
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>AUDIT LOG</h2></div>
      <div className="pcc-toolbar">
        <label>Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User, action, detail…" />
        </label>
        {search && <button type="button" className="pcc-btn-ghost" onClick={() => setSearch('')}>Clear filters</button>}
      </div>
      {loading ? <PccSkeleton rows={4} /> : filtered.length === 0 ? <PccEmptyState message="No production audit events" /> : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>Detail</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td>{formatTime(r.createdAt)}</td>
                  <td>{r.actorName} ({r.actorRole})</td>
                  <td>{r.action}</td>
                  <td>{r.resource}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function OverviewPanel({ summary, onSearch }) {
  const [q, setQ] = useState({ batchNumber: '', passNumber: '', employee: '', department: '', metal: '', workOrder: '' })
  const [results, setResults] = useState([])

  const search = async (e) => {
    e.preventDefault()
    const data = await onSearch?.(q)
    setResults(data?.batches || [])
  }

  const metalByDept = summary?.metalByDepartment || []
  const statusCounts = summary?.statusCounts || []
  const maxStatus = Math.max(1, ...statusCounts.map((s) => s.count || 0))
  const maxMetal = Math.max(1, ...metalByDept.map((r) => Number(r.weight) || 0))
  const kpis = summary?.kpis || {}
  const rework = statusCounts.find((s) => s.status === 'REWORK')?.count ?? 0
  const hold = statusCounts.find((s) => s.status === 'HOLD')?.count ?? kpis.onHold ?? 0

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeBatches ?? 0}</div><div className="pcc-kpi-label">Active WIP</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.completedToday ?? 0}</div><div className="pcc-kpi-label">Completed today</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcPending ?? 0}</div><div className="pcc-kpi-label">QC pending</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcFailed ?? 0}</div><div className="pcc-kpi-label">QC failed</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{rework}</div><div className="pcc-kpi-label">Rework</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{hold}</div><div className="pcc-kpi-label">On hold</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.metalInProduction)}</div><div className="pcc-kpi-label">Metal WIP</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.scrapTotal)}</div><div className="pcc-kpi-label">Scrap</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.lossTotal)}</div><div className="pcc-kpi-label">Loss</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.recoveredTotal)}</div><div className="pcc-kpi-label">Recovered</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.machinesRunning ?? 0}</div><div className="pcc-kpi-label">Machines running</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeWorkOrders ?? 0}</div><div className="pcc-kpi-label">Active WOs</div></div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>WHERE IS MY METAL?</h2></div>
        <form className="pcc-form pcc-form-grid" onSubmit={search}>
          <label>
            Batch
            <input value={q.batchNumber} onChange={(e) => setQ({ ...q, batchNumber: e.target.value })} />
          </label>
          <label>
            Pass
            <input value={q.passNumber} onChange={(e) => setQ({ ...q, passNumber: e.target.value })} />
          </label>
          <label>
            Work order
            <input value={q.workOrder} onChange={(e) => setQ({ ...q, workOrder: e.target.value })} />
          </label>
          <label>
            Employee
            <input value={q.employee} onChange={(e) => setQ({ ...q, employee: e.target.value })} />
          </label>
          <label>
            Department
            <input value={q.department} onChange={(e) => setQ({ ...q, department: e.target.value })} />
          </label>
          <label>
            Metal
            <input value={q.metal} onChange={(e) => setQ({ ...q, metal: e.target.value })} />
          </label>
          <button type="submit" className="pcc-btn">Search</button>
        </form>
        {results.length > 0 && (
          <div className="pcc-table-wrap" style={{ marginTop: 12 }}>
            <table className="pcc-table">
              <thead>
                <tr><th>Batch</th><th>Weight</th><th>Dept</th><th>Holder</th><th>Process</th><th>Status</th></tr>
              </thead>
              <tbody>
                {results.map((b) => (
                  <tr key={b._id}>
                    <td>{b.batchNumber}</td>
                    <td><PccWeightDisplay grams={b.currentWeight} /></td>
                    <td>{b.currentDepartment}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentProcess || '—'}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>BATCHES BY STATUS</h2></div>
          {statusCounts.length === 0 ? <PccEmptyState message="No status aggregates" /> : (
            <div className="pcc-bars">
              {statusCounts.map((row) => (
                <div key={row.status} className="pcc-bar-row">
                  <span>{row.status}</span>
                  <div className="pcc-bar-track">
                    <div className="pcc-bar-fill" style={{ width: `${(row.count / maxStatus) * 100}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>METAL BY DEPARTMENT</h2></div>
          {metalByDept.length === 0 ? <PccEmptyState message="No metal in production" /> : (
            <div className="pcc-bars">
              {metalByDept.map((row, i) => (
                <div key={`${row.department}-${row.metalType}-${i}`} className="pcc-bar-row">
                  <span>{String(row.department || '').toUpperCase()} · {row.metalType}</span>
                  <div className="pcc-bar-track">
                    <div className="pcc-bar-fill" style={{ width: `${(Number(row.weight) / maxMetal) * 100}%` }} />
                  </div>
                  <strong>{formatGrams(row.weight)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>CUSTODY SNAPSHOT</h2></div>
        {(summary?.custody || []).length === 0 ? <PccEmptyState message="No custody rows" /> : (
          <ul className="pcc-list">
            {summary.custody.slice(0, 12).map((c, i) => (
              <li key={`${c.person}-${i}`}>
                <strong>{c.person}</strong>
                <span>{c.department} · {formatGrams(c.weight)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function BatchDetailModal({ batchId, onClose, onToast, onRefreshFloor }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [detail, setDetail] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [weightForm, setWeightForm] = useState({ adjustment: '', reason: '' })
  const [issueForm, setIssueForm] = useState({ inventoryItemId: '', weight: '', itemLabel: '' })
  const [invSearch, setInvSearch] = useState('')
  const debouncedInvSearch = useDebounced(invSearch, 300)
  const [invResults, setInvResults] = useState([])
  const [invLoading, setInvLoading] = useState(false)
  const [tab, setTab] = useState('summary')

  const reload = useCallback(() => {
    if (!batchId) return
    pccApi.getBatch(batchId)
      .then((d) => {
        setDetail(d)
        const batch = d?.batch
        if (batch && ['CREATED', 'AWAITING_ISSUE'].includes(batch.status)) {
          setIssueForm({
            inventoryItemId: batch.inventoryItemId ? String(batch.inventoryItemId) : '',
            weight: String(batch.currentWeight || batch.initialWeight || ''),
            itemLabel: batch.inventoryItemId ? `Linked ${String(batch.inventoryItemId).slice(0, 8)}…` : '',
          })
        }
      })
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load batch'))
  }, [batchId, onToast, pccApi])

  useEffect(() => {
    setDetail(null)
    setTab('summary')
    setInvSearch('')
    setInvResults([])
    reload()
  }, [reload])

  useEffect(() => {
    let cancelled = false
    if (!canIssueGate(detail?.batch)) {
      setInvResults([])
      return undefined
    }
    const q = String(debouncedInvSearch || '').trim()
    setInvLoading(true)
    inventoryApi
      .getInventory({ search: q || undefined, limit: 20, page: 1 })
      .then((res) => {
        if (cancelled) return
        const items = res.items || res.data || []
        setInvResults(items)
        if (/^[a-f0-9]{24}$/i.test(q)) {
          const match = items.find((item) => String(item._id || item.id) === q)
          if (match) {
            const unit = match.unit || 'g'
            const qty = match.quantity ?? 0
            setIssueForm((prev) => ({
              ...prev,
              inventoryItemId: q,
              itemLabel: `${match.name || 'Item'}${match.sku ? ` · ${match.sku}` : ''} · ${qty} ${unit}`,
            }))
          } else if (items.length === 0) {
            setIssueForm((prev) => ({
              ...prev,
              inventoryItemId: q,
              itemLabel: `Item ${q.slice(0, 8)}…`,
            }))
          }
        }
      })
      .catch(() => {
        if (!cancelled) setInvResults([])
      })
      .finally(() => {
        if (!cancelled) setInvLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedInvSearch, detail?.batch?.status, detail?.batch?._id])

  if (!batchId) return null
  const b = detail?.batch
  const wr = detail?.weightReconciliation
  const canIssue = b && ['CREATED', 'AWAITING_ISSUE'].includes(b.status)
  const canReturn = b && !['RETURNED_TO_VAULT', 'CANCELLED', 'COMPLETED'].includes(b.status)

  const runAction = async () => {
    if (!confirm || !b) return
    const action = confirm.action
    setConfirm(null)
    try {
      if (action === 'hold') await pccApi.holdBatch(b._id, {})
      if (action === 'release') await pccApi.releaseBatch(b._id, {})
      if (action === 'return') await pccApi.returnToVault(b._id, {})
      if (action === 'issue') {
        await pccApi.issueFromVault(b._id, {
          inventoryItemId: issueForm.inventoryItemId || undefined,
          weight: Number(issueForm.weight),
          idempotencyKey: `issue-${b._id}-${Number(issueForm.weight)}`,
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : 'Issued from vault')
      }
      if (action === 'weight') {
        const adj = Number(weightForm.adjustment)
        const before = Number(b.currentWeight)
        const after = before + adj
        await pccApi.adjustWeight(b._id, {
          field: 'currentWeight',
          adjustment: adj,
          reason: weightForm.reason,
          idempotencyKey: `adj-${b._id}-${Date.now()}`,
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : `Weight adjusted ${before} → ${after} g`)
        setWeightForm({ adjustment: '', reason: '' })
      } else if (action !== 'issue') {
        onToast?.(isDemo ? DEMO_WRITE_MSG : (action === 'return' ? 'Returned to vault' : action === 'hold' ? 'Batch on hold' : 'Batch released'))
      }
      reload()
      onRefreshFloor?.()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  const weightBefore = Number(b?.currentWeight || 0)
  const weightAdj = Number(weightForm.adjustment)
  const weightAfter = Number.isFinite(weightAdj) ? weightBefore + weightAdj : weightBefore

  const TABS = [
    ['summary', 'SUMMARY'],
    ['journey', 'JOURNEY'],
    ['custody', 'METAL CUSTODY'],
    ['processes', 'PROCESSES'],
    ['passes', 'PASSES'],
    ['qc', 'QC'],
    ['weight', 'WEIGHT RECONCILIATION'],
    ['alerts', 'ALERTS'],
    ['audit', 'AUDIT'],
    ['documents', 'DOCUMENTS'],
  ]

  return (
    <div className="pcc-modal-backdrop" onClick={onClose} role="presentation">
      <div className="pcc-modal pcc-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pcc-panel-head">
          <h2>{b?.batchNumber || 'Batch'}</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onClose}>Close</button>
        </div>
        {!detail ? <PccSkeleton rows={5} /> : (
          <div className="pcc-stack">
            <div className="pcc-tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'pcc-tab pcc-tab-active' : 'pcc-tab'}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'summary' && (
              <div className="pcc-stack">
                <div className="pcc-meta-grid">
                  <div><span>Metal</span><strong>{b.metalType} {b.purity}</strong></div>
                  <div><span>Initial</span><strong><PccWeightDisplay grams={b.initialWeight} /></strong></div>
                  <div><span>Current</span><strong><PccWeightDisplay grams={b.currentWeight} /></strong></div>
                  <div><span>Department</span><strong>{b.currentDepartment}</strong></div>
                  <div><span>Holder</span><strong>{b.currentHolderName || '—'}</strong></div>
                  <div><span>Machine</span><strong>{b.currentMachineName || '—'}</strong></div>
                  <div><span>Process</span><strong>{b.currentProcess || '—'}</strong></div>
                  <div><span>WO</span><strong>{b.workOrderNumber || '—'}</strong></div>
                  <div><span>Status</span><strong><PccStatusBadge status={b.status} /></strong></div>
                </div>

                <div className="pcc-actions">
                  {canIssue && (
                    <button
                      type="button"
                      className="pcc-btn"
                      onClick={() => {
                        if (!issueForm.inventoryItemId || !(Number(issueForm.weight) > 0)) {
                          onToast?.('Select an inventory item and enter a positive weight')
                          return
                        }
                        setConfirm({ action: 'issue' })
                      }}
                    >
                      Issue from vault
                    </button>
                  )}
                  {b.status !== 'HOLD' && !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(b.status) && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'hold' })}>Hold</button>
                  )}
                  {b.status === 'HOLD' && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'release' })}>Release</button>
                  )}
                  {canReturn && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'return' })}>Return to vault</button>
                  )}
                </div>

                {canIssue && (
                  <div className="pcc-panel pcc-form">
                    <div className="pcc-panel-head"><h3>Issue from vault</h3></div>
                    <div className="pcc-form-grid">
                      <label style={{ gridColumn: '1 / -1' }}>
                        Inventory item
                        <input
                          value={invSearch}
                          onChange={(e) => setInvSearch(e.target.value)}
                          placeholder="Search by name, SKU, or paste Item ID"
                          autoComplete="off"
                        />
                        {issueForm.inventoryItemId ? (
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                            Selected: <strong>{issueForm.itemLabel || issueForm.inventoryItemId}</strong>
                            {' '}
                            <button
                              type="button"
                              className="pcc-btn-ghost"
                              style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                              onClick={() => setIssueForm({ ...issueForm, inventoryItemId: '', itemLabel: '' })}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}
                        <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', border: '1px solid var(--pcc-border, #ddd)', borderRadius: 8 }}>
                          {invLoading ? (
                            <div style={{ padding: 10, fontSize: 12 }}>Searching…</div>
                          ) : invResults.length === 0 ? (
                            <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>No matching inventory items</div>
                          ) : (
                            invResults.map((item) => {
                              const id = String(item._id || item.id)
                              const unit = item.unit || 'g'
                              const qty = item.quantity ?? 0
                              const label = `${item.name || 'Item'}${item.sku ? ` · ${item.sku}` : ''} · ${qty} ${unit}`
                              const selected = issueForm.inventoryItemId === id
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => {
                                    setIssueForm({
                                      ...issueForm,
                                      inventoryItemId: id,
                                      itemLabel: label,
                                    })
                                    setInvSearch(item.name || item.sku || id)
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 10px',
                                    border: 'none',
                                    borderBottom: '1px solid var(--pcc-border, #eee)',
                                    background: selected ? 'rgba(var(--orange-rgb, 234,88,12), 0.12)' : 'transparent',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    fontSize: 12,
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>{item.name || 'Untitled'}</div>
                                  <div style={{ opacity: 0.75 }}>
                                    {item.sku ? `SKU ${item.sku} · ` : ''}
                                    Available {qty} {unit}
                                    {item.isMetalLinked ? ' · vault/metal' : ''}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </label>
                      <label>Weight (g)
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={issueForm.weight}
                          onChange={(e) => setIssueForm({ ...issueForm, weight: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <form
                  className="pcc-panel pcc-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!weightForm.reason.trim() || !Number.isFinite(Number(weightForm.adjustment)) || Number(weightForm.adjustment) === 0) {
                      onToast?.('Adjustment and reason are required')
                      return
                    }
                    setConfirm({ action: 'weight' })
                  }}
                >
                  <div className="pcc-panel-head"><h3>Weight adjustment</h3></div>
                  <div className="pcc-form-grid">
                    <label>Adjustment (g)
                      <input type="number" step="0.001" value={weightForm.adjustment} onChange={(e) => setWeightForm({ ...weightForm, adjustment: e.target.value })} />
                    </label>
                    <label>Reason
                      <input required minLength={3} value={weightForm.reason} onChange={(e) => setWeightForm({ ...weightForm, reason: e.target.value })} />
                    </label>
                  </div>
                  <button type="submit" className="pcc-btn">Adjust weight</button>
                </form>
              </div>
            )}

            {tab === 'journey' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Production Journey</h3></div>
                {(detail.timeline || []).length === 0 ? <PccEmptyState message="No timeline events" /> : (
                  <ul className="pcc-list">
                    {detail.timeline.map((t, i) => (
                      <li key={`${t.type}-${i}`}>
                        <strong>{formatTime(t.at)}</strong>
                        <span>{t.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'custody' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Metal custody</h3></div>
                {detail.custody ? (
                  <div className="pcc-meta-grid">
                    <div><span>Where</span><strong>{detail.custody.where || 'N/A'}</strong></div>
                    <div><span>Who</span><strong>{detail.custody.holderName || 'N/A'}</strong></div>
                    <div><span>How much</span><strong><PccWeightDisplay grams={detail.custody.weight} /></strong></div>
                    <div><span>Available to transfer</span><strong><PccWeightDisplay grams={detail.custody.availableTransferableWeight} /></strong></div>
                    <div><span>Reserved</span><strong><PccWeightDisplay grams={detail.custody.reservedWeight} /></strong></div>
                    <div><span>Why</span><strong>{detail.custody.why || 'N/A'}</strong></div>
                    <div><span>Last issued by</span><strong>{detail.custody.lastIssuedBy || 'N/A'}</strong></div>
                    <div><span>Last received by</span><strong>{detail.custody.lastReceivedBy || 'N/A'}</strong></div>
                    <div><span>Pass</span><strong>{detail.custody.passNumber || 'N/A'}</strong></div>
                  </div>
                ) : <PccEmptyState message="No custody snapshot" />}
              </div>
            )}

            {tab === 'processes' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Processes</h3></div>
                {!(detail.processes || []).length ? <PccEmptyState message="No process runs" /> : (
                  <div className="pcc-table-wrap">
                    <table className="pcc-table">
                      <thead>
                        <tr><th>Process</th><th>Dept</th><th>Status</th><th>In</th><th>Out</th><th>Start</th><th>End</th></tr>
                      </thead>
                      <tbody>
                        {detail.processes.map((p) => (
                          <tr key={p._id}>
                            <td>{p.process}</td>
                            <td>{p.department || '—'}</td>
                            <td><PccStatusBadge status={p.status} /></td>
                            <td><PccWeightDisplay grams={p.inputWeight} /></td>
                            <td><PccWeightDisplay grams={p.outputWeight} /></td>
                            <td>{formatTime(p.startTime)}</td>
                            <td>{formatTime(p.endTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'passes' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Passes</h3></div>
                {!(detail.passes || []).length ? <PccEmptyState message="No passes" /> : (
                  <div className="pcc-table-wrap">
                    <table className="pcc-table">
                      <thead>
                        <tr><th>Pass</th><th>From</th><th>To</th><th>Weight</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {detail.passes.map((p) => (
                          <tr key={p._id}>
                            <td>{p.passNumber}</td>
                            <td>{p.fromDepartment || '—'}</td>
                            <td>{p.toDepartment || '—'}</td>
                            <td><PccWeightDisplay grams={p.weight} /></td>
                            <td><PccStatusBadge status={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'qc' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>QC</h3></div>
                {!(detail.qc || []).length ? <PccEmptyState message="No QC inspections" /> : (
                  <div className="pcc-table-wrap">
                    <table className="pcc-table">
                      <thead>
                        <tr><th>Inspection</th><th>Result</th><th>Inspector</th><th>Reason</th><th>When</th></tr>
                      </thead>
                      <tbody>
                        {detail.qc.map((q) => (
                          <tr key={q._id}>
                            <td>{q.inspectionNumber || q._id}</td>
                            <td><PccStatusBadge status={q.result} /></td>
                            <td>{q.inspectorName || '—'}</td>
                            <td>{q.reworkReason || q.failureReason || q.remarks || '—'}</td>
                            <td>{formatTime(q.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'weight' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Weight Reconciliation</h3></div>
                <div className="pcc-meta-grid">
                  <div><span>Expected</span><strong><PccWeightDisplay grams={wr?.expectedWeight} /></strong></div>
                  <div><span>Actual</span><strong><PccWeightDisplay grams={wr?.actualWeight} /></strong></div>
                  <div><span>Difference</span><strong><PccWeightDisplay grams={wr?.difference} /></strong></div>
                  <div><span>Variance %</span><strong>{Number(wr?.variancePct || 0).toFixed(2)}%</strong></div>
                  <div><span>Scrap</span><strong><PccWeightDisplay grams={wr?.scrap} /></strong></div>
                  <div><span>Loss</span><strong><PccWeightDisplay grams={wr?.loss} /></strong></div>
                </div>
                {(detail.adjustments || []).length > 0 && (
                  <>
                    <div className="pcc-panel-head" style={{ marginTop: 12 }}><h3>Adjustments</h3></div>
                    <ul className="pcc-list">
                      {detail.adjustments.map((a) => (
                        <li key={a._id}>
                          <strong>{formatTime(a.createdAt)}</strong>
                          <span>{a.field}: {a.adjustment} — {a.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {tab === 'alerts' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Alerts</h3></div>
                {!(detail.alerts || []).length ? <PccEmptyState message="No alerts for this batch" /> : (
                  <ul className="pcc-list">
                    {detail.alerts.map((a) => (
                      <li key={a._id}>
                        <strong><PccStatusBadge status={a.status} /> {a.title}</strong>
                        <span>{a.message || a.alertNumber} · {formatTime(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'audit' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Audit</h3></div>
                {!(detail.audits || []).length ? <PccEmptyState message="No audit entries" /> : (
                  <ul className="pcc-list">
                    {detail.audits.map((a) => (
                      <li key={a._id}>
                        <strong>{formatTime(a.createdAt)}</strong>
                        <span>{a.action || a.detail || a.message || '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Documents</h3></div>
                <PccEmptyState message="No documents" />
              </div>
            )}
          </div>
        )}

        <PccConfirmDialog
          open={!!confirm}
          title={
            confirm?.action === 'hold' ? 'Put batch on hold?'
              : confirm?.action === 'release' ? 'Release batch?'
                : confirm?.action === 'return' ? 'Return to vault?'
                  : confirm?.action === 'issue' ? 'Issue from vault?'
                    : 'Confirm weight adjustment?'
          }
          message={
            confirm?.action === 'weight'
              ? 'This writes an audited weight adjustment.'
              : confirm?.action === 'return'
                ? `Return ${b?.batchNumber} metal to vault inventory.`
                : confirm?.action === 'issue'
                  ? `Debit vault inventory and mark ${b?.batchNumber} as ISSUED.`
                  : `${b?.batchNumber || 'Batch'} will change status.`
          }
          details={
            confirm?.action === 'weight' ? (
              <>
                <div>Before: {formatGrams(weightBefore)}</div>
                <div>Adjustment: {formatGrams(weightAdj)}</div>
                <div>After: {formatGrams(weightAfter)}</div>
                <div>Reason: {weightForm.reason}</div>
              </>
            ) : confirm?.action === 'issue' ? (
              <>
                <div>Inventory item: {issueForm.inventoryItemId}</div>
                <div>Weight: {formatGrams(Number(issueForm.weight))}</div>
              </>
            ) : null
          }
          confirmLabel={confirm?.action === 'issue' ? 'Issue' : 'Confirm'}
          danger={confirm?.action === 'return' || confirm?.action === 'hold' || confirm?.action === 'weight'}
          onCancel={() => setConfirm(null)}
          onConfirm={runAction}
        />
      </div>
    </div>
  )
}
