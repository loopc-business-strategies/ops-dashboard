import { useState } from 'react'
import {
  USE_SEED_DATA, C, Badge, SectionHeader, Modal, Field,
  linesForUi, DEFAULT_QC, QC_STATUS,
} from './shared'

// ── Quality Control ───────────────────────────────
function QualityControl({ canEdit, showToast }) {
  const [checks, setChecks] = useState(USE_SEED_DATA ? DEFAULT_QC : [])
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ product: '', line: 'L1', batch: '', inspector: '', passed: '', failed: '' })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => {
    setEditId(null)
    setForm({ product: '', line: 'L1', batch: '', inspector: '', passed: '', failed: '' })
    setModal(true)
  }

  const openEdit = item => {
    setEditId(item.id)
    setForm({ product: item.product, line: item.line, batch: item.batch, inspector: item.inspector, passed: String(item.passed), failed: String(item.failed) })
    setModal(true)
  }

  const deleteCheck = item => {
    if (!window.confirm(`Delete QC check for batch ${item.batch}?`)) return
    setChecks(p => p.filter(x => x.id !== item.id))
    showToast('QC Check Deleted', `Batch ${item.batch} removed.`)
  }

  const handleLog = e => {
    e.preventDefault()
    if (!form.product.trim() || !form.batch.trim()) return
    const passed = parseInt(form.passed) || 0
    const failed = parseInt(form.failed) || 0
    const total  = passed + failed
    const defectRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0'
    const payload = {
      id: editId || Date.now(),
      ...form,
      passed,
      failed,
      defectRate: parseFloat(defectRate),
      status: parseFloat(defectRate) < 2.5 ? 'approved' : 'review',
      date: new Date().toISOString().slice(0, 10),
    }
    if (editId) {
      setChecks(p => p.map(x => x.id === editId ? payload : x))
      showToast('QC Check Updated', `Batch ${form.batch} updated.`)
    } else {
      setChecks(p => [payload, ...p])
      showToast('Quality Check Logged', `Batch ${form.batch} recorded.`)
    }
    setEditId(null)
    setModal(false)
  }

  const avgDefect = (checks.reduce((s, c) => s + c.defectRate, 0) / checks.length).toFixed(1)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quality Control"
        sub={`Avg defect rate: ${avgDefect}% — Target: < 2.5%`}
        action={canEdit && (
          <button onClick={openAdd} className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90"
                  style={{ background: C.grad }}>+ Log QC Check</button>
        )}
      />

      {/* Defect Rate Bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4">Defect Rate by Batch</h4>
        <div className="space-y-3">
          {checks.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-36 shrink-0 truncate">{c.batch}</span>
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${Math.min(100, c.defectRate * 10)}%`,
                              background: c.defectRate < 2.5 ? '#22c55e' : c.defectRate < 4 ? '#eab308' : '#ef4444' }} />
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">{c.defectRate}%</span>
              <Badge color={c.defectRate < 2.5 ? 'green' : 'yellow'}>{c.defectRate < 2.5 ? '✓' : '!'}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-red-500/30 relative">
            <span className="absolute right-0 -top-4 text-xs text-red-400">2.5% limit</span>
          </div>
        </div>
      </div>

      {/* QC Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Product', 'Batch', 'Line', 'Inspector', 'Date', 'Passed', 'Failed', 'Defect %', 'Status', ...(canEdit ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {checks.map(c => (
              <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4 font-medium text-white">{c.product}</td>
                <td className="py-3 pr-4 font-mono text-xs text-violet-400">{c.batch}</td>
                <td className="py-3 pr-4 text-gray-400">{c.line}</td>
                <td className="py-3 pr-4 text-gray-400">{c.inspector}</td>
                <td className="py-3 pr-4 text-gray-400">{c.date}</td>
                <td className="py-3 pr-4 text-green-400">{c.passed.toLocaleString()}</td>
                <td className="py-3 pr-4 text-red-400">{c.failed}</td>
                <td className="py-3 pr-4">
                  <span className={c.defectRate < 2.5 ? 'text-green-400' : c.defectRate < 4 ? 'text-yellow-400' : 'text-red-400'}>
                    {c.defectRate}%
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <Badge color={QC_STATUS[c.status]?.badge || 'gray'}>{QC_STATUS[c.status]?.label}</Badge>
                </td>
                {canEdit && (
                  <td className="py-3 pr-4">
                    <button onClick={() => openEdit(c)} className="text-xs px-3 py-1 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">Edit</button>
                    <button onClick={() => deleteCheck(c)} className="text-xs px-3 py-1 ml-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editId ? 'Edit Quality Check' : 'Log Quality Check'} onClose={() => setModal(false)}>
        <form onSubmit={handleLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product" required>
            <input className="input-field" value={form.product} onChange={set('product')} placeholder="e.g. Gold Bar 99.99%" />
          </Field>
          <Field label="Batch ID" required>
            <input className="input-field" value={form.batch} onChange={set('batch')} placeholder="e.g. B-2406-005" />
          </Field>
          <Field label="Line">
            <select className="input-field" value={form.line} onChange={set('line')}>
              {linesForUi.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
            </select>
          </Field>
          <Field label="Inspector">
            <input className="input-field" value={form.inspector} onChange={set('inspector')} placeholder="e.g. QC Team A" />
          </Field>
          <Field label="Units Passed">
            <input type="number" min="0" className="input-field" value={form.passed} onChange={set('passed')} />
          </Field>
          <Field label="Units Failed">
            <input type="number" min="0" className="input-field" value={form.failed} onChange={set('failed')} />
          </Field>
          <div className="md:col-span-2 flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
                    style={{ background: C.grad }}>{editId ? 'Update QC Check' : 'Log QC Check'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default QualityControl
