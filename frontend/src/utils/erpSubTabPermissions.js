export const ERP_SUB_TABS = [
  'dashboard',
  'accounts',
  'mappings',
  'settings',
  'currencies',
  'enquiry',
  'customers',
  'customer-margin',
  'supplier-margin',
  'ledger',
  'transactions',
  'reports',
  'vendors',
  'inventory',
  'vouchers',
  'direct-deals',
  'fixing-register',
]

export function hasGranularModulePermissions(user) {
  return Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)
}

function hasExplicitErpPermissions(user) {
  return user?.modulePermissions?.erp !== undefined
}

export function canViewErpSubTab(user, subTab) {
  const role = String(user?.role || '').toLowerCase()
  if (role === 'super_admin') return true

  const erpPermission = user?.modulePermissions?.erp
  const hasGranular = hasGranularModulePermissions(user)

  if (hasGranular && hasExplicitErpPermissions(user) && erpPermission?.on !== true) return false
  if (!hasGranular && (user?.allowedModules || []).includes('erp')) return true
  if (hasGranular && !hasExplicitErpPermissions(user) && (user?.allowedModules || []).includes('erp')) return true
  if (erpPermission?.on !== true) return false

  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return true
  return configuredSubs[subTab]?.on === true
}

export function canViewERPModule(user) {
  const role = String(user?.role || '').toLowerCase()
  if (role === 'super_admin') return true
  if (hasGranularModulePermissions(user)) {
    if (!hasExplicitErpPermissions(user)) {
      return (user?.allowedModules || []).includes('erp')
    }
    return user?.modulePermissions?.erp?.on === true
  }
  return (user?.allowedModules || []).includes('erp')
}

export function getAllowedErpSubTabs(user) {
  return ERP_SUB_TABS.filter((subTab) => canViewErpSubTab(user, subTab))
}

export function resolveAllowedErpSubTab(user, requestedSubTab, fallback = 'dashboard') {
  if (requestedSubTab && canViewErpSubTab(user, requestedSubTab)) {
    return requestedSubTab
  }
  const allowed = getAllowedErpSubTabs(user)
  if (allowed.includes(fallback)) return fallback
  return allowed[0] || fallback
}
