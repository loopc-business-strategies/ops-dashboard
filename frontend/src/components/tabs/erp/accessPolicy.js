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

export function deriveErpAccessPolicy(user) {
  const isSuperAdmin = evaluatePredicate(user, 'isSuperAdmin')
  const isDepartmentHead = evaluatePredicate(user, 'isDepartmentHead')
  const isManagementRole = evaluatePredicate(user, 'isManagementRole')
  const isFinance = evaluatePredicate(user, 'isFinance')
  const isSalesRole = evaluatePredicate(user, 'isSalesRole')
  const isOperationsRole = evaluatePredicate(user, 'isOperationsRole')
  const isHRRole = evaluatePredicate(user, 'isHRRole')

  const canViewAccounts = evaluatePermission(user, 'canViewAccounts')
  const canManageAccounts = evaluatePermission(user, 'canManageAccounts')
  const canViewLedger = evaluatePermission(user, 'canViewLedger')
  const canViewCustomers = evaluatePermission(user, 'canViewCustomers')
  const canManageCustomers = evaluatePermission(user, 'canManageCustomers')
  const canViewBalanceEnquiry = evaluatePermission(user, 'canViewAccountSummary')
  const canUpdateMetalRates = evaluatePermission(user, 'canUpdateMetalRates')
  const canExportAccountSummary = evaluatePermission(user, 'canExportAccountSummary')
  const canAccessTransactions = evaluatePermission(user, 'canAccessTransactions')
  const canAccessReports = evaluatePermission(user, 'canAccessReports')
  const canAccessVendors = evaluatePermission(user, 'canAccessVendors')
  const canManageVendors = evaluatePermission(user, 'canManageVendors')
  const canUpdateVendorOperational = evaluatePermission(user, 'canUpdateVendorOperational')
  const canAccessInventory = evaluatePermission(user, 'canAccessInventory')
  const canAccessVouchers = evaluatePermission(user, 'canAccessVouchers')
  const canAccessDirectDeals = evaluatePermission(user, 'canAccessDirectDeals')
  const canAccessERP = canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers

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
