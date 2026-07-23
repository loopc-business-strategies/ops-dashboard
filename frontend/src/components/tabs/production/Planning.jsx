import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import workOrdersApi from '../../../api/production/workOrders'
import {
  C, Badge, SectionHeader, Modal, Field, linesForUi, ORDER_STATUS,
} from './shared'

// ── Planning ──────────────────────────────────────
function Planning({ canEdit, showToast }) {
  const { token } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ product: '', quantity: '', unit: 'pcs', line: 'L1', startDate: '', dueDate: '', status: 'scheduled', progress: 0 })

  const toRow = wo => ({
    id:        wo._id,
    woNumber:  wo.woNumber,
    product:   wo.product || wo.woNumber || '',
    quantity:  wo.quantity || 0,
    unit:      wo.unit || 'pcs',
    line:      wo.line || '',
    startDate: wo.startDate ? wo.startDate.slice(0, 10) : '',
    dueDate:   wo.targetDate ? wo.targetDate.slice(0, 10) : '',
    status:    wo.status || 'scheduled',
    progress:  wo.progress || 0,
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await workOrdersApi.getWorkOrders()
        if (mounted) setOrders((res.workOrders || res.data || []).map(toRow))
      } catch (e) {
        if (mounted) showToast?.(e?.response?.data?.message || 'Failed to load work orders')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [token, showToast])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => {
    setEditId(null)
    setForm({ product: '', quantity: '', unit: 'pcs', line: 'L1', startDate: '', dueDate: '', status: 'scheduled', progress: 0 })
    setModal(true)
  }

  const openEdit = order => {
    setEditId(order.id)
    setForm({ product: order.product, quantity: order.quantity, unit: order.unit, line: order.line, startDate: order.startDate, dueDate: order.dueDate, status: order.status, progress: order.progress })
    setModal(true)
  }

  const deleteOrder = async order => {
    if (!window.confirm(`Delete order ${order.product || order.id}?`)) return
    try {
      await workOrdersApi.deleteWorkOrder(order.id)
      setOrders(p => p.filter(x => x.id !== order.id))
      showToast('Order Deleted', `Order removed.`)
    } catch { showToast('Error', 'Failed to delete order.') }
  }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.product.trim() || !form.quantity) return
    const payload = {
      woNumber: form.product.replace(/\s+/g, '-').toUpperCase() + '-' + Date.now(),
      product: form.product.trim(),
      quantity: parseInt(form.quantity, 10) || 1,
      unit: form.unit,
      line: form.line,
      startDate: form.startDate || null,
      targetDate: form.dueDate || null,
      status: form.status,
      progress: parseInt(form.progress, 10) || 0,
    }
    try {
      if (editId) {
        const res = await workOrdersApi.updateWorkOrder(editId, { ...payload })
        const updated = toRow(res.workOrder || res.data || { ...payload, _id: editId })
        setOrders(p => p.map(x => x.id === editId ? updated : x))
        showToast('Production Order Updated', `${form.product} updated.`)
      } else {
        const res = await workOrdersApi.createWorkOrder(payload)
        setOrders(p => [...p, toRow(res.workOrder || res.data || { ...payload, _id: Date.now() })])
        showToast('Production Order Created', `${form.product} scheduled.`)
      }
      setEditId(null)
      setModal(false)
    } catch (err) { showToast('Error', err?.response?.data?.message || 'Failed to save order.') }
  }

  // Forecast banner data
  const forecast = [
    { week: 'W15 (Apr 7–13)',  actual: 4790, plan: 5000 },
    { week: 'W16 (Apr 14–20)', actual: null, plan: 5200 },
    { week: 'W17 (Apr 21–27)', actual: null, plan: 5100 },
    { week: 'W18 (Apr 28–30)', actual: null, plan: 2400 },
  ]
  const maxPlan = Math.max(...forecast.map(f => f.plan))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Production Planning"
        sub="Production orders and weekly forecast"
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Create Order</button>
        )}
      />

      {/* Forecast Banner */}
        {loading && <p className="text-sm text-gray-500">Loading orders...</p>}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Weekly Forecast</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {forecast.map(f => {
            const pct = f.actual ? Math.round((f.actual / f.plan) * 100) : null
            return (
              <div key={f.week} className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-2">{f.week}</p>
                <div className="h-16 bg-gray-700/50 rounded-lg flex items-end overflow-hidden mb-2">
                  <div className="w-full rounded-t-sm"
                       style={{ height: `${((f.actual || f.plan) / maxPlan) * 100}%`,
                                background: f.actual ? (pct >= 90 ? '#22c55e' : '#eab308') : '#374151' }} />
                </div>
                <p className="text-sm font-semibold text-white">{(f.actual || f.plan).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Plan: {f.plan.toLocaleString()}</p>
                {pct !== null && (
                  <span className={`text-xs font-medium ${pct >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {pct}% achieved
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Order ID', 'Product', 'Qty', 'Line', 'Start', 'Due', 'Progress', 'Status', ...(canEdit ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-mono text-xs text-violet-400">{o.id}</td>
                <td className="py-3 pr-4 font-medium text-white">{o.product}</td>
                <td className="py-3 pr-4 text-gray-400">{o.quantity.toLocaleString()} {o.unit}</td>
                <td className="py-3 pr-4 text-gray-400">{o.line}</td>
                <td className="py-3 pr-4 text-gray-400">{o.startDate}</td>
                <td className="py-3 pr-4 text-gray-400">{o.dueDate}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500"
                           style={{ width: `${o.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{o.progress}%</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <Badge color={ORDER_STATUS[o.status]?.badge || 'gray'}>{ORDER_STATUS[o.status]?.label}</Badge>
                </td>
                {canEdit && (
                  <td className="py-3 pr-4">
                    <button onClick={() => openEdit(o)} className="text-xs px-3 py-1 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">Edit</button>
                    <button onClick={() => deleteOrder(o)} className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editId ? 'Edit Production Order' : 'Create Production Order'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product Name" required>
            <input className="input-field" value={form.product} onChange={set('product')} placeholder="e.g. Gold Bar 99.99%" />
          </Field>
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Quantity" required>
                <input type="number" min="1" className="input-field" value={form.quantity} onChange={set('quantity')} />
              </Field>
            </div>
            <div className="w-24">
              <Field label="Unit">
                <select className="input-field" value={form.unit} onChange={set('unit')}>
                  {['pcs', 'kg', 'g', 'sets', 'bars'].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Production Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id} — {l.name.split('—')[1]?.trim()}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Start Date">
            <input type="date" className="input-field" value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="Due Date">
            <input type="date" className="input-field" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Progress %">
            <input type="number" min="0" max="100" className="input-field" value={form.progress} onChange={set('progress')} />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Order' : 'Create Order'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Planning
