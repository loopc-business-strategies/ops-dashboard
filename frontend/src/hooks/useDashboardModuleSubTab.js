import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildDashboardHref, isPrimaryNavClick } from '../utils/dashboardNavigation'
import { isLocalTenantHost } from '../config/tenantBranding'

/**
 * Resolve module sub-tab from URL. Returns `undefined` when the module is active
 * but ?tab= does not match — caller should skip URL→state sync (avoids resetting clicks).
 */
export function resolveModuleSubTabFromUrl({
  tabParam,
  subFromUrl,
  moduleTabId,
  allowedSubIds,
  defaultSub,
  isModuleActive = false,
}) {
  if (tabParam === moduleTabId) {
    if (subFromUrl && allowedSubIds.includes(subFromUrl)) return subFromUrl
    return defaultSub
  }
  if (isModuleActive) return undefined
  return defaultSub
}

/**
 * Sync a module's top-level sub-tab with ?sub= when ?tab= matches moduleTabId.
 */
export function useDashboardModuleSubTab(
  moduleTabId,
  allowedSubIds,
  defaultSub,
  company,
  { isModuleActive = false } = {},
) {
  const [searchParams] = useSearchParams()
  const includeCompany = typeof window !== 'undefined' && isLocalTenantHost(window.location.hostname)

  const tabParam = searchParams.get('tab')
  const subFromUrl = searchParams.get('sub')

  const resolvedFromUrl = useMemo(
    () => resolveModuleSubTabFromUrl({
      tabParam,
      subFromUrl,
      moduleTabId,
      allowedSubIds,
      defaultSub,
      isModuleActive,
    }),
    [tabParam, subFromUrl, moduleTabId, allowedSubIds, defaultSub, isModuleActive],
  )

  const [subTab, setSubTabInternal] = useState(() => (
    resolveModuleSubTabFromUrl({
      tabParam,
      subFromUrl,
      moduleTabId,
      allowedSubIds,
      defaultSub,
      isModuleActive,
    }) ?? defaultSub
  ))

  useEffect(() => {
    if (resolvedFromUrl === undefined) return
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
