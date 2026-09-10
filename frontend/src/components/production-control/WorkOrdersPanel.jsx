import { useCallback, useEffect, useState } from 'react'
import workOrdersApi from '../../api/production/workOrders'
import productionControlApi from '../../api/productionControl'
import { formatTime } from './shared'
import { PccConfirmDialog, PccEmptyState, PccSkeleton, PccStatusBadge } from './primitives'

const STAGES = ['casting', 'polishing', 'finishing', 'packaging', 'completed']
const STATUSES = ['pending', 'scheduled', 'in_progress', 'quality_check', 'completed', 'on_hold', 'cancelled']

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function WorkOrdersPanel({ onToast, onOpenBatches }) {
  const [rows, setRows] = useState([])
  const [summaryMap, setSummaryMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [canEdit, setCanEdit] = useState(false)
  const [form, setForm] = useState({
    woNumber: '',
    product: '',
    quantity: '1',
    stage: 'casting',
    assignedTo: '',
    targetDate: '',
  })
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const debouncedSearch = useDebounced(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [woRes, sumRes] = await Promise.all([
        workOrdersApi.getWorkOrders({ page, limit: 20, search: debouncedSearch || undefined }),
        productionControlApi.getWorkOrdersSummary().catch(() => ({ byWorkOrder: [] })),
      ])
      setRows(woRes.workOrders || [])
      setTotal(woRes.total || 0)
      setCanEdit(!!woRes.permissions?.canEdit)
      const map = {}
      for (const row of sumRes.byWorkOrder || []) {
        if (row.workOrderId) map[String(row.workOrderId)] = row
      }
      setSummaryMap(map)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, onToast])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const create = async (e) => {
    e.preventDefault()
    try {
      const created = await workOrdersApi.createWorkOrder({
        woNumber: form.woNumber.trim(),
        quantity: Number(form.quantity) || 1,
        stage: form.stage === 'finishing' || form.stage === 'completed' ? 'casting' : form.stage,
        assignedTo: form.assignedTo,
        targetDate: form.targetDate || null,
      })
      if (form.product && created?.workOrder?._id) {
        await workOrdersApi.updateWorkOrder(created.workOrder._id, {
          product: form.product,
          stage: form.stage,
        })
      }
      onToast?.(created?.message || 'Work order created')
      setForm({ woNumber: '', product: '', quantity: '1', stage: 'casting', assignedTo: '', targetDate: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Create failed')
    }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing) return
    try {
      await workOrdersApi.updateWorkOrder(editing._id, {
        product: editing.product,
        quantity: Number(editing.quantity) || 1,
        stage: editing.stage,
        status: editing.status,
        progress: Number(editing.progress) || 0,
        assignedTo: editing.assignedTo,
        targetDate: editing.targetDate || null,
      })
      onToast?.('Work order updated')
      setEditing(null)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Update failed')
    }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    const id = confirmDelete._id
    setConfirmDelete(null)
    try {
      const res = await workOrdersApi.deleteWorkOrder(id)
      onToast?.(res?.message || 'Work order deleted')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Delete failed')
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="pcc-stack">
      {canEdit && (
        <form className="pcc-panel pcc-form" onSubmit={create}>
          <div className="pcc-panel-head"><h2>CREATE WORK ORDER</h2></div>
          <div className="pcc-form-grid">
            <label>WO #
              <input required value={form.woNumber} onChange={(e) => setForm({ ...form, woNumber: e.target.value })} />
            </label>
            <label>Product
              <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            </label>
            <label>Quantity
              <input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </label>
            <label>Stage
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Assigned
              <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
            </label>
            <label>Target date
              <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="pcc-btn">Create work order</button>
        </form>
      )}

      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>WORK ORDERS</h2>
          <span>{total} total</span>
        </div>
        <div className="pcc-toolbar">
          <label>Search
            <input
              type="search"
              placeholder="WO # or assignee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? <PccSkeleton rows={5} /> : rows.length === 0 ? (
          <PccEmptyState message="No work orders" />
        ) : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead>
                <tr>
                  <th>WO #</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Progress</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Batches</th>
                  <th>Target</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((wo) => {
                  const sum = summaryMap[String(wo._id)]
                  return (
                    <tr key={wo._id}>
                      <td>{wo.woNumber}</td>
                      <td>{wo.product || '—'}</td>
                      <td>{wo.quantity}</td>
                      <td>{wo.progress ?? 0}%</td>
                      <td>{wo.stage}</td>
                      <td><PccStatusBadge status={wo.status} /></td>
                      <td>{wo.assignedTo || '—'}</td>
                      <td>{sum ? `${sum.activeCount}/${sum.batchCount}` : '0'}</td>
                      <td>{formatTime(wo.targetDate).split(',')[0]}</td>
                      <td className="pcc-actions">
                        <button type="button" className="pcc-btn-ghost" onClick={() => onOpenBatches?.(wo)}>Batches</button>
                        {canEdit && (
                          <>
                            <button type="button" className="pcc-btn-ghost" onClick={() => setEditing({
                              ...wo,
                              targetDate: wo.targetDate ? String(wo.targetDate).slice(0, 10) : '',
                            })}>
                              Edit
                            </button>
                            <button type="button" className="pcc-btn-ghost" onClick={() => setConfirmDelete(wo)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pcc-pager">
          <button type="button" className="pcc-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} / {pages}</span>
          <button type="button" className="pcc-btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {editing && (
        <div className="pcc-modal-backdrop" onClick={() => setEditing(null)} role="presentation">
          <form className="pcc-modal pcc-form" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="pcc-panel-head">
              <h2>Edit {editing.woNumber}</h2>
              <button type="button" className="pcc-btn-ghost" onClick={() => setEditing(null)}>Close</button>
            </div>
            <div className="pcc-form-grid">
              <label>Product
                <input value={editing.product || ''} onChange={(e) => setEditing({ ...editing, product: e.target.value })} />
              </label>
              <label>Quantity
                <input type="number" min="1" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
              </label>
              <label>Progress %
                <input type="number" min="0" max="100" value={editing.progress ?? 0} onChange={(e) => setEditing({ ...editing, progress: e.target.value })} />
              </label>
              <label>Stage
                <select value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value })}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Status
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Assigned
                <input value={editing.assignedTo || ''} onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })} />
              </label>
              <label>Target date
                <input type="date" value={editing.targetDate || ''} onChange={(e) => setEditing({ ...editing, targetDate: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="pcc-btn">Save</button>
          </form>
        </div>
      )}

      <PccConfirmDialog
        open={!!confirmDelete}
        title="Delete work order?"
        message={confirmDelete ? `Soft-delete ${confirmDelete.woNumber}. Linked production batches are not deleted.` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={doDelete}
      />
    </div>
  )
}
