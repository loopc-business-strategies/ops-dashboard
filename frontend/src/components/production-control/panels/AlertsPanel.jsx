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

export default function AlertsPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [rows, setRows] = useState([])
  const load = useCallback(async () => {
    const d = await pccApi.listAlerts({ limit: 100 })
    setRows(d.alerts || [])
  }, [pccApi])
  useEffect(() => { load().catch(() => {}) }, [load])

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

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>ALERTS</h2></div>
      {rows.length === 0 ? <PccEmptyState message="No production alerts" /> : (
        <ul className="pcc-list">
          {rows.map((a) => (
            <li key={a._id}>
              <strong>{a.alertNumber} · {a.title}</strong>
              <span>{a.message}</span>
              <span><PccStatusBadge status={a.status} /> {a.severity} · {formatTime(a.createdAt)}</span>
              <span className="pcc-actions">
                {a.status === 'OPEN' && (
                  <button type="button" className="pcc-btn-ghost" onClick={() => acknowledge(a._id)}>Acknowledge</button>
                )}
                {a.status !== 'RESOLVED' && (
                  <button type="button" className="pcc-btn-ghost" onClick={() => resolve(a._id)}>Resolve</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

