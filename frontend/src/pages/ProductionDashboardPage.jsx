import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyTenantDocumentMeta, applyTenantTheme, getTenantBranding } from '../config/tenantBranding'
import { useViewportBoardFit } from '../hooks/useViewportBoardFit'
import ProductionDashboardTab from '../components/production-dashboard/ProductionDashboardTab'
import '../components/production-dashboard/ProductionDashboard.css'

const RETURN_KEY = 'pd_returnTo'

/**
 * Fullscreen Production Dashboard — no ops sidebar / topbar shell.
 * Applies tenant brand theme so header/accents match the logged-in company.
 * Scales a 1920×1080 board to any TV/PC viewport so the full UI stays visible.
 */
export default function ProductionDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, company } = useAuth()
  const pageRef = useRef(null)

  const branding = useMemo(
    () => getTenantBranding(user?.company || company),
    [company, user?.company],
  )

  useViewportBoardFit(pageRef, { designWidth: 1920, designHeight: 1080 })

  useEffect(() => {
    const restoreTheme = applyTenantTheme(branding.colors)
    const restoreMeta = applyTenantDocumentMeta(branding)
    return () => {
      restoreTheme?.()
      restoreMeta?.()
    }
  }, [branding])

  // Venus Bullions (and any tenant with departmentsComingSoon): no live production app yet.
  useEffect(() => {
    if (!branding?.featureFlags?.departmentsComingSoon) return undefined
    navigate('/dashboard?tab=production-new', { replace: true })
    return undefined
  }, [branding?.featureFlags?.departmentsComingSoon, navigate])

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

  if (branding?.featureFlags?.departmentsComingSoon) {
    return null
  }

  return (
    <div className="pd-fullscreen-shell" aria-hidden="false">
      <div ref={pageRef} className="pd-fullscreen-page">
        <div className="pd-fullscreen-nav" role="navigation" aria-label="Production dashboard navigation">
          <button type="button" className="pd-fullscreen-back" onClick={goBack} title="Back to Ops Dashboard">
            ← Ops
          </button>
        </div>
        <div className="pd-fullscreen-body">
          <ProductionDashboardTab />
        </div>
      </div>
    </div>
  )
}
