import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyTenantDocumentMeta, applyTenantTheme, getTenantBranding } from '../config/tenantBranding'
import { useTvSurfaceFit } from '../hooks/useTvSurfaceFit'
import ProductionDashboardTab from '../components/production-dashboard/ProductionDashboardTab'
import '../components/production-dashboard/ProductionDashboard.css'

const RETURN_KEY = 'pd_returnTo'

/** Keep CSS height on the *visible* viewport (browser chrome shrinks 100vh and clipped the bottom row). */
function useProductionViewportVars() {
  useLayoutEffect(() => {
    const sync = () => {
      const vv = window.visualViewport
      const h = Math.max(1, Math.round(vv?.height || window.innerHeight || 0))
      const w = Math.max(1, Math.round(vv?.width || window.innerWidth || 0))
      document.documentElement.style.setProperty('--pd-vvh', `${h}px`)
      document.documentElement.style.setProperty('--pd-vvw', `${w}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener?.('resize', sync)
    window.visualViewport?.addEventListener?.('scroll', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener?.('resize', sync)
      window.visualViewport?.removeEventListener?.('scroll', sync)
      document.documentElement.style.removeProperty('--pd-vvh')
      document.documentElement.style.removeProperty('--pd-vvw')
    }
  }, [])
}

/**
 * Fullscreen Production Dashboard — no ops sidebar / topbar shell.
 * Light TV surface fit (Full HD+ nearly fullscreen only). Ops AppShell is untouched.
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

  useProductionViewportVars()
  useTvSurfaceFit(pageRef, { designWidth: 1920, designHeight: 1080, safeInset: 0.02 })

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
    <div className="pd-fullscreen-shell">
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
