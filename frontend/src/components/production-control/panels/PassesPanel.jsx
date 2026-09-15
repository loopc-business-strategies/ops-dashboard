import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { formatGrams, canPcc } from '../shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { toastMsg } from './panelHelpers'

export default function PassesPanel({ onToast, productionRole }) {
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
  }, [selectedBatch])

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

