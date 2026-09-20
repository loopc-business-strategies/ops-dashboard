import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyTenantTheme, getTenantBranding } from '../config/tenantBranding'
import MgFloorDevicesPanel from '../components/production-dashboard/MgFloorDevicesPanel'
import '../components/production-dashboard/ProductionDashboard.css'

const RETURN_KEY = 'pd_returnTo'

export default function MgFloorDevicesPage() {
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
      return sessionStorage.getItem(RETURN_KEY) || '/production-dashboard'
    } catch {
      return '/production-dashboard'
    }
  }, [location.state])

  return (
    <div className="pd-fullscreen-page">
      <button type="button" className="pd-fullscreen-back" onClick={() => navigate(returnTo)} title="Back">
        ← Production
      </button>
      <div className="pd-fullscreen-body">
        <MgFloorDevicesPanel />
      </div>
    </div>
  )
}
