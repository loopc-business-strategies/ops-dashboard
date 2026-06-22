import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  isModuleActive = true,
}) {
  if (tabParam === moduleTabId) {
    if (subFromUrl && allowedSubIds.includes(subFromUrl)) return subFromUrl
    return defaultSub
  }
  if (isModuleActive) return undefined
  return defaultSub
}

/** True when URL tab/sub changed (back/forward, deep link) — not on optimistic click before router updates. */
export function shouldSyncSubTabFromUrl(prevTab, prevSub, nextTab, nextSub) {
  return prevTab !== nextTab || prevSub !== nextSub
}

/**
 * Sync a module's top-level sub-tab with ?sub= when ?tab= matches moduleTabId.
 */
export function useDashboardModuleSubTab(
  moduleTabId,
  allowedSubIds,
  defaultSub,
  company,
  { isModuleActive = true } = {},
) {
  const [searchParams] = useSearchParams()
  const includeCompany = typeof window !== 'undefined' && isLocalTenantHost(window.location.hostname)

  const tabParam = searchParams.get('tab')
  const subFromUrl = searchParams.get('sub')
  const allowedKey = allowedSubIds.join(',')

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

  const lastSyncedRef = useRef({ tab: undefined, sub: undefined, allowedKey: '' })

  useEffect(() => {
    const prev = lastSyncedRef.current
    const urlChanged = shouldSyncSubTabFromUrl(prev.tab, prev.sub, tabParam, subFromUrl)
    const allowlistChanged = prev.allowedKey !== allowedKey
    if (!urlChanged && !allowlistChanged) return

    lastSyncedRef.current = { tab: tabParam, sub: subFromUrl, allowedKey }
    if (resolvedFromUrl === undefined) return
    setSubTabInternal(resolvedFromUrl)
  }, [tabParam, subFromUrl, resolvedFromUrl, allowedKey])

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
