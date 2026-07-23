import { useState } from 'react'
import {
  USE_SEED_DATA, C, Badge, SectionHeader, Modal, Field,
  linesForUi, DEFAULT_ALERTS, ALERT_TYPES,
} from './shared'

// ── Alerts & Reports ──────────────────────────────
function AlertsReports({ canEdit, showToast }) {
  const [alerts, setAlerts] = useState(USE_SEED_DATA ? DEFAULT_ALERTS : [])
  const [filter, setFilter] = useState('all')
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ type: 'warning', category: 'production', line: 'L1', title: '', msg: '' })
  const openAdd = () => {
    setEditId(null)
    setForm({ type: 'warning', category: 'production', line: 'L1', title: '', msg: '' })
    setModal(true)
  }

  const openEdit = alert => {
    setEditId(alert.id)
    setForm({ type: alert.type, category: alert.category, line: alert.line, title: alert.title, msg: alert.msg })
    setModal(true)
  }

  const deleteAlert = alert => {
    if (!window.confirm('Delete this alert?')) return
    setAlerts(p => p.filter(x => x.id !== alert.id))
    showToast('Alert Deleted', 'Alert removed from list.')
  }


  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const ack = id => {
    setAlerts(p => p.map(a => a.id === id ? { ...a, ack: true } : a))
    showToast('Alert Acknowledged', 'Alert has been acknowledged.')
  }

  const handleReport = e => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (editId) {
      setAlerts(p => p.map(a => a.id === editId ? { ...a, ...form } : a))
      showToast('Alert Updated', `Alert "${form.title}" updated.`)
    } else {
      setAlerts(p => [{ ...form, id: Date.now(), time: new Date().toISOString().slice(0, 16).replace('T', ' '), ack: false }, ...p])
      showToast('Issue Reported', `Alert "${form.title}" created.`)
    }
    setEditId(null)
    setModal(false)
  }

  const filtered = filter === 'all' ? alerts : filter === 'unacked' ? alerts.filter(a => !a.ack) : alerts.filter(a => a.type === filter)

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Alerts & Reports"
        sub={`${alerts.filter(a => !a.ack).length} unacknowledged alerts`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Report Issue</button>
        )}
      />

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {[['all', 'All'], ['unacked', 'Unacknowledged'], ['critical', '🔴 Critical'], ['warning', '🟡 Warning'], ['info', '🔵 Info']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    filter === v
                      ? 'text-violet-400 border-violet-500 border-b-2'
                      : 'text-gray-400 border-gray-700 hover:text-white hover:border-gray-600'
                  }`}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">No alerts matching this filter</div>
        )}
        {filtered.map(a => {
          const at = ALERT_TYPES[a.type] || ALERT_TYPES.info
          return (
            <div key={a.id} className={`bg-gray-900 border rounded-xl p-4 transition-all ${a.ack ? 'border-gray-800 opacity-60' : 'border-gray-700'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{at.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-white">{a.title}</span>
                    <Badge color={at.badge}>{a.type}</Badge>
                    <Badge color="gray">{a.category}</Badge>
                    <Badge color="violet">{a.line}</Badge>
                    {a.ack && <Badge color="gray">Acknowledged</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">{a.msg}</p>
                  <p className="text-xs text-gray-600 mt-1">{a.time}</p>
                </div>
                {!a.ack && canEdit && (
                  <button onClick={() => ack(a.id)}
                          className="text-xs px-3 py-1.5 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors shrink-0">
                    Acknowledge
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => openEdit(a)}
                          className="text-xs px-3 py-1.5 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0">
                    Edit
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => deleteAlert(a)}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={modal} title={editId ? 'Edit Alert' : 'Report Issue'} onClose={() => setModal(false)}>
        <form onSubmit={handleReport} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Alert Type">
              <select className="input-field" value={form.type} onChange={set('type')}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Category">
              <select className="input-field" value={form.category} onChange={set('category')}>
                {['production', 'equipment', 'quality', 'maintenance', 'safety'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Production Line">
              <select className="input-field" value={form.line} onChange={set('line')}>
                {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Issue Title" required>
            <input className="input-field" value={form.title} onChange={set('title')} placeholder="Brief description of the issue" />
          </Field>
          <Field label="Details">
            <textarea className="input-field resize-none" rows={3} value={form.msg} onChange={set('msg')} placeholder="Full description…" />
          </Field>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update Alert' : 'Submit Report'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AlertsReports
