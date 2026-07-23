import { useState } from 'react'
import {
  USE_SEED_DATA, C, Badge, SectionHeader, Modal, Field,
  linesForUi, DEFAULT_EQUIPMENT, EQUIP_STATUS,
} from './shared'

// ── Equipment ─────────────────────────────────────
function Equipment({ canEdit, showToast }) {
  const [equipment, setEquipment] = useState(USE_SEED_DATA ? DEFAULT_EQUIPMENT : [])
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', line: 'L1', type: '', status: 'operational', lastMaint: '', nextMaint: '', age: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => { setForm({ name: '', line: 'L1', type: '', status: 'operational', lastMaint: '', nextMaint: '', age: '' }); setEditItem(null); setModal(true) }
  const openEdit = item => { setForm({ name: item.name, line: item.line, type: item.type, status: item.status, lastMaint: item.lastMaint, nextMaint: item.nextMaint, age: item.age }); setEditItem(item.id); setModal(true) }
  const removeItem = item => {
    if (!window.confirm(`Delete equipment "${item.name}"?`)) return
    setEquipment(p => p.filter(eq => eq.id !== item.id))
    showToast('Equipment Deleted', `${item.name} removed from registry.`)
  }

  const handleSave = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editItem) {
      setEquipment(p => p.map(eq => eq.id === editItem ? { ...eq, ...form } : eq))
      showToast('Equipment Updated', `${form.name} has been updated.`)
    } else {
      setEquipment(p => [...p, { ...form, id: Date.now() }])
      showToast('Equipment Added', `${form.name} added to registry.`)
    }
    setModal(false)
  }

  return (
    <div>
      <SectionHeader
        title="Equipment Registry"
        sub={`${equipment.length} pieces of equipment tracked`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: C.grad }}>+ Add Equipment</button>
        )}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Equipment', 'Line', 'Type', 'Status', 'Last Maint.', 'Next Maint.', 'Age', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 leading-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {equipment.map(eq => {
              const st = EQUIP_STATUS[eq.status] || EQUIP_STATUS.idle
              return (
                <tr key={eq.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white leading-tight">{eq.name}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.line}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.type}</td>
                  <td className="py-3 pr-4"><Badge color={st.badge}>{st.label}</Badge></td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.lastMaint || '—'}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.nextMaint || '—'}</td>
                  <td className="py-3 pr-4 text-gray-400 leading-tight">{eq.age}</td>
                  {canEdit && (
                    <td className="py-3">
                      <button onClick={() => openEdit(eq)}
                              className="text-xs px-3 py-1 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => removeItem(eq)}
                              className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editItem ? 'Edit Equipment' : 'Add Equipment'} onClose={() => setModal(false)} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment Name" required>
            <input className="input-field" value={form.name} onChange={set('name')} placeholder="e.g. Gold Refinery Unit A" />
          </Field>
          <Field label="Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id} — {l.name.split('—')[1]?.trim()}</option>)}
            </select>
          </Field>
          <Field label="Equipment Type">
            <input className="input-field" value={form.type} onChange={set('type')} placeholder="e.g. Furnace, CNC, Press" />
          </Field>
          <Field label="Status">
            <select className="input-field" value={form.status} onChange={set('status')}>
              {Object.entries(EQUIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Last Maintenance">
            <input type="date" className="input-field" value={form.lastMaint} onChange={set('lastMaint')} />
          </Field>
          <Field label="Next Maintenance">
            <input type="date" className="input-field" value={form.nextMaint} onChange={set('nextMaint')} />
          </Field>
          <Field label="Equipment Age">
            <input className="input-field" value={form.age} onChange={set('age')} placeholder="e.g. 2y 3m" />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
                    style={{ background: C.grad }}>
              {editItem ? 'Update Equipment' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Equipment
