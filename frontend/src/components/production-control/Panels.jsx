import { useEffect, useState } from 'react'
import productionControlApi from '../../api/productionControl'
import { EmptyState, StatusPill, formatGrams, formatTime } from './shared'

export function BatchesPanel({ onSelectBatch, onToast }) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    metalType: 'Gold',
    purity: '18K',
    initialWeight: '',
    product: '',
    purpose: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await productionControlApi.listBatches()
      setBatches(data.batches || [])
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.createBatch({
        ...form,
        initialWeight: Number(form.initialWeight),
        idempotencyKey: `ui-batch-${Date.now()}`,
      })
      onToast?.('Batch created')
      setForm((f) => ({ ...f, initialWeight: '', product: '', purpose: '' }))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Create failed')
    }
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
        </div>
        <button type="submit" className="pcc-btn">Create batch</button>
      </form>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>BATCHES</h2></div>
        {loading ? 'Loading…' : batches.length === 0 ? (
          <EmptyState message="No active batches" />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th><th>Metal</th><th>Weight</th><th>Process</th>
                  <th>Department</th><th>Operator</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id}>
                    <td>{b.batchNumber}</td>
                    <td>{b.metalType} {b.purity}</td>
                    <td>{formatGrams(b.currentWeight)}</td>
                    <td>{b.currentProcess || '—'}</td>
                    <td>{b.currentDepartment}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td><StatusPill status={b.status} /></td>
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

export function PassesPanel({ onToast }) {
  const [passes, setPasses] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({
    batchId: '', fromDepartment: 'vault', toDepartment: 'melting', weight: '', purpose: '',
  })

  const load = async () => {
    const [p, b] = await Promise.all([
      productionControlApi.listPasses(),
      productionControlApi.listBatches(),
    ])
    setPasses(p.passes || [])
    setBatches(b.batches || [])
  }

  useEffect(() => { load().catch(() => onToast?.('Failed to load passes')) }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.createPass({
        ...form,
        weight: Number(form.weight),
        idempotencyKey: `ui-pass-${Date.now()}`,
      })
      onToast?.('Pass created')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  const act = async (id, action) => {
    try {
      if (action === 'approve') await productionControlApi.approvePass(id)
      if (action === 'issue') await productionControlApi.issuePass(id)
      if (action === 'receive') await productionControlApi.receivePass(id, { receiveIdempotencyKey: `recv-${id}-${Date.now()}` })
      onToast?.(`Pass ${action} OK`)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="pcc-stack">
      <form className="pcc-panel pcc-form" onSubmit={create}>
        <div className="pcc-panel-head"><h2>CREATE PASS</h2></div>
        <div className="pcc-form-grid">
          <label>Batch
            <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Select…</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber} ({formatGrams(b.currentWeight)})</option>)}
            </select>
          </label>
          <label>From
            <input value={form.fromDepartment} onChange={(e) => setForm({ ...form, fromDepartment: e.target.value })} />
          </label>
          <label>To
            <input value={form.toDepartment} onChange={(e) => setForm({ ...form, toDepartment: e.target.value })} />
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

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>PASSES</h2></div>
        {passes.length === 0 ? <EmptyState message="No pending passes" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr><th>Pass</th><th>Batch</th><th>Route</th><th>Weight</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {passes.map((p) => (
                  <tr key={p._id}>
                    <td>{p.passNumber}</td>
                    <td>{p.batchNumber}</td>
                    <td>{p.fromDepartment} → {p.toDepartment}</td>
                    <td>{formatGrams(p.weight)}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="pcc-actions">
                      {p.status === 'REQUESTED' && <button type="button" className="pcc-btn-ghost" onClick={() => act(p._id, 'approve')}>Approve</button>}
                      {['REQUESTED', 'APPROVED'].includes(p.status) && <button type="button" className="pcc-btn-ghost" onClick={() => act(p._id, 'issue')}>Issue</button>}
                      {['ISSUED', 'IN_TRANSIT'].includes(p.status) && <button type="button" className="pcc-btn-ghost" onClick={() => act(p._id, 'receive')}>Receive</button>}
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

export function MovementsPanel() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    productionControlApi.listMovements().then((d) => setRows(d.movements || [])).catch(() => {})
  }, [])
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>METAL MOVEMENTS</h2></div>
      {rows.length === 0 ? <EmptyState message="No metal movements" /> : (
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
                  <td>{formatGrams(m.weight)}</td>
                  <td><StatusPill status={m.status} /></td>
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
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({ batchId: '', process: 'Melting', department: 'melting', inputWeight: '' })
  const [complete, setComplete] = useState({ id: '', outputWeight: '', scrap: '0', loss: '0' })

  const load = async () => {
    const [p, b] = await Promise.all([
      productionControlApi.listProcesses(),
      productionControlApi.listBatches(),
    ])
    setRows(p.processes || [])
    setBatches(b.batches || [])
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const start = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.startProcess({
        ...form,
        inputWeight: form.inputWeight === '' ? undefined : Number(form.inputWeight),
      })
      onToast?.('Process started')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Start failed')
    }
  }

  const finish = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.completeProcess(complete.id, {
        outputWeight: Number(complete.outputWeight),
        scrap: Number(complete.scrap) || 0,
        loss: Number(complete.loss) || 0,
        completeIdempotencyKey: `complete-${complete.id}-${Date.now()}`,
      })
      onToast?.('Process completed')
      setComplete({ id: '', outputWeight: '', scrap: '0', loss: '0' })
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
        </div>
        <button type="submit" className="pcc-btn">Complete</button>
      </form>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>PROCESS HISTORY</h2></div>
        {rows.length === 0 ? <EmptyState message="No process runs" /> : (
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
                    <td>{formatGrams(r.inputWeight)}</td>
                    <td>{r.outputWeight == null ? '—' : formatGrams(r.outputWeight)}</td>
                    <td><StatusPill status={r.status} /></td>
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

export function QcPanel({ onToast }) {
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({ batchId: '', result: 'PASS', remarks: '' })

  const load = async () => {
    const [q, b] = await Promise.all([
      productionControlApi.listQc(),
      productionControlApi.listBatches(),
    ])
    setRows(q.inspections || [])
    setBatches(b.batches || [])
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.submitQc({
        ...form,
        idempotencyKey: `qc-${form.batchId}-${Date.now()}`,
      })
      onToast?.('QC submitted')
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
        </div>
        <button type="submit" className="pcc-btn">Submit QC</button>
      </form>
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>QC HISTORY</h2></div>
        {rows.length === 0 ? <EmptyState message="No QC pending" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Inspection</th><th>Batch</th><th>Result</th><th>Inspector</th><th>When</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.inspectionNumber}</td>
                    <td>{r.batchNumber}</td>
                    <td><StatusPill status={r.result} /></td>
                    <td>{r.inspectorName}</td>
                    <td>{formatTime(r.createdAt)}</td>
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

export function MachinesPanel({ onToast }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ machineCode: '', name: '', department: '', process: '' })

  const load = async () => {
    const d = await productionControlApi.listMachines()
    setRows(d.machines || [])
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await productionControlApi.createMachine(form)
      onToast?.('Machine added')
      setForm({ machineCode: '', name: '', department: '', process: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  const setStatus = async (id, status) => {
    try {
      await productionControlApi.updateMachineStatus(id, { status })
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
          <label>Code<input required value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} /></label>
          <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label>Process<input value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} /></label>
        </div>
        <button type="submit" className="pcc-btn">Add</button>
      </form>
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>MACHINES</h2></div>
        {rows.length === 0 ? <EmptyState message="No machines registered" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Code</th><th>Name</th><th>Dept</th><th>Status</th><th>Batch</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>{m.machineCode}</td>
                    <td>{m.name}</td>
                    <td>{m.department || '—'}</td>
                    <td><StatusPill status={m.status} /></td>
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
  const [rows, setRows] = useState([])
  const load = async () => {
    const d = await productionControlApi.listAlerts()
    setRows(d.alerts || [])
  }
  useEffect(() => { load().catch(() => {}) }, [])

  const resolve = async (id) => {
    try {
      await productionControlApi.resolveAlert(id)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Resolve failed')
    }
  }

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>ALERTS</h2></div>
      {rows.length === 0 ? <EmptyState message="No production alerts" /> : (
        <ul className="pcc-list">
          {rows.map((a) => (
            <li key={a._id}>
              <strong>{a.alertNumber} · {a.title}</strong>
              <span>{a.message}</span>
              <span><StatusPill status={a.status} /> {formatTime(a.createdAt)}</span>
              {a.status !== 'RESOLVED' && (
                <button type="button" className="pcc-btn-ghost" onClick={() => resolve(a._id)}>Resolve</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AuditPanel() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    productionControlApi.listAudit().then((d) => setRows(d.logs || [])).catch(() => {})
  }, [])
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>AUDIT LOG</h2></div>
      {rows.length === 0 ? <EmptyState message="No production audit events" /> : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
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
  const [q, setQ] = useState({ batchNumber: '', passNumber: '', employee: '', department: '', metal: '' })
  const [results, setResults] = useState([])

  const search = async (e) => {
    e.preventDefault()
    const data = await onSearch?.(q)
    setResults(data?.batches || [])
  }

  const metalByDept = summary?.metalByDepartment || []

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>WHERE IS MY METAL?</h2></div>
        <form className="pcc-form-grid" onSubmit={search}>
          <label>Batch<input value={q.batchNumber} onChange={(e) => setQ({ ...q, batchNumber: e.target.value })} /></label>
          <label>Pass<input value={q.passNumber} onChange={(e) => setQ({ ...q, passNumber: e.target.value })} /></label>
          <label>Employee<input value={q.employee} onChange={(e) => setQ({ ...q, employee: e.target.value })} /></label>
          <label>Department<input value={q.department} onChange={(e) => setQ({ ...q, department: e.target.value })} /></label>
          <label>Metal<input value={q.metal} onChange={(e) => setQ({ ...q, metal: e.target.value })} /></label>
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
                    <td>{formatGrams(b.currentWeight)}</td>
                    <td>{b.currentDepartment}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentProcess || '—'}</td>
                    <td><StatusPill status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>METAL BALANCE BY DEPARTMENT</h2></div>
        {metalByDept.length === 0 ? <EmptyState message="No metal in production" /> : (
          <ul className="pcc-list">
            {metalByDept.map((row, i) => (
              <li key={`${row.department}-${row.metalType}-${i}`}>
                <strong>{String(row.department || '').toUpperCase()}</strong>
                <span>{row.metalType}</span>
                <span>{formatGrams(row.weight)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function BatchDetailModal({ batchId, onClose, onToast }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!batchId) return
    productionControlApi.getBatch(batchId)
      .then(setDetail)
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load batch'))
  }, [batchId])

  if (!batchId) return null
  const b = detail?.batch
  const wr = detail?.weightReconciliation

  return (
    <div className="pcc-modal-backdrop" onClick={onClose} role="presentation">
      <div className="pcc-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pcc-panel-head">
          <h2>{b?.batchNumber || 'Batch'}</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onClose}>Close</button>
        </div>
        {!detail ? 'Loading…' : (
          <div className="pcc-stack">
            <div className="pcc-meta-grid">
              <div><span>Metal</span><strong>{b.metalType} {b.purity}</strong></div>
              <div><span>Initial</span><strong>{formatGrams(b.initialWeight)}</strong></div>
              <div><span>Current</span><strong>{formatGrams(b.currentWeight)}</strong></div>
              <div><span>Department</span><strong>{b.currentDepartment}</strong></div>
              <div><span>Holder</span><strong>{b.currentHolderName || '—'}</strong></div>
              <div><span>Machine</span><strong>{b.currentMachineName || '—'}</strong></div>
              <div><span>Process</span><strong>{b.currentProcess || '—'}</strong></div>
              <div><span>Status</span><strong><StatusPill status={b.status} /></strong></div>
            </div>

            <div className="pcc-panel">
              <div className="pcc-panel-head"><h3>Weight Reconciliation</h3></div>
              <div className="pcc-meta-grid">
                <div><span>Expected</span><strong>{formatGrams(wr?.expectedWeight)}</strong></div>
                <div><span>Actual</span><strong>{formatGrams(wr?.actualWeight)}</strong></div>
                <div><span>Difference</span><strong>{formatGrams(wr?.difference)}</strong></div>
                <div><span>Variance %</span><strong>{Number(wr?.variancePct || 0).toFixed(2)}%</strong></div>
                <div><span>Scrap</span><strong>{formatGrams(wr?.scrap)}</strong></div>
                <div><span>Loss</span><strong>{formatGrams(wr?.loss)}</strong></div>
              </div>
            </div>

            <div className="pcc-panel">
              <div className="pcc-panel-head"><h3>Production Journey</h3></div>
              {(detail.timeline || []).length === 0 ? <EmptyState message="No timeline events" /> : (
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
          </div>
        )}
      </div>
    </div>
  )
}
