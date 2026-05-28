import accessMatrix from '../../../generated/erp-access-matrix.json'
import {
  canViewErpSubTab,
  canViewERPModule,
  getAllowedErpSubTabs,
  hasGranularModulePermissions,
} from '../../../utils/erpSubTabPermissions'

const TRANSACTION_TYPES = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll', 'metal_receipt', 'metal_payment']

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
  canViewMappings: ['mappings'],
  canManageMappings: ['mappings'],
  canViewLedger: ['ledger'],
  canViewCustomers: ['customers', 'customer-margin'],
  canManageCustomers: ['customers'],
  canViewAccountSummary: ['enquiry'],
  canUpdateMetalRates: ['dashboard'],
  canExportAccountSummary: ['enquiry'],
  canCreateTransaction: ['transactions', 'vouchers'],
  canAccessTransactions: ['transactions'],
  canAccessReports: ['reports'],
  canAccessVendors: ['vendors', 'supplier-margin'],
  canManageVendors: ['vendors'],
  canUpdateVendorOperational: ['vendors'],
  canAccessInventory: ['inventory'],
  canAccessVouchers: ['vouchers'],
  canAccessDirectDeals: ['direct-deals'],
  canManageDirectDeals: ['direct-deals'],
  canAccessErpSettings: ['settings'],
  canAccessCurrencies: ['currencies'],
  canAccessFixingRegister: ['fixing-register'],
}

function hasGranularPermissions(user) {
  return hasGranularModulePermissions(user)
}

function hasExplicitErpPermissions(user) {
  return user?.modulePermissions?.erp !== undefined
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

function canAccessOperationalTransactions(user) {
  return evaluateErpPermission(user, 'canAccessTransactions')
    || evaluateErpPermission(user, 'canAccessVouchers')
    || evaluateErpPermission(user, 'canAccessFixingRegister')
}

export function canCreateTransaction(user) {
  return applyManagementReadOnly(user, evaluateErpPermission(user, 'canCreateTransaction'))
}

export function canCreateTransactionFor(user, transactionType) {
  if (applyManagementReadOnly(user, false)) return false
  if (canCreateTransaction(user)) return true
  if (hasExplicitErpPermissions(user) && canAccessOperationalTransactions(user)) return true
  const key = String(transactionType || '').toLowerCase()
  return evaluateRule(user, accessMatrix.transactionTypes[key] || {})
}

export function canManageTransactionWorkflow(user) {
  if (applyManagementReadOnly(user, false)) return false
  if (evaluatePredicate(user, 'isSuperAdmin') || evaluatePredicate(user, 'isFinance')) return true
  return canCreateTransaction(user)
}

export function canManageDirectDeals(user) {
  return applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageDirectDeals'))
}

export function canCloseLedgerPeriod(user) {
  if (applyManagementReadOnly(user, false)) return false
  if (evaluatePredicate(user, 'isSuperAdmin') || evaluatePredicate(user, 'isFinance')) return true
  return evaluateErpPermission(user, 'canViewLedger') && canCreateTransaction(user)
}

export function getAvailableTransactionTypes(user) {
  const isSuperAdmin = evaluatePredicate(user, 'isSuperAdmin')
  const isFinance = evaluatePredicate(user, 'isFinance')
  if (isSuperAdmin || isFinance || canCreateTransaction(user)) return TRANSACTION_TYPES
  if (hasExplicitErpPermissions(user) && canAccessOperationalTransactions(user)) return TRANSACTION_TYPES
  const isSalesRole = evaluatePredicate(user, 'isSalesRole')
  const isOperationsRole = evaluatePredicate(user, 'isOperationsRole')
  const isHRRole = evaluatePredicate(user, 'isHRRole')
  const dept = getDept(user)
  const isProduction = getRole(user) === 'department_head' && dept === 'production'
  if (isSalesRole) return ['sale', 'receipt', 'metal_payment']
  if (isOperationsRole || isProduction) return ['purchase', 'expense', 'metal_receipt']
  if (isHRRole) return ['payroll']
  return []
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
  const canViewMappings = evaluateErpPermission(user, 'canViewMappings')
  const canViewLedger = evaluateErpPermission(user, 'canViewLedger')
  const canViewCustomers = evaluateErpPermission(user, 'canViewCustomers')
  const canManageCustomers = applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageCustomers'))
  const canViewBalanceEnquiry = evaluateErpPermission(user, 'canViewAccountSummary')
  const canUpdateMetalRatesValue = applyManagementReadOnly(user, evaluateErpPermission(user, 'canUpdateMetalRates'))
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
  const canCreateTransactionValue = canCreateTransaction(user)
  const canManageDirectDealsValue = canManageDirectDeals(user)
  const canManageTransactionWorkflowValue = canManageTransactionWorkflow(user)
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
    canViewMappings,
    canViewLedger,
    canViewCustomers,
    canManageCustomers,
    canViewBalanceEnquiry,
    canUpdateMetalRates: canUpdateMetalRatesValue,
    canExportAccountSummary,
    canAccessTransactions,
    canAccessReports,
    canAccessVendors,
    canManageVendors,
    canUpdateVendorOperational,
    canAccessInventory,
    canAccessVouchers,
    canAccessDirectDeals,
    canManageDirectDeals: canManageDirectDealsValue,
    canAccessErpSettings,
    canAccessCurrencies,
    canAccessFixingRegister,
    canCreateTransaction: canCreateTransactionValue,
    canManageTransactionWorkflow: canManageTransactionWorkflowValue,
    canCloseLedgerPeriod: canCloseLedgerPeriod(user),
    canAccessERP,
  }
}
