import { formatGrams } from './formatters'

export default function MaterialFlowPanel({ materialFlow, stockSummary }) {
  const stages = materialFlow || []
  const stock = stockSummary || {}

  return (
    <section className="pd-flow-row" aria-label="Material flow and stock">
      <div className="pd-panel pd-material-flow">
        <div className="pd-panel-head">
          <h2 className="pd-panel-title">Material Flow</h2>
        </div>
        <div className="pd-flow-rail">
          {stages.map((stage, idx) => {
            const active = stage.status && stage.status !== 'Idle'
            return (
              <div key={stage.key} className="pd-flow-stage">
                {idx > 0 ? <span className="pd-flow-arrow" aria-hidden>→</span> : null}
                <div className={`pd-flow-node${active ? ' pd-flow-node--active' : ''}`}>
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
          <div className="pd-stock-tile">
            <span>Unprocessed</span>
            <strong>{stock.unprocessed != null ? formatGrams(stock.unprocessed) : '—'}</strong>
          </div>
          <div className="pd-stock-tile">
            <span>Under Processing</span>
            <strong>{stock.underProcessing != null ? formatGrams(stock.underProcessing) : '—'}</strong>
          </div>
          <div className="pd-stock-tile">
            <span>Finished</span>
            <strong>{stock.finishedGoods != null ? formatGrams(stock.finishedGoods) : '—'}</strong>
          </div>
          <div className="pd-stock-tile pd-stock-tile--total">
            <span>Total Stock Balance</span>
            <strong>{stock.totalBalance != null ? formatGrams(stock.totalBalance) : '—'}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
