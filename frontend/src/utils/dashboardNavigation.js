import { resolveAllowedErpSubTab } from './erpSubTabPermissions'

export const DASHBOARD_PATH = '/dashboard'

/**
 * True for a plain left-click (SPA navigate); false for new-tab gestures.
 */
export function isPrimaryNavClick(event) {
  if (event?.defaultPrevented) return false
  if (event?.button !== 0) return false
  if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) return false
  return true
}

/**
 * Build the `tab` query value for sidebar / main navigation.
 */
export function buildDashboardTabParam({ tabId, erpSub } = {}) {
  if (tabId === 'erp' && erpSub) return `erp-${erpSub}`
  return tabId || 'overview'
}

/**
 * Build /dashboard href with tab, optional sub, and optional tenant on localhost.
 */
export function buildDashboardHref({
  tabId,
  erpSub,
  sub,
  company,
  includeCompany = false,
} = {}) {
  const params = new URLSearchParams()
  const tabParam = buildDashboardTabParam({ tabId, erpSub })
  if (tabParam) params.set('tab', tabParam)
  if (sub) params.set('sub', sub)
  if (includeCompany && company) params.set('company', company)

  const qs = params.toString()
  return qs ? `${DASHBOARD_PATH}?${qs}` : DASHBOARD_PATH
}

/**
 * Parse dashboard URL search params into shell navigation state.
 */
export function parseDashboardUrl(search, user) {
  const params = new URLSearchParams(String(search || ''))
  const tabParam = params.get('tab')
  const moduleSubTab = params.get('sub') || null

  if (!tabParam) {
    return {
      activeTab: 'overview',
      erpSubTab: 'dashboard',
      moduleSubTab: null,
    }
  }

  if (tabParam.startsWith('erp-')) {
    const requested = tabParam.replace(/^erp-/, '')
    return {
      activeTab: 'erp',
      erpSubTab: resolveAllowedErpSubTab(user, requested, 'dashboard'),
      moduleSubTab: null,
    }
  }

  return {
    activeTab: tabParam,
    erpSubTab: 'dashboard',
    moduleSubTab,
  }
}

/**
 * Apply navigation state to URLSearchParams (mutates copy semantics via return).
 */
export function dashboardSearchFromState({
  activeTab,
  erpSubTab,
  moduleSubTab,
  company,
  includeCompany = false,
} = {}) {
  const params = new URLSearchParams()
  const tabParam = activeTab === 'erp'
    ? buildDashboardTabParam({ tabId: 'erp', erpSub: erpSubTab || 'dashboard' })
    : (activeTab || 'overview')

  params.set('tab', tabParam)

  if (activeTab !== 'erp' && moduleSubTab) {
    params.set('sub', moduleSubTab)
  }

  if (includeCompany && company) {
    params.set('company', company)
  }

  return params
}

/**
 * Build Account Summary deep link (/dashboard?tab=erp-enquiry&account=…&view=statement).
 */
export function buildEnquiryHref({
  account,
  view,
  company,
  includeCompany = false,
} = {}) {
  const params = new URLSearchParams()
  params.set('tab', 'erp-enquiry')
  const code = String(account || '').trim()
  if (code) params.set('account', code)
  if (view === 'statement') params.set('view', 'statement')
  if (includeCompany && company) params.set('company', company)
  const qs = params.toString()
  return qs ? `${DASHBOARD_PATH}?${qs}` : `${DASHBOARD_PATH}?tab=erp-enquiry`
}

/**
 * Read Account Summary params from the current dashboard URL.
 */
export function parseEnquiryDeepLink(search) {
  const params = new URLSearchParams(String(search || ''))
  const tabParam = params.get('tab') || ''
  if (tabParam !== 'erp-enquiry') {
    return { account: null, view: null }
  }
  return {
    account: String(params.get('account') || '').trim() || null,
    view: params.get('view') || null,
  }
}

/**
 * Merge Account Summary params into an existing URLSearchParams copy.
 */
export function applyEnquiryParams(params, { account, view } = {}) {
  const next = new URLSearchParams(params)
  const code = String(account || '').trim()
  if (code) next.set('account', code)
  else next.delete('account')
  if (view === 'statement') next.set('view', 'statement')
  else next.delete('view')
  return next
}
