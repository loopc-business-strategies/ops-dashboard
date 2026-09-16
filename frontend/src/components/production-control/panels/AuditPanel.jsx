import { useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { formatTime } from '../shared'
import {
  PccEmptyState,
  PccSkeleton,
} from '../primitives'

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
      [r.actorName, r.action, r.resource, r.detail, r.resourceId]
        .some((x) => String(x || '').toLowerCase().includes(search.toLowerCase())))
    : rows
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>AUDIT LOG</h2></div>
      <p className="pcc-muted">Immutable production audit trail. Entries cannot be edited by normal users.</p>
      <div className="pcc-toolbar">
        <label>Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User, action, detail…" />
        </label>
        {search && <button type="button" className="pcc-btn-ghost" onClick={() => setSearch('')}>Clear filters</button>}
      </div>
      {loading ? <PccSkeleton rows={4} /> : filtered.length === 0 ? (
        <PccEmptyState message="No production audit events" hint="Audited actions appear here after production operations." />
      ) : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead>
              <tr>
                <th>When</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td>{formatTime(r.createdAt)}</td>
                  <td>{r.actorName || '—'}{r.actorRole ? ` (${r.actorRole})` : ''}</td>
                  <td>{r.action || '—'}</td>
                  <td>{r.resource || '—'}</td>
                  <td>{r.resourceId || '—'}</td>
                  <td>{r.detail || (r.changes ? JSON.stringify(r.changes) : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
