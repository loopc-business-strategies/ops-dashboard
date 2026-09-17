import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProductionDashboardTab from '../components/production-dashboard/ProductionDashboardTab'
import '../components/production-dashboard/ProductionDashboard.css'

const RETURN_KEY = 'pd_returnTo'

/**
 * Fullscreen Production Dashboard — no ops sidebar / topbar shell.
 * Compact back control only; primary chrome lives in HeaderBar.
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
    <div className="pd-fullscreen-page">
      <button type="button" className="pd-fullscreen-back" onClick={goBack} title="Back to Ops Dashboard">
        ← Ops
      </button>
      <div className="pd-fullscreen-body">
        <ProductionDashboardTab />
      </div>
    </div>
  )
}
