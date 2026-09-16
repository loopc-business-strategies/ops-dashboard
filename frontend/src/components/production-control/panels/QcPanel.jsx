import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { DEMO_WRITE_MSG } from '../demo/pccApiAdapter'
import { formatTime } from '../shared'
import {
  PccConfirmDialog,
  PccContextDrawer,
  PccEmptyState,
  PccStatusBadge,
} from '../primitives'
import { toastMsg } from './panelHelpers'

export default function QcPanel({ onToast, onNavigate, onSelectBatch }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [batches, setBatches] = useState([])
  const [formOpen, setFormOpen] = useState(false)
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
      setFormOpen(false)
      setForm({ batchId: '', result: 'PASS', remarks: '', failureReason: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'QC failed')
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>QC HISTORY</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => setFormOpen(true)}>
              New inspection
            </button>
            {lastPassBatchId && (
              <button
                type="button"
                className="pcc-btn-ghost"
                onClick={() => onNavigate?.('dept-packing')}
              >
                Open Packaging
              </button>
            )}
            <button type="button" className="pcc-btn-ghost" onClick={() => load().catch(() => {})}>
              Refresh
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <PccEmptyState
            message="No QC records"
            hint="Submit an inspection for a batch waiting in QC."
          />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Inspection</th><th>Batch</th><th>Result</th><th>Inspector</th><th>When</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.inspectionNumber}</td>
                    <td>
                      {r.batchId ? (
                        <button type="button" className="pcc-link" onClick={() => onSelectBatch?.(r.batchId)}>
                          {r.batchNumber || 'Open'}
                        </button>
                      ) : (r.batchNumber || '—')}
                    </td>
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

      <PccContextDrawer
        open={formOpen}
        title="QC inspection"
        onClose={() => setFormOpen(false)}
      >
        <form className="pcc-form" onSubmit={submit}>
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
          <div className="pcc-actions" style={{ marginTop: 12 }}>
            <button type="button" className="pcc-btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="pcc-btn">Submit QC</button>
          </div>
        </form>
      </PccContextDrawer>

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
