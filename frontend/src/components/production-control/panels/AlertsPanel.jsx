import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { formatTime, canPcc } from '../shared'
import {
  PccEmptyState,
  PccStatusBadge,
} from '../primitives'
import { toastMsg } from './panelHelpers'

function openAlert(a, { onSelectBatch, onNavigate }) {
  if (a?.batchId) {
    onSelectBatch?.(a.batchId)
    return
  }
  const code = String(a?.code || a?.category || '').toUpperCase()
  if (code.includes('MACHINE') || a?.machineId) {
    onNavigate?.('machines')
    return
  }
  if (code.includes('PASS') || a?.passId) {
    onNavigate?.('passes')
    return
  }
  if (code.includes('DELAY')) {
    onNavigate?.('delay-monitor')
    return
  }
  onNavigate?.('alerts')
}

function severityGroup(severity) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'warning' || s === 'attention') return 'attention'
  return 'normal'
}

export default function AlertsPanel({ onToast, onSelectBatch, onNavigate }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    message: '',
    severity: 'warning',
    category: 'process',
    code: 'MANUAL',
  })

  const load = useCallback(async () => {
    const d = await pccApi.listAlerts({ limit: 100 })
    setRows(d.alerts || [])
  }, [pccApi])
  useEffect(() => { load().catch(() => {}) }, [load])

  const groups = useMemo(() => {
    const critical = []
    const attention = []
    const normal = []
    for (const a of rows) {
      const g = severityGroup(a.severity)
      if (g === 'critical') critical.push(a)
      else if (g === 'attention') attention.push(a)
      else normal.push(a)
    }
    return [
      { id: 'critical', label: 'CRITICAL', items: critical },
      { id: 'attention', label: 'ATTENTION', items: attention },
      { id: 'normal', label: 'NORMAL', items: normal },
    ]
  }, [rows])

  const acknowledge = async (id) => {
    try {
      await pccApi.acknowledgeAlert(id)
      onToast?.(toastMsg(isDemo, 'Alert acknowledged'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Acknowledge failed')
    }
  }

  const resolve = async (id) => {
    try {
      await pccApi.resolveAlert(id)
      onToast?.(toastMsg(isDemo, 'Alert resolved'))
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Resolve failed')
    }
  }

  const raise = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      onToast?.('Title is required')
      return
    }
    try {
      await pccApi.raiseAlert({
        title: form.title.trim(),
        message: form.message.trim(),
        severity: form.severity,
        category: form.category,
        code: form.code || 'MANUAL',
      })
      onToast?.(toastMsg(isDemo, 'Alert raised'))
      setRaiseOpen(false)
      setForm({ title: '', message: '', severity: 'warning', category: 'process', code: 'MANUAL' })
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Raise alert failed')
    }
  }

  const renderAlert = (a) => (
    <li key={a._id}>
      <button
        type="button"
        className="pcc-link"
        onClick={() => openAlert(a, { onSelectBatch, onNavigate })}
      >
        <strong>{a.alertNumber} · {a.title}</strong>
      </button>
      <span>{a.message}</span>
      <span><PccStatusBadge status={a.status} /> {a.severity} · {formatTime(a.createdAt)}</span>
      <span className="pcc-actions">
        {(a.batchId || onNavigate) && (
          <button
            type="button"
            className="pcc-btn-ghost"
            onClick={() => openAlert(a, { onSelectBatch, onNavigate })}
          >
            {a.batchId ? 'Open batch' : 'Open'}
          </button>
        )}
        {a.status === 'OPEN' && (
          <button type="button" className="pcc-btn-ghost" onClick={() => acknowledge(a._id)}>Acknowledge</button>
        )}
        {a.status !== 'RESOLVED' && (
          <button type="button" className="pcc-btn-ghost" onClick={() => resolve(a._id)}>Resolve</button>
        )}
      </span>
    </li>
  )

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>ALERTS</h2>
          <div className="pcc-actions">
            {canPcc('demo', 'raiseAlert') && (
              <button type="button" className="pcc-btn" onClick={() => setRaiseOpen((v) => !v)}>
                {raiseOpen ? 'Cancel' : 'Raise alert'}
              </button>
            )}
            <button type="button" className="pcc-btn-ghost" onClick={() => load().catch(() => {})}>Refresh</button>
          </div>
        </div>

        {raiseOpen && (
          <form className="pcc-form-grid" onSubmit={raise}>
            <label>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Severity
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="process">process</option>
                <option value="weight">weight</option>
                <option value="machine">machine</option>
                <option value="quality">quality</option>
                <option value="stock">stock</option>
                <option value="security">security</option>
              </select>
            </label>
            <label className="pcc-span-2">
              Message
              <textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                rows={2}
              />
            </label>
            <button type="submit" className="pcc-btn">Submit alert</button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="pcc-panel">
          <PccEmptyState
            message="No production alerts"
            hint="Alerts appear when weight variance, machine faults, or QC issues are raised."
          />
        </div>
      ) : groups.map((g) => (
        g.items.length === 0 ? null : (
          <div key={g.id} className="pcc-panel">
            <div className="pcc-panel-head"><h2>{g.label}</h2></div>
            <ul className="pcc-list">
              {g.items.map(renderAlert)}
            </ul>
          </div>
        )
      ))}
    </div>
  )
}
