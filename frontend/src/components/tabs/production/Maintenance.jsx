import { useState } from 'react'
import {
  USE_SEED_DATA, C, Badge, SectionHeader, Modal, Field,
  DEFAULT_WORK_ORDERS, DEFAULT_EQUIPMENT, WO_STATUS, WO_PRIORITY,
} from './shared'

// ── Maintenance ───────────────────────────────────
function Maintenance({ canEdit, showToast }) {
  const [orders, setOrders] = useState(USE_SEED_DATA ? DEFAULT_WORK_ORDERS : [])
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ equipment: '', type: 'preventive', priority: 'medium', status: 'open', assignee: '', scheduled: '', desc: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const approve = id => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status: 'approved' } : o))
    showToast('Work Order Approved', `WO ${id} has been approved.`)
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ equipment: '', type: 'preventive', priority: 'medium', status: 'open', assignee: '', scheduled: '', desc: '' })
    setModal(true)
  }

  const openEdit = order => {
    setEditId(order.id)
    setForm({
      equipment: order.equipment,
      type: order.type,
      priority: order.priority,
      status: order.status,
      assignee: order.assignee,
      scheduled: order.scheduled || '',
      desc: order.desc || '',
    })
    setModal(true)
  }

  const deleteOrder = order => {
    if (!window.confirm(`Delete work order ${order.id}?`)) return
    setOrders(p => p.filter(x => x.id !== order.id))
    showToast('Work Order Deleted', `${order.id} removed.`)
  }

  const handleCreate = e => {
    e.preventDefault()
    if (!form.equipment.trim()) return
    if (editId) {
      setOrders(p => p.map(o => o.id === editId ? { ...o, ...form } : o))
      showToast('Work Order Updated', `${editId} has been updated.`)
    } else {
      const id = `WO-${String(orders.length + 1).padStart(3, '0')}`
      setOrders(p => [...p, { ...form, id, reported: new Date().toISOString().slice(0, 10) }])
      showToast('Work Order Created', `${id} has been created.`)
    }
    setEditId(null)
    setModal(false)
  }

  const MAINT_CAL = [
    { date: '2026-04-14', label: 'CNC #1 Lube', type: 'preventive' },
    { date: '2026-04-15', label: 'Furnace B2', type: 'corrective' },
    { date: '2026-04-17', label: 'Press P4', type: 'predictive' },
    { date: '2026-04-20', label: 'Filter Replace', type: 'preventive' },
    { date: '2026-04-22', label: 'Full Inspection', type: 'preventive' },
  ]

  const typeColor = { preventive: 'blue', corrective: 'red', predictive: 'violet' }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Maintenance Management"
        sub={`${orders.filter(o => o.status !== 'closed').length} open work orders`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: C.grad }}>+ Create Work Order</button>
        )}
      />

      {/* Work Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['ID', 'Equipment', 'Type', 'Priority', 'Status', 'Assignee', 'Scheduled', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 leading-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-mono text-xs text-violet-400 leading-tight">{o.id}</td>
                <td className="py-3 pr-4 font-medium text-white max-w-[180px] truncate leading-tight">{o.equipment}</td>
                <td className="py-3 pr-4"><Badge color={typeColor[o.type] || 'gray'}>{o.type}</Badge></td>
                <td className="py-3 pr-4"><Badge color={WO_PRIORITY[o.priority]?.badge || 'gray'}>{WO_PRIORITY[o.priority]?.label}</Badge></td>
                <td className="py-3 pr-4"><Badge color={WO_STATUS[o.status]?.badge || 'gray'}>{WO_STATUS[o.status]?.label}</Badge></td>
                <td className="py-3 pr-4 text-gray-400 leading-tight">{o.assignee}</td>
                <td className="py-3 pr-4 text-gray-400 leading-tight">{o.scheduled || '—'}</td>
                {canEdit && (
                  <td className="py-3">
                    {o.status === 'open' && (
                      <button onClick={() => approve(o.id)}
                              className="text-xs px-3 py-1 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                        Approve
                      </button>
                    )}
                    <button onClick={() => openEdit(o)}
                            className="text-xs px-3 py-1 ml-2 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => deleteOrder(o)}
                            className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Maintenance Calendar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Upcoming Maintenance — April 2026</h4>
        <div className="grid grid-cols-7 gap-2 text-center">
          {['14', '15', '16', '17', '18', '19', '20'].map((d) => {
            const events = MAINT_CAL.filter(e => e.date.endsWith(`-${d}`))
            return (
              <div key={d} className="bg-gray-800/50 rounded-lg p-2 min-h-[72px]">
                <p className="text-xs text-gray-500 mb-1">Apr {d}</p>
                {events.map(ev => (
                  <div key={ev.label} className={`text-xs rounded px-1 py-0.5 mb-1 ${
                    ev.type === 'corrective' ? 'bg-red-500/20 text-red-400' :
                    ev.type === 'predictive' ? 'bg-violet-500/20 text-violet-400' :
                    'bg-blue-500/20 text-blue-400'}`}>{ev.label}</div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3">
          {[['blue', 'Preventive'], ['red', 'Corrective'], ['violet', 'Predictive']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-sm bg-${c}-500/40 inline-block`} />{l}
            </span>
          ))}
        </div>
      </div>

      <Modal open={modal} title={editId ? 'Edit Work Order' : 'Create Work Order'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment" required>
            <select className="input-field" value={form.equipment} onChange={set('equipment')}>
              <option value="">Select equipment…</option>
              {DEFAULT_EQUIPMENT.map(eq => <option key={eq.id} value={eq.name}>{eq.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="input-field" value={form.type} onChange={set('type')}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
              <option value="predictive">Predictive</option>
            </select>
          </Field>
          <Field label="Priority">
            <select className="input-field" value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Assignee">
            <input className="input-field" value={form.assignee} onChange={set('assignee')} placeholder="e.g. Maint Team A" />
          </Field>
          <Field label="Scheduled Date">
            <input type="date" className="input-field" value={form.scheduled} onChange={set('scheduled')} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea className="input-field resize-none" rows={3} value={form.desc} onChange={set('desc')} placeholder="Describe the maintenance task…" />
            </Field>
          </div>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Work Order' : 'Create Work Order'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Maintenance
