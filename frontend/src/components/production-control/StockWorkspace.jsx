import { lazy, Suspense } from 'react'
import { STOCK_WORKSPACE_TABS, isStockSection } from './pccSidebarConfig'
import { PccSkeleton } from './primitives'

const StockOverviewPanel = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.StockOverviewPanel })),
)
const StockListPanel = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.StockListPanel })),
)
const NewStockInPanel = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.NewStockInPanel })),
)
const StockHistoryPanel = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.StockHistoryPanel })),
)
const StockAdjustmentsPanel = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.StockAdjustmentsPanel })),
)
const MarkAvailableHelper = lazy(() =>
  import('./StockPanels').then((m) => ({ default: m.MarkAvailableHelper })),
)

const PROCESSING_STATUSES = 'ALLOCATED,UNDER_PROCESSING,DEPARTMENT_PROCESSING,QC_PENDING,QC_PASSED,QC_FAILED,REWORK,HOLD,PACKAGING'

function TabFallback() {
  return (
    <div className="pcc-panel">
      <PccSkeleton rows={4} />
    </div>
  )
}

/**
 * Single Stock workspace: secondary tabs map to existing stock-* section ids / panels.
 */
export default function StockWorkspace({
  section,
  onNavigate,
  onToast,
  onStockAllocated,
}) {
  const active = isStockSection(section) ? section : 'stock-overview'

  let body = null
  switch (active) {
    case 'stock-in':
      body = (
        <>
          <MarkAvailableHelper onToast={onToast} />
          <NewStockInPanel onToast={onToast} />
        </>
      )
      break
    case 'stock-selection':
      body = (
        <StockListPanel
          title="AVAILABLE STOCK"
          statusFilter="AVAILABLE"
          selectable
          onToast={onToast}
          onAllocated={onStockAllocated}
        />
      )
      break
    case 'stock-processing':
      body = (
        <StockListPanel
          title="UNDER PROCESSING"
          statusFilter={PROCESSING_STATUSES}
          onToast={onToast}
        />
      )
      break
    case 'stock-finished':
      body = (
        <StockListPanel
          title="FINISHED STOCK"
          statusFilter="FINISHED,DISPATCHED"
          dispatchable
          onToast={onToast}
        />
      )
      break
    case 'stock-history':
      body = <StockHistoryPanel onToast={onToast} />
      break
    case 'stock-adjustments':
      body = <StockAdjustmentsPanel onToast={onToast} />
      break
    case 'stock-overview':
    default:
      body = <StockOverviewPanel onToast={onToast} onNavigate={onNavigate} />
      break
  }

  return (
    <div className="pcc-stack pcc-stock-workspace">
      <div className="pcc-panel pcc-stock-workspace-head">
        <div className="pcc-panel-head">
          <h2>STOCK</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => onNavigate?.('stock-in')}>
              + Stock In
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-selection')}>
              Issue / Select
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-adjustments')}>
              Adjust Weight
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('metal-custody')}>
              Metal Control
            </button>
          </div>
        </div>
        <p className="pcc-muted pcc-workspace-hint">
          Flow: New Stock → verify / release to Available → select / allocate → Under Processing → QC → Finished.
          Release from NEW_STOCK to AVAILABLE is manual when required by your process rules.
        </p>
        <div className="pcc-subtabs" role="tablist" aria-label="Stock views">
          {STOCK_WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              className={active === tab.id ? 'active' : ''}
              onClick={() => onNavigate?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          {active === 'stock-in' ? (
            <button type="button" role="tab" className="active" aria-selected>
              Stock In
            </button>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<TabFallback />}>{body}</Suspense>
    </div>
  )
}
