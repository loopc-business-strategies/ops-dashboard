// Legacy Production tab — redirects into the dedicated fullscreen workspace.
// Keeps deep links (?tab=production) working without showing ERP chrome.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const RETURN_KEY = 'pcc_returnTo'

export default function ProductionTab() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const returnTo = `${location.pathname}${location.search}`.replace(/([?&])tab=production\b/, '$1tab=overview')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '') || '/dashboard'
    try {
      sessionStorage.setItem(RETURN_KEY, returnTo.includes('tab=') ? returnTo : '/dashboard?tab=overview')
    } catch {
      /* ignore */
    }
    navigate('/production', { replace: true, state: { returnTo: '/dashboard?tab=overview' } })
  }, [navigate, location.pathname, location.search])

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
      Opening Production Control Center…
    </div>
  )
}
