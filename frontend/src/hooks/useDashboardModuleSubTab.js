import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildDashboardHref, isPrimaryNavClick } from '../utils/dashboardNavigation'
import { isLocalTenantHost } from '../config/tenantBranding'

/**
 * Sync a module's top-level sub-tab with ?sub= when ?tab= matches moduleTabId.
 */
export function useDashboardModuleSubTab(moduleTabId, allowedSubIds, defaultSub, company) {
  const [searchParams] = useSearchParams()
  const includeCompany = typeof window !== 'undefined' && isLocalTenantHost(window.location.hostname)

  const tabParam = searchParams.get('tab')
  const subFromUrl = searchParams.get('sub')

  const resolvedFromUrl = useMemo(() => {
    if (tabParam !== moduleTabId) return defaultSub
    if (subFromUrl && allowedSubIds.includes(subFromUrl)) return subFromUrl
    return defaultSub
  }, [tabParam, subFromUrl, moduleTabId, allowedSubIds, defaultSub])

  const [subTab, setSubTabInternal] = useState(resolvedFromUrl)

  useEffect(() => {
    setSubTabInternal(resolvedFromUrl)
  }, [resolvedFromUrl])

  const buildSubHref = useCallback(
    (subId) => buildDashboardHref({
      tabId: moduleTabId,
      sub: subId,
      company,
      includeCompany,
    }),
    [moduleTabId, company, includeCompany],
  )

  const [, setSearchParams] = useSearchParams()

  const setSubTab = useCallback((nextSub) => {
    const allowed = allowedSubIds.includes(nextSub) ? nextSub : defaultSub
    setSubTabInternal(allowed)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', moduleTabId)
      next.set('sub', allowed)
      if (includeCompany && company) next.set('company', company)
      return next
    }, { replace: true })
  }, [allowedSubIds, defaultSub, moduleTabId, company, includeCompany, setSearchParams])

  const handleSubTabClick = useCallback((subId, event) => {
    if (event && !isPrimaryNavClick(event)) return
    if (event) event.preventDefault()
    setSubTab(subId)
  }, [setSubTab])

  return { subTab, setSubTab, buildSubHref, handleSubTabClick }
}
