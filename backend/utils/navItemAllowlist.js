/**
 * Allowed sidebar nav item ids (mirrors frontend navConfig.jsx).
 * Favorites / recent only accept these keys.
 */
const ALLOWED_NAV_ITEM_IDS = Object.freeze([
  'overview',
  'chat',
  'master-settings',
  'departments',
  'admin',
  'hr',
  'compliance',
  'production-new',
  'finance',
  'sales',
  'operations',
  'training',
  'procurement-plus',
  'erp-dashboard',
  'erp-accounts',
  'erp-mappings',
  'erp-settings',
  'erp-currencies',
  'erp-enquiry',
  'erp-customers',
  'erp-customer-margin',
  'erp-supplier-margin',
  'erp-ledger',
  'erp-period-closing',
  'erp-transactions',
  'erp-reports',
  'erp-activity-log',
  'erp-vendors',
  'erp-inventory',
  'erp-stock-master',
  'erp-gold-alloy',
  'erp-vouchers',
  'erp-direct-deals',
  'erp-fixing-register',
])

const ALLOWED_SET = new Set(ALLOWED_NAV_ITEM_IDS)

function isAllowedNavItemId(navItemId) {
  return ALLOWED_SET.has(String(navItemId || '').trim())
}

function assertAllowedNavItemId(navItemId) {
  const id = String(navItemId || '').trim()
  if (!isAllowedNavItemId(id)) {
    const err = new Error('Unknown or unsupported navigation item.')
    err.status = 400
    err.code = 'INVALID_NAV_ITEM'
    throw err
  }
  return id
}

module.exports = {
  ALLOWED_NAV_ITEM_IDS,
  isAllowedNavItemId,
  assertAllowedNavItemId,
}
