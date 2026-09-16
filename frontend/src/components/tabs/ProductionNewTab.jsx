import ProductionNewDetails from '../production-new/ProductionNewDetails'
import ProductionNewDeptCard from '../production-new/ProductionNewDeptCard'
import { useProductionNewDashboard } from '../production-new/useProductionNewDashboard'
import { formatClock } from '../production-control/shared'
import './ProductionNewTab.css'

export default function ProductionNewTab() {
  const { loading, error, details, cards, lastUpdated, refresh } = useProductionNewDashboard()

  return (
    <div className="prod-new-page">
      <header className="prod-new-header">
        <div>
          <h1 className="prod-new-title">Production New</h1>
          <p className="prod-new-sub">
            Live floor overview · read-only
            {lastUpdated ? ` · Updated ${formatClock(lastUpdated)}` : ''}
          </p>
        </div>
        <button type="button" className="prod-new-refresh" onClick={() => refresh()} disabled={loading}>
          Refresh
        </button>
      </header>

      {loading && !details ? (
        <div className="prod-new-skeleton" aria-busy="true">
          <div className="prod-new-skel-block" />
          <div className="prod-new-skel-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="prod-new-skel-card" />
            ))}
          </div>
        </div>
      ) : null}

      {error && !details ? (
        <div className="prod-new-error" role="alert">
          <p>{error}</p>
          <button type="button" className="prod-new-refresh" onClick={() => refresh()}>Retry</button>
        </div>
      ) : null}

      {error && details ? (
        <p className="prod-new-banner-warn" role="status">Partial data: {error}</p>
      ) : null}

      {details || (!loading && !error) ? (
        <>
          <ProductionNewDetails details={details} />
          <section className="prod-new-cards-section" aria-label="Department process cards">
            <h2 className="prod-new-section-title">Departments / Processes</h2>
            <div className="prod-new-cards-grid">
              {(cards || []).map((card) => (
                <ProductionNewDeptCard key={card.key} card={card} />
              ))}
            </div>
            {!cards?.length ? (
              <p className="prod-new-muted">No department stages available.</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
