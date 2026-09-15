import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import {
  PccEmptyState,
  PccStatusBadge,
} from '../primitives'
import { toastMsg } from './panelHelpers'

export default function MachinesPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ machineCode: '', name: '', department: '', process: '' })

  const load = useCallback(async () => {
    const d = await pccApi.listMachines()
    setRows(d.machines || [])
  }, [pccApi])

  useEffect(() => { load().catch(() => {}) }, [load])

  const create = async (e) => {
    e.preventDefault()
    try {
      await pccApi.createMachine(form)
      onToast?.(toastMsg(isDemo, 'Machine added'))
      setForm({ machineCode: '', name: '', department: '', process: '' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  const setStatus = async (id, status) => {
    try {
      await pccApi.updateMachineStatus(id, { status })
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
          <label>
            Code
            <input required value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} />
          </label>
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Department
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </label>
          <label>
            Process
            <input value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="pcc-btn">Add</button>
      </form>
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>MACHINES</h2></div>
        {rows.length === 0 ? <PccEmptyState message="No machines registered" /> : (
          <div className="pcc-table-wrap">
            <table className="pcc-table">
              <thead><tr><th>Code</th><th>Name</th><th>Dept</th><th>Status</th><th>Batch</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>{m.machineCode}</td>
                    <td>{m.name}</td>
                    <td>{m.department || '—'}</td>
                    <td><PccStatusBadge status={m.status} /></td>
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

