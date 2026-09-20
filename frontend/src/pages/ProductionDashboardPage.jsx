import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyTenantTheme, getTenantBranding } from '../config/tenantBranding'
import ProductionDashboardTab from '../components/production-dashboard/ProductionDashboardTab'
import '../components/production-dashboard/ProductionDashboard.css'

const RETURN_KEY = 'pd_returnTo'

/**
 * Fullscreen Production Dashboard — no ops sidebar / topbar shell.
 * Applies tenant brand theme so header/accents match the logged-in company.
 */
export default function ProductionDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, company } = useAuth()

  const branding = useMemo(
    () => getTenantBranding(user?.company || company),
    [company, user?.company],
  )

  useEffect(() => applyTenantTheme(branding.colors), [branding])

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
      <button
        type="button"
        className="pd-fullscreen-back"
        style={{ left: 88 }}
        onClick={() => navigate('/production-devices')}
        title="MG Floor device registry"
      >
        Devices
      </button>
      <div className="pd-fullscreen-body">
        <ProductionDashboardTab />
      </div>
    </div>
  )
}
