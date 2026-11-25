/**
 * Resolve sidebar nav item ids to labels, navigation targets, and simple icons.
 * Ids mirror backend navItemAllowlist / frontend navConfig.
 */

const ERP_SUB_BY_ID = {
  'erp-dashboard': 'dashboard',
  'erp-accounts': 'accounts',
  'erp-mappings': 'mappings',
  'erp-settings': 'settings',
  'erp-currencies': 'currencies',
  'erp-enquiry': 'enquiry',
  'erp-customers': 'customers',
  'erp-customer-margin': 'customer-margin',
  'erp-supplier-margin': 'supplier-margin',
  'erp-ledger': 'ledger',
  'erp-period-closing': 'period-closing',
  'erp-transactions': 'transactions',
  'erp-reports': 'reports',
  'erp-activity-log': 'activity-log',
  'erp-vendors': 'vendors',
  'erp-inventory': 'inventory',
  'erp-stock-master': 'stock-master',
  'erp-gold-alloy': 'gold-alloy',
  'erp-vouchers': 'vouchers',
  'erp-direct-deals': 'direct-deals',
  'erp-fixing-register': 'fixing-register',
}

/** Compact letter marks for cards/menus (no external icon pack). */
const ICON_BY_ID = {
  overview: 'OV',
  chat: 'CH',
  'master-settings': 'MS',
  departments: 'DP',
  admin: 'AD',
  hr: 'HR',
  compliance: 'CO',
  'production-new': 'PD',
  finance: 'FI',
  sales: 'SA',
  operations: 'OP',
  training: 'TR',
  'procurement-plus': 'PR',
  'erp-dashboard': 'ED',
  'erp-accounts': 'AC',
  'erp-mappings': 'MP',
  'erp-settings': 'ST',
  'erp-currencies': 'CU',
  'erp-enquiry': 'AS',
  'erp-customers': 'CU',
  'erp-customer-margin': 'CM',
  'erp-supplier-margin': 'SM',
  'erp-ledger': 'GL',
  'erp-period-closing': 'PC',
  'erp-transactions': 'TX',
  'erp-reports': 'RP',
  'erp-activity-log': 'AL',
  'erp-vendors': 'VN',
  'erp-inventory': 'IN',
  'erp-stock-master': 'SK',
  'erp-gold-alloy': 'GA',
  'erp-vouchers': 'VO',
  'erp-direct-deals': 'DD',
  'erp-fixing-register': 'NP',
}

export function getErpSubForNavItemId(navItemId) {
  return ERP_SUB_BY_ID[String(navItemId || '').trim()] || null
}

export function getNavItemIcon(navItemId) {
  return ICON_BY_ID[String(navItemId || '').trim()] || 'NA'
}

/**
 * @param {string} navItemId
 * @param {Array<{id:string,label?:string,erpSub?:string,group?:string}>} navItems from getNavItems
 */
export function resolveNavItemPresentation(navItemId, navItems = []) {
  const id = String(navItemId || '').trim()
  const fromCatalog = (navItems || []).find((item) => item.id === id)
  const erpSub = fromCatalog?.erpSub || getErpSubForNavItemId(id)
  const isErp = Boolean(erpSub) || id.startsWith('erp-')
  return {
    navItemId: id,
    label: fromCatalog?.label || id,
    icon: getNavItemIcon(id),
    authorized: Boolean(fromCatalog),
    isErp,
    erpSub: erpSub || null,
    tabId: isErp ? 'erp' : id,
    openInNewTab: Boolean(fromCatalog?.openInNewTab),
  }
}

export function navigateFromNavItemId(navItemId, navigateToTab, navItems = []) {
  const presentation = resolveNavItemPresentation(navItemId, navItems)
  if (!presentation.authorized || typeof navigateToTab !== 'function') return false
  if (presentation.isErp) {
    navigateToTab('erp', { erpSub: presentation.erpSub || 'dashboard' })
  } else {
    navigateToTab(presentation.tabId)
  }
  return true
}
