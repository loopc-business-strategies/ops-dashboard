import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProductionDashboardTab from '../components/production-dashboard/ProductionDashboardTab'

const RETURN_KEY = 'pd_returnTo'

/**
 * Fullscreen Production Dashboard — no ops sidebar / topbar shell.
 */
export default function ProductionDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const returnTo = useMemo(() => {
    const fromState = location.state?.returnTo
    if (fromState) return fromState
    try {
      return sessionStorage.getItem(RETURN_KEY) || '/dashboard?tab=overview'
    } catch {
      return '/dashboard?tab=overview'
    }
  }, [location.state])

  const goBack = () => {
    try {
      sessionStorage.removeItem(RETURN_KEY)
    } catch {
      /* ignore */
    }
    navigate(returnTo || '/dashboard?tab=overview')
  }

  return (
    <div
      className="pd-fullscreen-page"
      style={{
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#f4f6f9',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.45rem 0.85rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          style={{
            border: '1px solid #e2e8f0',
            background: '#fff',
            borderRadius: 8,
            padding: '0.3rem 0.7rem',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: '#0f172a',
          }}
        >
          ← Back to Ops Dashboard
        </button>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Production Dashboard</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ProductionDashboardTab />
      </div>
    </div>
  )
}
