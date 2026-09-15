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

export default function OverviewPanel({ summary, onSearch }) {
  const [q, setQ] = useState({ batchNumber: '', passNumber: '', employee: '', department: '', metal: '', workOrder: '' })
  const [results, setResults] = useState([])

  const search = async (e) => {
    e.preventDefault()
    const data = await onSearch?.(q)
    setResults(data?.batches || [])
  }

  const metalByDept = summary?.metalByDepartment || []
  const statusCounts = summary?.statusCounts || []
  const maxStatus = Math.max(1, ...statusCounts.map((s) => s.count || 0))
  const maxMetal = Math.max(1, ...metalByDept.map((r) => Number(r.weight) || 0))
  const kpis = summary?.kpis || {}
  const rework = statusCounts.find((s) => s.status === 'REWORK')?.count ?? 0
  const hold = statusCounts.find((s) => s.status === 'HOLD')?.count ?? kpis.onHold ?? 0

  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeBatches ?? 0}</div><div className="pcc-kpi-label">Active WIP</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.completedToday ?? 0}</div><div className="pcc-kpi-label">Completed today</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcPending ?? 0}</div><div className="pcc-kpi-label">QC pending</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.qcFailed ?? 0}</div><div className="pcc-kpi-label">QC failed</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{rework}</div><div className="pcc-kpi-label">Rework</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{hold}</div><div className="pcc-kpi-label">On hold</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.metalInProduction)}</div><div className="pcc-kpi-label">Metal WIP</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.scrapTotal)}</div><div className="pcc-kpi-label">Scrap</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.lossTotal)}</div><div className="pcc-kpi-label">Loss</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{formatGrams(kpis.recoveredTotal)}</div><div className="pcc-kpi-label">Recovered</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.machinesRunning ?? 0}</div><div className="pcc-kpi-label">Machines running</div></div>
        <div className="pcc-kpi"><div className="pcc-kpi-value">{kpis.activeWorkOrders ?? 0}</div><div className="pcc-kpi-label">Active WOs</div></div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>WHERE IS MY METAL?</h2></div>
        <form className="pcc-form pcc-form-grid" onSubmit={search}>
          <label>
            Batch
            <input value={q.batchNumber} onChange={(e) => setQ({ ...q, batchNumber: e.target.value })} />
          </label>
          <label>
            Pass
            <input value={q.passNumber} onChange={(e) => setQ({ ...q, passNumber: e.target.value })} />
          </label>
          <label>
            Work order
            <input value={q.workOrder} onChange={(e) => setQ({ ...q, workOrder: e.target.value })} />
          </label>
          <label>
            Employee
            <input value={q.employee} onChange={(e) => setQ({ ...q, employee: e.target.value })} />
          </label>
          <label>
            Department
            <input value={q.department} onChange={(e) => setQ({ ...q, department: e.target.value })} />
          </label>
          <label>
            Metal
            <input value={q.metal} onChange={(e) => setQ({ ...q, metal: e.target.value })} />
          </label>
          <button type="submit" className="pcc-btn">Search</button>
        </form>
        {results.length > 0 && (
          <div className="pcc-table-wrap" style={{ marginTop: 12 }}>
            <table className="pcc-table">
              <thead>
                <tr><th>Batch</th><th>Weight</th><th>Dept</th><th>Holder</th><th>Process</th><th>Status</th></tr>
              </thead>
              <tbody>
                {results.map((b) => (
                  <tr key={b._id}>
                    <td>{b.batchNumber}</td>
                    <td><PccWeightDisplay grams={b.currentWeight} /></td>
                    <td>{b.currentDepartment}</td>
                    <td>{b.currentHolderName || '—'}</td>
                    <td>{b.currentProcess || '—'}</td>
                    <td><PccStatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pcc-split">
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>BATCHES BY STATUS</h2></div>
          {statusCounts.length === 0 ? <PccEmptyState message="No status aggregates" /> : (
            <div className="pcc-bars">
              {statusCounts.map((row) => (
                <div key={row.status} className="pcc-bar-row">
                  <span>{row.status}</span>
                  <div className="pcc-bar-track">
                    <div className="pcc-bar-fill" style={{ width: `${(row.count / maxStatus) * 100}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h2>METAL BY DEPARTMENT</h2></div>
          {metalByDept.length === 0 ? <PccEmptyState message="No metal in production" /> : (
            <div className="pcc-bars">
              {metalByDept.map((row, i) => (
                <div key={`${row.department}-${row.metalType}-${i}`} className="pcc-bar-row">
                  <span>{String(row.department || '').toUpperCase()} · {row.metalType}</span>
                  <div className="pcc-bar-track">
                    <div className="pcc-bar-fill" style={{ width: `${(Number(row.weight) / maxMetal) * 100}%` }} />
                  </div>
                  <strong>{formatGrams(row.weight)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>CUSTODY SNAPSHOT</h2></div>
        {(summary?.custody || []).length === 0 ? <PccEmptyState message="No custody rows" /> : (
          <ul className="pcc-list">
            {summary.custody.slice(0, 12).map((c, i) => (
              <li key={`${c.person}-${i}`}>
                <strong>{c.person}</strong>
                <span>{c.department} · {formatGrams(c.weight)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

