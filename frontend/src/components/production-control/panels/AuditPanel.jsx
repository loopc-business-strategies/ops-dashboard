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

export default function AuditPanel({ onToast }) {
  const pccApi = usePccApi()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    pccApi.listAudit()
      .then((d) => setRows(d.logs || []))
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load audit'))
      .finally(() => setLoading(false))
  }, [pccApi, onToast])
  const filtered = search
    ? rows.filter((r) =>
      [r.actorName, r.action, r.resource, r.detail].some((x) => String(x || '').toLowerCase().includes(search.toLowerCase())))
    : rows
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>AUDIT LOG</h2></div>
      <div className="pcc-toolbar">
        <label>Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User, action, detail…" />
        </label>
        {search && <button type="button" className="pcc-btn-ghost" onClick={() => setSearch('')}>Clear filters</button>}
      </div>
      {loading ? <PccSkeleton rows={4} /> : filtered.length === 0 ? <PccEmptyState message="No production audit events" /> : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>Detail</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td>{formatTime(r.createdAt)}</td>
                  <td>{r.actorName} ({r.actorRole})</td>
                  <td>{r.action}</td>
                  <td>{r.resource}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

