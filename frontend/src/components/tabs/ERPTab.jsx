import ERPTabPanels from './erp/ERPTabPanels'
import ERPTabModals from './erp/ERPTabModals'
import { useErpTabController } from './erp/useErpTabController'

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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div style={{ background: C.danger, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: C.s1, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}
      <ERPTabPanels {...panelProps} />
      <ERPTabModals {...modalProps} />
    </div>
  )
}
export default ERPTab
