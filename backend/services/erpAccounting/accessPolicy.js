const accessMatrix = require('../../../shared/erp-access-matrix.json')

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

function evaluatePermission(user, key) {
  return evaluateRule(user, accessMatrix.permissions[key] || {})
}

function evaluatePredicate(user, key) {
  return evaluateRule(user, accessMatrix.predicates[key] || {})
}

function isSuperAdmin(user) {
  return evaluatePredicate(user, 'isSuperAdmin')
}

function isDepartmentHead(user) {
  return evaluatePredicate(user, 'isDepartmentHead')
}

function isFinance(user) {
  return evaluatePredicate(user, 'isFinance')
}

function isSales(user) {
  return evaluatePredicate(user, 'isSalesRole')
}

function isOperations(user) {
  const dept = getDept(user)
  return isSuperAdmin(user) || (isDepartmentHead(user) && dept === 'operations')
}

function isProduction(user) {
  const dept = getDept(user)
  return isSuperAdmin(user) || (isDepartmentHead(user) && dept === 'production')
}

function isHR(user) {
  return evaluatePredicate(user, 'isHRRole')
}

function roleName(user) {
  if (isSuperAdmin(user)) return 'admin'
  if (isFinance(user)) return 'finance'
  if (isSales(user)) return 'sales'
  if (isOperations(user) || isProduction(user)) return 'operations'
  if (isHR(user)) return 'hr'
  return 'none'
}

function canViewAccounts(user) {
  return evaluatePermission(user, 'canViewAccounts')
}

function canManageAccounts(user) {
  return evaluatePermission(user, 'canManageAccounts')
}

function canViewMappings(user) {
  return evaluatePermission(user, 'canViewMappings')
}

function canManageMappings(user) {
  return evaluatePermission(user, 'canManageMappings')
}

function canViewAccountSummary(user) {
  return evaluatePermission(user, 'canViewAccountSummary')
}

function canViewLedger(user) {
  return evaluatePermission(user, 'canViewLedger')
}

function canCreateTransaction(user) {
  return evaluatePermission(user, 'canCreateTransaction')
}

function canCreateTransactionFor(user, transactionType) {
  if (canCreateTransaction(user)) return true
  const key = String(transactionType || '').toLowerCase()
  return evaluateRule(user, accessMatrix.transactionTypes[key] || {})
}

function canAccessReports(user) {
  return evaluatePermission(user, 'canAccessReports')
}

function canAccessVendors(user) {
  return evaluatePermission(user, 'canAccessVendors')
}

function canManageVendors(user) {
  return evaluatePermission(user, 'canManageVendors')
}

function canUpdateVendorOperational(user) {
  return evaluatePermission(user, 'canUpdateVendorOperational')
}

function canAccessInventory(user) {
  return evaluatePermission(user, 'canAccessInventory')
}

function canAccessTransactions(user) {
  return evaluatePermission(user, 'canAccessTransactions')
}

function canAccessDirectDeals(user) {
  return evaluatePermission(user, 'canAccessDirectDeals')
}

function canManageDirectDeals(user) {
  return evaluatePermission(user, 'canManageDirectDeals')
}

function deriveErpAccessPolicy(user) {
  const canViewCustomers = evaluatePermission(user, 'canViewCustomers')
  const canAccessTransactionsValue = canAccessTransactions(user)
  const canAccessInventoryValue = canAccessInventory(user)
  const canViewAccountsValue = canViewAccounts(user)
  return {
    isSuperAdmin: isSuperAdmin(user),
    isDepartmentHead: isDepartmentHead(user),
    isManagementRole: evaluatePredicate(user, 'isManagementRole'),
    isFinance: isFinance(user),
    isSalesRole: isSales(user),
    isOperationsRole: evaluatePredicate(user, 'isOperationsRole'),
    isHRRole: isHR(user),
    canViewAccounts: canViewAccountsValue,
    canManageAccounts: canManageAccounts(user),
    canViewLedger: canViewLedger(user),
    canViewCustomers,
    canManageCustomers: evaluatePermission(user, 'canManageCustomers'),
    canViewBalanceEnquiry: canViewAccountSummary(user),
    canUpdateMetalRates: evaluatePermission(user, 'canUpdateMetalRates'),
    canExportAccountSummary: evaluatePermission(user, 'canExportAccountSummary'),
    canAccessTransactions: canAccessTransactionsValue,
    canAccessReports: canAccessReports(user),
    canAccessVendors: canAccessVendors(user),
    canManageVendors: canManageVendors(user),
    canUpdateVendorOperational: canUpdateVendorOperational(user),
    canAccessInventory: canAccessInventoryValue,
    canAccessVouchers: evaluatePermission(user, 'canAccessVouchers'),
    canAccessDirectDeals: canAccessDirectDeals(user),
    canAccessERP: canViewAccountsValue || canAccessTransactionsValue || canAccessInventoryValue || canViewCustomers,
  }
}

module.exports = {
  isSuperAdmin,
  isDepartmentHead,
  isFinance,
  isSales,
  isOperations,
  isProduction,
  isHR,
  roleName,
  canViewAccounts,
  canManageAccounts,
  canViewMappings,
  canManageMappings,
  canViewAccountSummary,
  canViewLedger,
  canCreateTransaction,
  canCreateTransactionFor,
  canAccessReports,
  canAccessVendors,
  canManageVendors,
  canUpdateVendorOperational,
  canAccessInventory,
  canAccessTransactions,
  canAccessDirectDeals,
  canManageDirectDeals,
  deriveErpAccessPolicy,
}
