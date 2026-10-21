import { lazy, Suspense } from 'react'
import ERPTabPanels from './erp/ERPTabPanels'
import { useErpTabController } from './erp/useErpTabController'

const ERPTabModals = lazy(() => import('./erp/ERPTabModals'))

function ERPTab(props) {
  const {
    panelProps,
    modalProps,
    canAccessERP,
    canViewCurrentErpSubTab,
    token,
    error,
    success,
    C,
  } = useErpTabController(props)

  if (!canAccessERP) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: C.t2 }}>
        <p>⛔ ERP access restricted for your role.</p>
      </div>
    )
  }
  if (!canViewCurrentErpSubTab) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: C.t2 }}>
        <p>⛔ This ERP page is not enabled in your permissions.</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '0.5rem', color: '#DC2626', textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: '500' }}>🔒 Please log in to access this module.</p>
      </div>
    )
  }
  const isDash = panelProps?.activeTab === 'dashboard'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isDash ? '0.4rem' : '1.25rem',
        flex: 1,
        minHeight: 0,
        height: isDash ? '100%' : undefined,
        overflow: isDash ? 'hidden' : undefined,
      }}
    >
      {error && <div style={{ background: C.danger, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', flexShrink: 0 }}>{error}</div>}
      {success && <div style={{ background: C.s1, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', flexShrink: 0 }}>{success}</div>}
      <div style={isDash ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
        <ERPTabPanels {...panelProps} />
      </div>
      <Suspense fallback={null}>
        <ERPTabModals {...modalProps} />
      </Suspense>
    </div>
  )
}
export default ERPTab
