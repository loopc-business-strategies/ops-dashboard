const fs = require('fs')
const path = require('path')

function loadAccessMatrix() {
  const candidates = [
    process.env.ERP_ACCESS_MATRIX_PATH,
    path.resolve(__dirname, '../../../shared/erp-access-matrix.json'),
    path.resolve(__dirname, '../../shared/erp-access-matrix.json'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate)
    }
  }

  throw new Error(`Unable to locate ERP access matrix JSON. Tried: ${candidates.join(', ')}`)
}

const accessMatrix = loadAccessMatrix()

function getRole(user) {
  return String(user?.role || '').toLowerCase()
}

function getDept(user) {
  return String(user?.department || '').toLowerCase()
}

function isManagementReadOnly(user) {
  return getRole(user) === 'management'
}

function blocksManagementWrite(user) {
  return isManagementReadOnly(user)
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

const ERP_PERMISSION_TO_SUBTAB = {
  canViewAccounts: ['accounts', 'dashboard'],
  canManageAccounts: ['accounts', 'mappings'],
  canViewMappings: ['mappings'],
  canManageMappings: ['mappings'],
  canViewAccountSummary: ['enquiry'],
  canUpdateMetalRates: ['dashboard'],
  canExportAccountSummary: ['enquiry'],
  canViewLedger: ['ledger'],
  canCreateTransaction: ['transactions', 'vouchers'],
  canAccessReports: ['reports'],
  canAccessVendors: ['vendors', 'supplier-margin'],
  canManageVendors: ['vendors'],
  canUpdateVendorOperational: ['vendors'],
  canAccessInventory: ['inventory'],
  canAccessTransactions: ['transactions'],
  canAccessDirectDeals: ['direct-deals'],
  canManageDirectDeals: ['direct-deals'],
  canViewCustomers: ['customers', 'customer-margin'],
  canManageCustomers: ['customers'],
  canAccessVouchers: ['vouchers'],
  canAccessErpSettings: ['settings'],
  canAccessCurrencies: ['currencies'],
  canAccessFixingRegister: ['fixing-register'],
}

function hasGranularPermissions(user) {
  return Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)
}

function hasExplicitErpPermissions(user) {
  return user?.modulePermissions?.erp !== undefined
}

function hasErpSubTab(user, subTabs) {
  if (isSuperAdmin(user)) return true
  if (!hasGranularPermissions(user)) return null
  if (!hasExplicitErpPermissions(user)) return null

  const erpPermission = user?.modulePermissions?.erp
  if (erpPermission?.on !== true) return false

  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return true

  return subTabs.some((subTab) => configuredSubs[subTab]?.on === true)
}

function getAllowedErpSubTabs(user) {
  const allSubs = [...new Set(Object.values(ERP_PERMISSION_TO_SUBTAB).flat())]
  if (isSuperAdmin(user)) return allSubs
  if (!hasGranularPermissions(user)) return null
  if (!hasExplicitErpPermissions(user)) {
    return (user?.allowedModules || []).includes('erp') ? allSubs : []
  }
  const erpPermission = user?.modulePermissions?.erp
  if (erpPermission?.on !== true) return []
  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return allSubs
  return allSubs.filter((subTab) => configuredSubs[subTab]?.on === true)
}

function evaluateErpPermission(user, key) {
  const subTabs = ERP_PERMISSION_TO_SUBTAB[key]
  if (subTabs) {
    const granularAllowed = hasErpSubTab(user, subTabs)
    if (granularAllowed !== null) return granularAllowed
  }
  return evaluatePermission(user, key)
}

function canAccessVouchers(user) {
  return evaluateErpPermission(user, 'canAccessVouchers')
}

function canAccessFixingRegister(user) {
  return evaluateErpPermission(user, 'canAccessFixingRegister')
}

function canAccessErpSettings(user) {
  return evaluateErpPermission(user, 'canAccessErpSettings')
}

function canAccessCurrencies(user) {
  return evaluateErpPermission(user, 'canAccessCurrencies')
}

function canUpdateMetalRates(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canUpdateMetalRates')
}

function canReadDirectDeals(user) {
  return canAccessDirectDeals(user) || canAccessFixingRegister(user)
}

function canAccessOperationalTransactions(user) {
  return canAccessTransactions(user) || canAccessVouchers(user) || canAccessFixingRegister(user)
}

function canReadErpDashboardReport(user) {
  return canViewAccounts(user) || canAccessReports(user)
}

function canReadErpInventory(user) {
  return canAccessInventory(user) || canAccessFixingRegister(user)
}

function canReadErpReferenceData(user) {
  return canViewAccounts(user)
    || canAccessOperationalTransactions(user)
    || canViewAccountSummary(user)
    || canViewLedger(user)
    || canAccessReports(user)
    || canViewMappings(user)
    || canAccessErpSettings(user)
    || canAccessCurrencies(user)
}

function canReadErpParties(user) {
  return canViewCustomers(user)
    || canAccessVendors(user)
    || canAccessOperationalTransactions(user)
    || canReadDirectDeals(user)
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
  return evaluateErpPermission(user, 'canViewAccounts')
}

function canManageAccounts(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canManageAccounts')
}

function canViewMappings(user) {
  return evaluateErpPermission(user, 'canViewMappings')
}

function canManageMappings(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canManageMappings')
}

function canViewAccountSummary(user) {
  return evaluateErpPermission(user, 'canViewAccountSummary')
}

function canViewLedger(user) {
  return evaluateErpPermission(user, 'canViewLedger')
}

function canViewCustomers(user) {
  return evaluateErpPermission(user, 'canViewCustomers')
}

function canManageCustomers(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canManageCustomers')
}

function canCreateTransaction(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canCreateTransaction')
}

function canCreateTransactionFor(user, transactionType) {
  if (blocksManagementWrite(user)) return false
  if (canCreateTransaction(user)) return true
  if (hasExplicitErpPermissions(user) && canAccessOperationalTransactions(user)) return true
  const key = String(transactionType || '').toLowerCase()
  return evaluateRule(user, accessMatrix.transactionTypes[key] || {})
}

function canAccessReports(user) {
  return evaluateErpPermission(user, 'canAccessReports')
}

function canAccessVendors(user) {
  return evaluateErpPermission(user, 'canAccessVendors')
}

function canManageVendors(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canManageVendors')
}

function canUpdateVendorOperational(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canUpdateVendorOperational')
}

function canAccessInventory(user) {
  return evaluateErpPermission(user, 'canAccessInventory')
}

function canAccessTransactions(user) {
  return evaluateErpPermission(user, 'canAccessTransactions')
}

function canAccessDirectDeals(user) {
  return evaluateErpPermission(user, 'canAccessDirectDeals')
}

function canManageDirectDeals(user) {
  if (blocksManagementWrite(user)) return false
  return evaluateErpPermission(user, 'canManageDirectDeals')
}

function canManageTransactionWorkflow(user) {
  if (blocksManagementWrite(user)) return false
  if (isSuperAdmin(user) || isFinance(user)) return true
  return canCreateTransaction(user)
}

function canWriteInventory(user) {
  if (blocksManagementWrite(user)) return false
  return canAccessInventory(user)
}

function canManageInventorySettings(user) {
  if (blocksManagementWrite(user)) return false
  if (isSuperAdmin(user) || isFinance(user)) return true
  return canManageAccounts(user)
}

function canCloseLedgerPeriod(user) {
  if (blocksManagementWrite(user)) return false
  if (isSuperAdmin(user) || isFinance(user)) return true
  return canViewLedger(user) && canCreateTransaction(user)
}

function canEditLedgerEntry(user, entry) {
  if (blocksManagementWrite(user)) return false
  if (isSuperAdmin(user) || isFinance(user)) return true
  if (canCreateTransaction(user)) return true
  const ownerId = String(entry?.createdBy?._id || entry?.createdBy || '')
  return ownerId && ownerId === String(user?._id || '')
}

function canViewERPModule(user) {
  if (isSuperAdmin(user)) return true
  if (hasGranularPermissions(user)) {
    if (!hasExplicitErpPermissions(user)) {
      return (user?.allowedModules || []).includes('erp')
    }
    return user?.modulePermissions?.erp?.on === true
  }
  return (user?.allowedModules || []).includes('erp')
}

function deriveErpAccessPolicy(user) {
  const canViewCustomersValue = canViewCustomers(user)
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
    canViewCustomers: canViewCustomersValue,
    canManageCustomers: canManageCustomers(user),
    canViewBalanceEnquiry: canViewAccountSummary(user),
    canUpdateMetalRates: evaluateErpPermission(user, 'canUpdateMetalRates'),
    canExportAccountSummary: evaluateErpPermission(user, 'canExportAccountSummary'),
    canAccessTransactions: canAccessTransactionsValue,
    canAccessReports: canAccessReports(user),
    canAccessVendors: canAccessVendors(user),
    canManageVendors: canManageVendors(user),
    canUpdateVendorOperational: canUpdateVendorOperational(user),
    canAccessInventory: canAccessInventoryValue,
    canAccessVouchers: evaluateErpPermission(user, 'canAccessVouchers'),
    canAccessDirectDeals: canAccessDirectDeals(user),
    canAccessErpSettings: evaluateErpPermission(user, 'canAccessErpSettings'),
    canAccessCurrencies: evaluateErpPermission(user, 'canAccessCurrencies'),
    canAccessFixingRegister: evaluateErpPermission(user, 'canAccessFixingRegister'),
    canCreateTransaction: canCreateTransaction(user),
    canManageDirectDeals: canManageDirectDeals(user),
    canManageTransactionWorkflow: canManageTransactionWorkflow(user),
    canCloseLedgerPeriod: canCloseLedgerPeriod(user),
    canAccessERP: hasGranularPermissions(user)
      ? getAllowedErpSubTabs(user).length > 0
      : (canViewERPModule(user) && (
        canViewAccountsValue || canAccessTransactionsValue || canAccessInventoryValue || canViewCustomersValue
      )),
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
  hasExplicitErpPermissions,
  canViewAccounts,
  canManageAccounts,
  canViewMappings,
  canManageMappings,
  canViewAccountSummary,
  canViewLedger,
  canViewCustomers,
  canManageCustomers,
  canCreateTransaction,
  canCreateTransactionFor,
  canAccessReports,
  canAccessVendors,
  canManageVendors,
  canUpdateVendorOperational,
  canAccessInventory,
  canAccessTransactions,
  canAccessVouchers,
  canAccessFixingRegister,
  canAccessErpSettings,
  canAccessCurrencies,
  canUpdateMetalRates,
  canAccessOperationalTransactions,
  canReadErpDashboardReport,
  canReadErpInventory,
  canReadDirectDeals,
  canReadErpReferenceData,
  canReadErpParties,
  canAccessDirectDeals,
  canManageDirectDeals,
  canManageTransactionWorkflow,
  canWriteInventory,
  canManageInventorySettings,
  canCloseLedgerPeriod,
  canEditLedgerEntry,
  deriveErpAccessPolicy,
}
