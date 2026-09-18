import { useMemo, useState } from 'react'
import { formatGrams } from './formatters'
import { FlowIcon } from './PdIcons'

function formatLedgerDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function MaterialFlowPanel({ materialFlow, stockSummary, stockLedger = [], stockLedgerLoading = false }) {
  const stages = materialFlow || []
  const stock = stockSummary || {}
  const [metalFilter, setMetalFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [refFilter, setRefFilter] = useState('')

  const filteredLedger = useMemo(() => {
    const rows = Array.isArray(stockLedger) ? stockLedger : []
    return rows.filter((row) => {
      if (metalFilter && !String(row.metal || '').toLowerCase().includes(metalFilter.toLowerCase())) return false
      if (typeFilter && !String(row.type || '').toLowerCase().includes(typeFilter.toLowerCase())) return false
      if (sourceFilter && !String(row.source || '').toLowerCase().includes(sourceFilter.toLowerCase())) return false
      if (refFilter) {
        const hay = `${row.reference || ''} ${row.supplier || ''} ${row.reason || ''}`.toLowerCase()
        if (!hay.includes(refFilter.toLowerCase())) return false
      }
      return true
    })
  }, [stockLedger, metalFilter, typeFilter, sourceFilter, refFilter])

  return (
    <section className="pd-flow-row" aria-label="Material flow and stock">
      <div className="pd-panel pd-material-flow">
        <div className="pd-panel-head">
          <h2 className="pd-panel-title">Material Flow / Stock Movement</h2>
        </div>
        <div className="pd-flow-rail">
          {stages.map((stage, idx) => {
            const active = stage.status && stage.status !== 'Idle'
            return (
              <div key={stage.key} className="pd-flow-stage">
                {idx > 0 ? <span className="pd-flow-arrow" aria-hidden>→</span> : null}
                <div className={`pd-flow-node${active ? ' pd-flow-node--active' : ''}`}>
                  <span className="pd-flow-node-icon" aria-hidden>
                    <FlowIcon stageKey={stage.key} />
                  </span>
                  <strong>{stage.label}</strong>
                  <span>{stage.weight != null ? formatGrams(stage.weight) : '—'}</span>
                  <em className="pd-flow-status">{stage.status || 'Idle'}</em>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pd-panel pd-stock-summary">
        <div className="pd-panel-head">
          <h2 className="pd-panel-title">Stock Summary</h2>
        </div>
        <div className="pd-stock-grid">
          <div className="pd-stock-tile pd-stock-tile--unprocessed">
            <span>Unprocessed</span>
            <strong>{stock.unprocessed != null ? formatGrams(stock.unprocessed) : '—'}</strong>
          </div>
          <div className="pd-stock-tile pd-stock-tile--processing">
            <span>Under Processing</span>
            <strong>{stock.underProcessing != null ? formatGrams(stock.underProcessing) : '—'}</strong>
          </div>
          <div className="pd-stock-tile pd-stock-tile--finished">
            <span>Finished Goods</span>
            <strong>{stock.finishedGoods != null ? formatGrams(stock.finishedGoods) : '—'}</strong>
          </div>
          <div className="pd-stock-tile pd-stock-tile--total">
            <span>Total Stock Balance</span>
            <strong>{stock.totalBalance != null ? formatGrams(stock.totalBalance) : '—'}</strong>
          </div>
        </div>
        <div className="pd-movement">
          <p className="pd-movement-title">Movement Today</p>
          <div className="pd-movement-grid">
            <div className="pd-movement-item">
              <span>In</span>
              <strong>{stock.movementIn != null ? formatGrams(stock.movementIn) : '—'}</strong>
            </div>
            <div className="pd-movement-item">
              <span>Out</span>
              <strong>{stock.movementOut != null ? formatGrams(stock.movementOut) : '—'}</strong>
            </div>
            <div className="pd-movement-item">
              <span>WIP</span>
              <strong>{stock.movementWip != null ? formatGrams(stock.movementWip) : '—'}</strong>
            </div>
          </div>
        </div>

        <div className="pd-stock-ledger">
          <p className="pd-movement-title">Movement ledger</p>
          <div className="pd-stock-ledger-filters">
            <input
              type="search"
              placeholder="Metal"
              value={metalFilter}
              onChange={(e) => setMetalFilter(e.target.value)}
              aria-label="Filter by metal"
            />
            <input
              type="search"
              placeholder="Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by movement type"
            />
            <input
              type="search"
              placeholder="Source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Filter by source"
            />
            <input
              type="search"
              placeholder="Ref / supplier"
              value={refFilter}
              onChange={(e) => setRefFilter(e.target.value)}
              aria-label="Filter by reference"
            />
          </div>
          {stockLedgerLoading ? (
            <p className="pd-stock-ledger-empty">Loading movements…</p>
          ) : (
            <div className="pd-stock-ledger-scroll">
              <table className="pd-stock-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Ref</th>
                    <th>Metal</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((row) => (
                    <tr key={row.id}>
                      <td>{formatLedgerDate(row.date)}</td>
                      <td>{row.type || '—'}</td>
                      <td>{row.source || '—'}</td>
                      <td title={row.supplier ? `Supplier: ${row.supplier}` : undefined}>{row.reference || '—'}</td>
                      <td>{row.metal || '—'}{row.purity ? ` · ${row.purity}` : ''}</td>
                      <td>{row.inQty != null ? formatGrams(row.inQty) : '—'}</td>
                      <td>{row.outQty != null ? formatGrams(row.outQty) : '—'}</td>
                      <td>{row.balance != null ? formatGrams(row.balance) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredLedger.length ? (
                <p className="pd-stock-ledger-empty">No stock movements for the current filters.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
