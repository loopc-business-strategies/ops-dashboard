import { useMemo, useState } from 'react'
import { formatClock, formatGrams } from './formatters'

function statusTone(status) {
  const s = String(status || '').toUpperCase()
  if (['RECEIVED', 'APPROVED', 'COMPLETED'].includes(s)) return 'ok'
  if (['IN_TRANSIT', 'ISSUED'].includes(s)) return 'info'
  if (['CANCELLED'].includes(s)) return 'bad'
  return 'muted'
}

export default function MetalMovementLedger({
  rows = [],
  stockLedger = [],
  loading = false,
  filterDept = null,
  filterBatch = null,
  onRowClick,
  selectedId,
}) {
  const [q, setQ] = useState('')

  const metalRows = useMemo(() => {
    const list = Array.isArray(rows) && rows.length
      ? rows
      : (stockLedger || []).map((r, i) => ({
        id: r.id || `stock-${i}`,
        movementNumber: r.reference || r.id || `ST-${i}`,
        time: r.date,
        batch: r.reference || '—',
        batchId: null,
        from: r.source || '—',
        to: r.type || '—',
        weight: r.outQty ?? r.inQty,
        operator: r.actorName || '—',
        status: r.type || 'ERP',
      }))
    return list.filter((row) => {
      if (filterDept) {
        const d = String(filterDept).toLowerCase()
        const hay = `${row.from} ${row.to}`.toLowerCase()
        if (!hay.includes(d.replace(/_/g, ' ')) && !hay.includes(d)) return false
      }
      if (filterBatch) {
        if (String(row.batchId) !== String(filterBatch) && String(row.batch) !== String(filterBatch)) return false
      }
      if (q) {
        const hay = `${row.movementNumber} ${row.batch} ${row.from} ${row.to} ${row.operator}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [rows, stockLedger, filterDept, filterBatch, q])

  return (
    <section className="pd-panel pd-metal-ledger" aria-label="Metal movement ledger">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Metal Movement Ledger</h2>
        <input
          type="search"
          className="pd-inline-search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search movements"
        />
      </div>
      {loading ? (
        <p className="pd-empty">Loading movements…</p>
      ) : (
        <div className="pd-table-wrap pd-table-wrap--compact">
          <table className="pd-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Time</th>
                <th>Batch</th>
                <th>From</th>
                <th>To</th>
                <th>Weight</th>
                <th>Operator</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metalRows.map((row) => {
                const tone = statusTone(row.status)
                return (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? 'pd-row--selected' : ''}
                    onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? 'pointer' : undefined }}
                  >
                    <td>{row.movementNumber}</td>
                    <td>{row.time ? formatClock(row.time) : '—'}</td>
                    <td>{row.batch}</td>
                    <td>{row.from}</td>
                    <td>{row.to}</td>
                    <td>{row.weight != null ? formatGrams(row.weight) : '—'}</td>
                    <td>{row.operator}</td>
                    <td>
                      <span className={`pd-status-pill pd-status-pill--sm pd-status-pill--${tone}`}>
                        {row.status === 'RECEIVED' ? 'Approved' : row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!metalRows.length ? <p className="pd-empty">No metal movements</p> : null}
        </div>
      )}
    </section>
  )
}
