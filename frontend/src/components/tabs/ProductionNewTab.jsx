// Production Dashboard tab — redirects into the dedicated fullscreen page.
// Keeps deep links (?tab=production-new) working.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const RETURN_KEY = 'pd_returnTo'

export default function ProductionNewTab() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const returnTo = `${location.pathname}${location.search}`
      .replace(/([?&])tab=production-new\b/, '$1tab=overview')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '') || '/dashboard'
    const target = returnTo.includes('tab=') ? returnTo : '/dashboard?tab=overview'
    try {
      sessionStorage.setItem(RETURN_KEY, target)
    } catch {
      /* ignore */
    }
    navigate('/production-dashboard', { replace: true, state: { returnTo: target } })
  }, [navigate, location.pathname, location.search])

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
      Opening Production Dashboard…
    </div>
  )
}
