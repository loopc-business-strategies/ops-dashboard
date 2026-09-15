import { useCallback, useEffect, useState } from 'react'
import { usePccApi, useWorkOrdersApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { DEMO_WRITE_MSG } from '../demo/pccApiAdapter'
import { formatGrams, formatTime, canPcc, na, rowsToCsv, downloadCsv } from '../shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { inventoryApi } from '../../../api/operations/inventory'
import { useDebounced, canIssueGate, toastMsg } from './panelHelpers'

export default function MyTasksPanel({ onToast, onNavigate, onSelectBatch }) {
  const pccApi = usePccApi()
  const [tasks, setTasks] = useState([])
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await pccApi.getMyTasks()
      setTasks(data.tasks || [])
      setCounts(data.counts || null)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const openTask = (t) => {
    if (t.type === 'receive_pass' || t.type === 'handover_pending') {
      onNavigate?.('passes')
      return
    }
    if (t.type === 'complete_process') {
      onNavigate?.('processes')
      return
    }
    if (t.type === 'qc_pending') {
      if (t.batchId) onSelectBatch?.(t.batchId)
      onNavigate?.('qc')
      return
    }
    if (t.type === 'alert') {
      onNavigate?.('alerts')
    }
  }

  const groups = [
    { id: 'critical', label: 'CRITICAL', items: tasks.filter((t) => t.priority === 'critical') },
    { id: 'attention', label: 'ATTENTION', items: tasks.filter((t) => t.priority === 'attention') },
    { id: 'normal', label: 'NORMAL', items: tasks.filter((t) => t.priority === 'normal') },
  ]

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-strip">
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.total, 0)}</div><div className="pcc-kpi-label">Total</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.receive, 0)}</div><div className="pcc-kpi-label">Receive</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.handover, 0)}</div><div className="pcc-kpi-label">Handover</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.process, 0)}</div><div className="pcc-kpi-label">Process</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{na(counts?.qc, 0)}</div><div className="pcc-kpi-label">QC</div></div>
      </div>
      {loading ? <PccSkeleton rows={4} /> : tasks.length === 0 ? (
        <PccEmptyState message="No tasks assigned to you" />
      ) : groups.map((g) => (
        g.items.length === 0 ? null : (
          <div key={g.id} className="pcc-panel">
            <div className="pcc-panel-head"><h2>{g.label}</h2></div>
            <ul className="pcc-list">
              {g.items.map((t) => (
                <li key={t.id}>
                  <strong>{t.title}</strong>
                  <span>{t.subtitle}</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => openTask(t)}>Open</button>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}
    </div>
  )
}

