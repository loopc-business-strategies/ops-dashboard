import { useCallback, useEffect, useState } from 'react'
import { usePccApi, useWorkOrdersApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { formatTime } from '../shared'
import {
  PccContextDrawer,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { useDebounced, toastMsg } from './panelHelpers'

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'WAITING', label: 'Waiting' },
  { id: 'IN_PROCESS', label: 'In Process' },
  { id: 'QC', label: 'QC' },
  { id: 'HOLD', label: 'Hold' },
  { id: 'REWORK', label: 'Rework' },
  { id: 'COMPLETED', label: 'Completed' },
]

export default function BatchesPanel({ onSelectBatch, onToast }) {
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
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
    if (submitting) return
    setSubmitting(true)
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
      setCreateOpen(false)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setDepartment('')
  }

  const closeCreate = useCallback(() => {
    if (!submitting) setCreateOpen(false)
  }, [submitting])

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>BATCHES</h2>
          <div className="pcc-actions">
            <span className="pcc-muted">{total} total</span>
            <button type="button" className="pcc-btn" onClick={() => setCreateOpen(true)}>
              + Create Batch
            </button>
          </div>
        </div>
        <div className="pcc-status-tabs" role="tablist" aria-label="Batch status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              className={status === tab.id ? 'active' : ''}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pcc-toolbar">
          <label>Search
            <input type="search" placeholder="Batch, WO, product, holder…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. polishing" />
          </label>
          {(search || status || department) && (
            <button type="button" className="pcc-btn-ghost" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
        {loading ? <PccSkeleton rows={4} /> : batches.length === 0 ? (
          <PccEmptyState
            message="No production batches matching filters"
            hint="Create a batch or clear filters to see active work."
            action={(
              <button type="button" className="pcc-btn" onClick={() => setCreateOpen(true)}>
                + Create Batch
              </button>
            )}
          />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Metal</th>
                  <th>Product</th>
                  <th>Weight</th>
                  <th>Purity</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Department</th>
                  <th>Holder</th>
                  <th>Machine</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.batchNumber}</strong></td>
                    <td>{b.metalType || '—'}</td>
                    <td>{b.product || '—'}</td>
                    <td><PccWeightDisplay grams={b.currentWeight} /></td>
                    <td>{b.purity || '—'}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                    <td>{b.currentProcess || b.currentDepartment || '—'}</td>
                    <td>{b.currentDepartment || '—'}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentMachineName || '—'}</td>
                    <td>{formatTime(b.updatedAt || b.lastActivityAt)}</td>
                    <td>
                      <button type="button" className="pcc-btn" onClick={() => onSelectBatch(b._id)}>
                        Open
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
        open={createOpen}
        title="Create Batch"
        onClose={closeCreate}
      >
        <form className="pcc-form" onSubmit={create}>
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
          <div className="pcc-actions" style={{ marginTop: 12 }}>
            <button type="button" className="pcc-btn-ghost" disabled={submitting} onClick={closeCreate}>
              Cancel
            </button>
            <button type="submit" className="pcc-btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Batch'}
            </button>
          </div>
        </form>
      </PccContextDrawer>
    </div>
  )
}
