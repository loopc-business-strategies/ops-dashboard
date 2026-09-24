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

/** True when a sub-tab click should navigate (caller may have already called preventDefault). */
export function shouldAcceptModuleSubTabClick(event) {
  if (!event) return true
  if (event.defaultPrevented) return true
  return isPrimaryNavClick(event)
}

/**
 * Sync a module's top-level sub-tab with ?sub= when ?tab= matches moduleTabId.
 * When `embedded` is true, sub-tabs are local-only (for nesting under another module).
 */
export function useDashboardModuleSubTab(
  moduleTabId,
  allowedSubIds,
  defaultSub,
  company,
  { isModuleActive = true, embedded = false } = {},
) {
  const [searchParams] = useSearchParams()
  const includeCompany = typeof window !== 'undefined' && isLocalTenantHost(window.location.hostname)

  const tabParam = searchParams.get('tab')
  const subFromUrl = searchParams.get('sub')
  const allowedKey = allowedSubIds.join(',')
  const syncActive = embedded ? false : isModuleActive

  const resolvedFromUrl = useMemo(
    () => resolveModuleSubTabFromUrl({
      tabParam,
      subFromUrl,
      moduleTabId,
      allowedSubIds,
      defaultSub,
      isModuleActive: syncActive,
    }),
    [tabParam, subFromUrl, moduleTabId, allowedSubIds, defaultSub, syncActive],
  )

  const [subTab, setSubTabInternal] = useState(() => (
    (embedded
      ? defaultSub
      : resolveModuleSubTabFromUrl({
        tabParam,
        subFromUrl,
        moduleTabId,
        allowedSubIds,
        defaultSub,
        isModuleActive: syncActive,
      })) ?? defaultSub
  ))

  const lastSyncedRef = useRef({ tab: undefined, sub: undefined, allowedKey: '' })

  useEffect(() => {
    if (embedded) return
    const prev = lastSyncedRef.current
    const urlChanged = shouldSyncSubTabFromUrl(prev.tab, prev.sub, tabParam, subFromUrl)
    const allowlistChanged = prev.allowedKey !== allowedKey
    if (!urlChanged && !allowlistChanged) return

    lastSyncedRef.current = { tab: tabParam, sub: subFromUrl, allowedKey }
    if (resolvedFromUrl === undefined) return
    setSubTabInternal(resolvedFromUrl)
  }, [tabParam, subFromUrl, resolvedFromUrl, allowedKey, embedded])

  const buildSubHref = useCallback(
    (subId) => {
      if (embedded) return undefined
      return buildDashboardHref({
        tabId: moduleTabId,
        sub: subId,
        company,
        includeCompany,
      })
    },
    [moduleTabId, company, includeCompany, embedded],
  )

  const [, setSearchParams] = useSearchParams()

  const setSubTab = useCallback((nextSub) => {
    const allowed = allowedSubIds.includes(nextSub) ? nextSub : defaultSub
    setSubTabInternal(allowed)
    if (embedded) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', moduleTabId)
      next.set('sub', allowed)
      if (includeCompany && company) next.set('company', company)
      return next
    }, { replace: true })
  }, [allowedSubIds, defaultSub, moduleTabId, company, includeCompany, setSearchParams, embedded])

  const handleSubTabClick = useCallback((subId, event) => {
    if (!shouldAcceptModuleSubTabClick(event)) return
    if (event && !event.defaultPrevented) event.preventDefault()
    setSubTab(subId)
  }, [setSubTab])

  return { subTab, setSubTab, buildSubHref, handleSubTabClick }
}
