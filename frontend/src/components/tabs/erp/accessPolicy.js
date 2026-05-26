import accessMatrix from '../../../generated/erp-access-matrix.json'
import {
  canViewErpSubTab,
  canViewERPModule,
  getAllowedErpSubTabs,
  hasGranularModulePermissions,
} from '../../../utils/erpSubTabPermissions'

function getRole(user) {
  return String(user?.role || '').toLowerCase()
}

function getDept(user) {
  return String(user?.department || '').toLowerCase()
}

function isManagementReadOnly(user) {
  return getRole(user) === 'management'
}

function applyManagementReadOnly(user, allowed) {
  if (!allowed) return false
  return !isManagementReadOnly(user)
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
  canManageAccounts: ['accounts', 'mappings'],
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
  canAccessErpSettings: ['settings'],
  canAccessCurrencies: ['currencies'],
  canAccessFixingRegister: ['fixing-register'],
}

function hasGranularPermissions(user) {
  return hasGranularModulePermissions(user)
}

function hasErpSubTab(user, subTabs) {
  if (String(user?.role || '').toLowerCase() === 'super_admin') return true
  if (!hasGranularPermissions(user)) return null
  return subTabs.some((subTab) => canViewErpSubTab(user, subTab))
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
  const canManageAccounts = applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageAccounts'))
  const canViewLedger = evaluateErpPermission(user, 'canViewLedger')
  const canViewCustomers = evaluateErpPermission(user, 'canViewCustomers')
  const canManageCustomers = applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageCustomers'))
  const canViewBalanceEnquiry = evaluateErpPermission(user, 'canViewAccountSummary')
  const canUpdateMetalRates = applyManagementReadOnly(user, evaluateErpPermission(user, 'canUpdateMetalRates'))
  const canExportAccountSummary = evaluateErpPermission(user, 'canExportAccountSummary')
  const canAccessTransactions = evaluateErpPermission(user, 'canAccessTransactions')
  const canAccessReports = evaluateErpPermission(user, 'canAccessReports')
  const canAccessVendors = evaluateErpPermission(user, 'canAccessVendors')
  const canManageVendors = applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageVendors'))
  const canUpdateVendorOperational = applyManagementReadOnly(user, evaluateErpPermission(user, 'canUpdateVendorOperational'))
  const canAccessInventory = evaluateErpPermission(user, 'canAccessInventory')
  const canAccessVouchers = evaluateErpPermission(user, 'canAccessVouchers')
  const canAccessDirectDeals = evaluateErpPermission(user, 'canAccessDirectDeals')
  const canAccessErpSettings = evaluateErpPermission(user, 'canAccessErpSettings')
  const canAccessCurrencies = evaluateErpPermission(user, 'canAccessCurrencies')
  const canAccessFixingRegister = evaluateErpPermission(user, 'canAccessFixingRegister')
  const canAccessERP = hasGranularPermissions(user)
    ? getAllowedErpSubTabs(user).length > 0
    : (canViewERPModule(user) && (
      canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers
    ))

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
    canAccessErpSettings,
    canAccessCurrencies,
    canAccessFixingRegister,
    canAccessERP,
  }
}
