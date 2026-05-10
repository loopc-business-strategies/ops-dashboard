// Embedded access matrix data (mirrors backend shared/erp-access-matrix.json)
const accessMatrix = {
  "predicates": {
    "isSuperAdmin": { "roles": ["super_admin"] },
    "isDepartmentHead": { "roles": ["department_head"] },
    "isManagementRole": { "roles": ["management"] },
    "isFinance": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "isSalesRole": { "roles": ["super_admin", "management"], "departmentHead": ["sales"] },
    "isOperationsRole": { "roles": ["super_admin"], "departmentHead": ["operations", "production"] },
    "isHRRole": { "roles": ["super_admin"], "departmentHead": ["hr"] }
  },
  "permissions": {
    "canViewAccounts": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canManageAccounts": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canViewMappings": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canManageMappings": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canViewAccountSummary": { "roles": ["super_admin"], "departmentHead": ["*"] },
    "canViewLedger": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canCreateTransaction": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canAccessTransactions": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales", "operations", "production", "hr"] },
    "canAccessReports": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canAccessVendors": { "roles": ["super_admin"], "departmentHead": ["finance", "operations"] },
    "canManageVendors": { "roles": ["super_admin"], "departmentHead": ["finance"] },
    "canUpdateVendorOperational": { "roles": ["super_admin"], "departmentHead": ["finance", "operations"] },
    "canAccessInventory": { "roles": ["super_admin"], "departmentHead": ["finance", "operations", "production"] },
    "canAccessVouchers": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "canAccessDirectDeals": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "canManageDirectDeals": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "canViewCustomers": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "canManageCustomers": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "canUpdateMetalRates": { "roles": [], "departmentHead": ["finance"] },
    "canExportAccountSummary": { "roles": ["super_admin"], "departmentHead": [] }
  },
  "transactionTypes": {
    "sale": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "receipt": { "roles": ["super_admin", "management"], "departmentHead": ["finance", "sales"] },
    "purchase": { "roles": ["super_admin"], "departmentHead": ["finance", "operations", "production"] },
    "expense": { "roles": ["super_admin"], "departmentHead": ["finance", "operations", "production"] },
    "payroll": { "roles": ["super_admin"], "departmentHead": ["finance", "hr"] },
    "payment": { "roles": ["super_admin"], "departmentHead": ["finance"] }
  }
}

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
