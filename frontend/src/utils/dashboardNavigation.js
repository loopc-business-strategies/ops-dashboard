import { ERP_SUB_TABS, resolveAllowedErpSubTab } from './erpSubTabPermissions'

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
 * Stable key for deduping Account Summary deep-link fetches.
 */
export function enquiryDeepLinkKey({ account, view } = {}) {
  const code = String(account || '').trim()
  if (!code) return ''
  return `${code}|${view === 'statement' ? 'statement' : ''}`
}

/**
 * Single source of truth for dashboard URL search params.
 * Preserves enquiry account/view when staying on erp-enquiry unless explicitly overridden.
 */
export function buildDashboardSearchParams({
  activeTab,
  erpSubTab,
  moduleSubTab,
  enquiryAccount,
  enquiryView,
  company,
  includeCompany = false,
  preserveFrom,
} = {}) {
  const params = new URLSearchParams()
  const erpSub = activeTab === 'erp' ? (erpSubTab || 'dashboard') : null
  const tabParam = activeTab === 'erp'
    ? buildDashboardTabParam({ tabId: 'erp', erpSub })
    : (activeTab || 'overview')

  params.set('tab', tabParam)

  if (activeTab !== 'erp' && moduleSubTab) {
    params.set('sub', moduleSubTab)
  }

  const isEnquiry = activeTab === 'erp' && erpSub === 'enquiry'
  if (isEnquiry) {
    let account = null
    let view = null

    if (enquiryAccount !== undefined) {
      account = enquiryAccount
      view = enquiryView !== undefined ? enquiryView : null
    } else if (preserveFrom) {
      const preserved = parseEnquiryDeepLink(
        typeof preserveFrom === 'string' ? preserveFrom : preserveFrom.toString(),
      )
      account = preserved.account
      view = preserved.view
    }

    const code = String(account || '').trim()
    if (code) params.set('account', code)
    if (view === 'statement') params.set('view', 'statement')
  }

  if (includeCompany && company) {
    params.set('company', company)
  }

  return params
}

/**
 * Build /dashboard href with tab, optional sub, enquiry params, and optional tenant on localhost.
 */
export function buildDashboardHref({
  tabId,
  erpSub,
  sub,
  account,
  view,
  company,
  includeCompany = false,
} = {}) {
  const activeTab = (tabId === 'erp' || erpSub) ? 'erp' : (tabId || 'overview')
  const params = buildDashboardSearchParams({
    activeTab,
    erpSubTab: erpSub || 'dashboard',
    moduleSubTab: sub,
    enquiryAccount: account,
    enquiryView: view,
    company,
    includeCompany,
  })

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
    const erpSubTab = user
      ? resolveAllowedErpSubTab(user, requested, 'dashboard')
      : (ERP_SUB_TABS.includes(requested) ? requested : 'dashboard')
    return {
      activeTab: 'erp',
      erpSubTab,
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
  enquiryAccount,
  enquiryView,
  company,
  includeCompany = false,
  preserveFrom,
} = {}) {
  return buildDashboardSearchParams({
    activeTab,
    erpSubTab,
    moduleSubTab,
    enquiryAccount,
    enquiryView,
    company,
    includeCompany,
    preserveFrom,
  })
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
  return buildDashboardHref({
    tabId: 'erp',
    erpSub: 'enquiry',
    account,
    view,
    company,
    includeCompany,
  })
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
  return buildDashboardSearchParams({
    activeTab: 'erp',
    erpSubTab: 'enquiry',
    enquiryAccount: account,
    enquiryView: view,
    preserveFrom: params,
  })
}
