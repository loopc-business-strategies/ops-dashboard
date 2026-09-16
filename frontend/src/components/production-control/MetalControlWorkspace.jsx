import { lazy, Suspense } from 'react'
import { METAL_WORKSPACE_TABS, isMetalSection } from './pccSidebarConfig'
import { PccSkeleton } from './primitives'

const MetalCustodyPanel = lazy(() =>
  import('./OpsPanels').then((m) => ({ default: m.MetalCustodyPanel })),
)
const MovementsPanel = lazy(() => import('./panels/MovementsPanel'))
const PassesPanel = lazy(() => import('./panels/PassesPanel'))

function TabFallback() {
  return (
    <div className="pcc-panel">
      <PccSkeleton rows={4} />
    </div>
  )
}

/**
 * Unified Metal Control workspace: custody / movements / handovers.
 * Preserves section ids metal-custody, movements, passes.
 */
export default function MetalControlWorkspace({
  section,
  onNavigate,
  onToast,
  onSelectBatch,
  productionRole,
}) {
  const active = isMetalSection(section) ? section : 'metal-custody'

  let body = null
  switch (active) {
    case 'movements':
      body = <MovementsPanel onToast={onToast} onSelectBatch={onSelectBatch} />
      break
    case 'passes':
      body = (
        <PassesPanel
          onToast={onToast}
          productionRole={productionRole}
          onSelectBatch={onSelectBatch}
        />
      )
      break
    case 'metal-custody':
    default:
      body = <MetalCustodyPanel onToast={onToast} onSelectBatch={onSelectBatch} />
      break
  }

  return (
    <div className="pcc-stack pcc-metal-workspace">
      <div className="pcc-panel pcc-metal-workspace-head">
        <div className="pcc-panel-head">
          <h2>METAL CONTROL</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn" onClick={() => onNavigate?.('passes')}>
              + Handover
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('movements')}>
              Movement History
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-overview')}>
              Open Stock
            </button>
          </div>
        </div>
        <p className="pcc-muted pcc-workspace-hint">
          Track where metal is, who holds it, and every movement or handover — without changing custody rules.
        </p>
        <div className="pcc-subtabs" role="tablist" aria-label="Metal control views">
          {METAL_WORKSPACE_TABS.map((tab) => (
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
        </div>
      </div>
      <Suspense fallback={<TabFallback />}>{body}</Suspense>
    </div>
  )
}
