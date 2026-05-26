import accessMatrix from '../../../generated/erp-access-matrix.json'

function getRole(user) {
  return String(user?.role || '').toLowerCase()
}

function getDept(user) {
  return String(user?.department || '').toLowerCase()
}

function evaluateRule(user, rule = {}) {
  const role = getRole(user)
  const dept = getDept(user)
  const inRoleList = Array.isArray(rule.roles) && rule.roles.includes(role)
  const inDeptHeadList = role === 'department_head' && Array.isArray(rule.departmentHead)
    && (rule.departmentHead.includes('*') || rule.departmentHead.includes(dept))
  return inRoleList || inDeptHeadList
}

function evaluatePredicate(user, key) {
  return evaluateRule(user, accessMatrix.predicates[key] || {})
}

function evaluatePermission(user, key) {
  return evaluateRule(user, accessMatrix.permissions[key] || {})
}

const ERP_PERMISSION_TO_SUBTAB = {
  canViewAccounts: ['accounts', 'dashboard'],
  canManageAccounts: ['accounts'],
  canViewLedger: ['ledger'],
  canViewCustomers: ['customers', 'customer-margin'],
  canManageCustomers: ['customers'],
  canViewAccountSummary: ['enquiry'],
  canUpdateMetalRates: ['dashboard'],
  canExportAccountSummary: ['enquiry'],
  canAccessTransactions: ['transactions'],
  canAccessReports: ['reports'],
  canAccessVendors: ['vendors', 'supplier-margin'],
  canManageVendors: ['vendors'],
  canUpdateVendorOperational: ['vendors'],
  canAccessInventory: ['inventory'],
  canAccessVouchers: ['vouchers'],
  canAccessDirectDeals: ['direct-deals'],
}

function hasGranularPermissions(user) {
  return Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)
}

function hasErpSubTab(user, subTabs) {
  if (getRole(user) === 'super_admin') return true
  if (!hasGranularPermissions(user)) return null

  const erpPermission = user?.modulePermissions?.erp
  if (erpPermission?.on !== true) return false

  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return true

  return subTabs.some((subTab) => configuredSubs[subTab]?.on === true)
}

function evaluateErpPermission(user, key) {
  const subTabs = ERP_PERMISSION_TO_SUBTAB[key]
  if (subTabs) {
    const granularAllowed = hasErpSubTab(user, subTabs)
    if (granularAllowed !== null) return granularAllowed
  }
  return evaluatePermission(user, key)
}

export function deriveErpAccessPolicy(user) {
  const isSuperAdmin = evaluatePredicate(user, 'isSuperAdmin')
  const isDepartmentHead = evaluatePredicate(user, 'isDepartmentHead')
  const isManagementRole = evaluatePredicate(user, 'isManagementRole')
  const isFinance = evaluatePredicate(user, 'isFinance')
  const isSalesRole = evaluatePredicate(user, 'isSalesRole')
  const isOperationsRole = evaluatePredicate(user, 'isOperationsRole')
  const isHRRole = evaluatePredicate(user, 'isHRRole')

  const canViewAccounts = evaluateErpPermission(user, 'canViewAccounts')
  const canManageAccounts = evaluateErpPermission(user, 'canManageAccounts')
  const canViewLedger = evaluateErpPermission(user, 'canViewLedger')
  const canViewCustomers = evaluateErpPermission(user, 'canViewCustomers')
  const canManageCustomers = evaluateErpPermission(user, 'canManageCustomers')
  const canViewBalanceEnquiry = evaluateErpPermission(user, 'canViewAccountSummary')
  const canUpdateMetalRates = evaluateErpPermission(user, 'canUpdateMetalRates')
  const canExportAccountSummary = evaluateErpPermission(user, 'canExportAccountSummary')
  const canAccessTransactions = evaluateErpPermission(user, 'canAccessTransactions')
  const canAccessReports = evaluateErpPermission(user, 'canAccessReports')
  const canAccessVendors = evaluateErpPermission(user, 'canAccessVendors')
  const canManageVendors = evaluateErpPermission(user, 'canManageVendors')
  const canUpdateVendorOperational = evaluateErpPermission(user, 'canUpdateVendorOperational')
  const canAccessInventory = evaluateErpPermission(user, 'canAccessInventory')
  const canAccessVouchers = evaluateErpPermission(user, 'canAccessVouchers')
  const canAccessDirectDeals = evaluateErpPermission(user, 'canAccessDirectDeals')
  const canAccessERP = hasErpSubTab(user, Object.values(ERP_PERMISSION_TO_SUBTAB).flat()) ?? (
    canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers
  )

  return {
    isSuperAdmin,
    isDepartmentHead,
    isManagementRole,
    isFinance,
    isSalesRole,
    isOperationsRole,
    isHRRole,
    canViewAccounts,
    canManageAccounts,
    canViewLedger,
    canViewCustomers,
    canManageCustomers,
    canViewBalanceEnquiry,
    canUpdateMetalRates,
    canExportAccountSummary,
    canAccessTransactions,
    canAccessReports,
    canAccessVendors,
    canManageVendors,
    canUpdateVendorOperational,
    canAccessInventory,
    canAccessVouchers,
    canAccessDirectDeals,
    canAccessERP,
  }
}
