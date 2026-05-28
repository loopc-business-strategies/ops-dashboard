import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
const backendPolicy = require(path.join(repoRoot, 'backend/services/erpAccounting/accessPolicy.js'))
const canonicalMatrix = require(path.join(repoRoot, 'shared/erp-access-matrix.json'))
const backendMatrixPath = path.join(repoRoot, 'backend/shared/erp-access-matrix.json')
const frontendMatrixPath = path.join(repoRoot, 'frontend/src/generated/erp-access-matrix.json')

for (const matrixPath of [backendMatrixPath, frontendMatrixPath]) {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
  assert.deepEqual(matrix, canonicalMatrix, `${path.relative(repoRoot, matrixPath)} is not synced with shared/erp-access-matrix.json`)
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
  return evaluateRule(user, canonicalMatrix.predicates[key] || {})
}

function evaluatePermission(user, key) {
  return evaluateRule(user, canonicalMatrix.permissions[key] || {})
}

function hasGranularModulePermissions(user) {
  return Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)
}

function hasExplicitErpPermissions(user) {
  return user?.modulePermissions?.erp !== undefined
}

function canViewErpSubTab(user, subTab) {
  if (getRole(user) === 'super_admin') return true
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

function getAllowedErpSubTabs(user) {
  const allSubs = [...new Set(Object.values(ERP_PERMISSION_TO_SUBTAB).flat())]
  if (getRole(user) === 'super_admin') return allSubs
  if (!hasGranularModulePermissions(user)) return null
  if (!hasExplicitErpPermissions(user)) {
    return (user?.allowedModules || []).includes('erp') ? allSubs : []
  }
  const erpPermission = user?.modulePermissions?.erp
  if (erpPermission?.on !== true) return []
  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return allSubs
  return allSubs.filter((subTab) => configuredSubs[subTab]?.on === true)
}

const ERP_PERMISSION_TO_SUBTAB = {
  canViewAccounts: ['accounts', 'dashboard'],
  canManageAccounts: ['accounts', 'mappings'],
  canViewMappings: ['mappings'],
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

function hasErpSubTab(user, subTabs) {
  if (getRole(user) === 'super_admin') return true
  if (!hasGranularModulePermissions(user)) return null
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

function applyManagementReadOnly(user, allowed) {
  if (!allowed) return false
  return getRole(user) !== 'management'
}

function canViewERPModule(user) {
  if (getRole(user) === 'super_admin') return true
  if (hasGranularModulePermissions(user)) {
    if (!hasExplicitErpPermissions(user)) {
      return (user?.allowedModules || []).includes('erp')
    }
    return user?.modulePermissions?.erp?.on === true
  }
  return (user?.allowedModules || []).includes('erp')
}

function deriveFrontendPolicy(user) {
  const canViewAccounts = evaluateErpPermission(user, 'canViewAccounts')
  const canAccessTransactions = evaluateErpPermission(user, 'canAccessTransactions')
  const canAccessInventory = evaluateErpPermission(user, 'canAccessInventory')
  const canViewCustomers = evaluateErpPermission(user, 'canViewCustomers')
  const canCreateTransaction = applyManagementReadOnly(user, evaluateErpPermission(user, 'canCreateTransaction'))
  const canManageDirectDeals = applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageDirectDeals'))
  const canManageTransactionWorkflow = applyManagementReadOnly(user, false)
    ? false
    : (evaluatePredicate(user, 'isSuperAdmin') || evaluatePredicate(user, 'isFinance') || canCreateTransaction)
  const canCloseLedgerPeriod = applyManagementReadOnly(user, false)
    ? false
    : (evaluatePredicate(user, 'isSuperAdmin') || evaluatePredicate(user, 'isFinance') || (evaluateErpPermission(user, 'canViewLedger') && canCreateTransaction))
  return {
    isSuperAdmin: evaluatePredicate(user, 'isSuperAdmin'),
    isDepartmentHead: evaluatePredicate(user, 'isDepartmentHead'),
    isManagementRole: evaluatePredicate(user, 'isManagementRole'),
    isFinance: evaluatePredicate(user, 'isFinance'),
    isSalesRole: evaluatePredicate(user, 'isSalesRole'),
    isOperationsRole: evaluatePredicate(user, 'isOperationsRole'),
    isHRRole: evaluatePredicate(user, 'isHRRole'),
    canViewAccounts,
    canManageAccounts: applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageAccounts')),
    canViewLedger: evaluateErpPermission(user, 'canViewLedger'),
    canViewCustomers,
    canManageCustomers: applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageCustomers')),
    canViewBalanceEnquiry: evaluateErpPermission(user, 'canViewAccountSummary'),
    canUpdateMetalRates: applyManagementReadOnly(user, evaluateErpPermission(user, 'canUpdateMetalRates')),
    canExportAccountSummary: evaluateErpPermission(user, 'canExportAccountSummary'),
    canAccessTransactions,
    canAccessReports: evaluateErpPermission(user, 'canAccessReports'),
    canAccessVendors: evaluateErpPermission(user, 'canAccessVendors'),
    canManageVendors: applyManagementReadOnly(user, evaluateErpPermission(user, 'canManageVendors')),
    canUpdateVendorOperational: applyManagementReadOnly(user, evaluateErpPermission(user, 'canUpdateVendorOperational')),
    canAccessInventory,
    canAccessVouchers: evaluateErpPermission(user, 'canAccessVouchers'),
    canAccessDirectDeals: evaluateErpPermission(user, 'canAccessDirectDeals'),
    canManageDirectDeals,
    canAccessErpSettings: evaluateErpPermission(user, 'canAccessErpSettings'),
    canAccessCurrencies: evaluateErpPermission(user, 'canAccessCurrencies'),
    canAccessFixingRegister: evaluateErpPermission(user, 'canAccessFixingRegister'),
    canCreateTransaction,
    canManageTransactionWorkflow,
    canCloseLedgerPeriod,
    canAccessERP: hasGranularModulePermissions(user)
      ? getAllowedErpSubTabs(user).length > 0
      : (canViewERPModule(user) && (canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers)),
  }
}

const scenarios = [
  { role: 'super_admin', department: '' },
  { role: 'management', department: 'management' },
  { role: 'department_head', department: 'finance' },
  { role: 'department_head', department: 'sales' },
  { role: 'department_head', department: 'operations' },
  { role: 'department_head', department: 'production' },
  { role: 'department_head', department: 'hr' },
  { role: 'department_user', department: 'operations' },
  { role: 'external', department: '' },
]

const parityKeys = [
  'isSuperAdmin',
  'isDepartmentHead',
  'isManagementRole',
  'isFinance',
  'isSalesRole',
  'isOperationsRole',
  'isHRRole',
  'canViewAccounts',
  'canManageAccounts',
  'canViewLedger',
  'canViewCustomers',
  'canManageCustomers',
  'canViewBalanceEnquiry',
  'canUpdateMetalRates',
  'canExportAccountSummary',
  'canAccessTransactions',
  'canAccessReports',
  'canAccessVendors',
  'canManageVendors',
  'canUpdateVendorOperational',
  'canAccessInventory',
  'canAccessVouchers',
  'canAccessDirectDeals',
  'canManageDirectDeals',
  'canAccessErpSettings',
  'canAccessCurrencies',
  'canAccessFixingRegister',
  'canCreateTransaction',
  'canManageTransactionWorkflow',
  'canCloseLedgerPeriod',
  'canAccessERP',
]

for (const user of scenarios) {
  const backend = backendPolicy.deriveErpAccessPolicy(user)
  const frontend = deriveFrontendPolicy(user)

  for (const key of parityKeys) {
    assert.equal(
      backend[key],
      frontend[key],
      `Policy mismatch for ${JSON.stringify(user)} on key ${key}: backend=${backend[key]} frontend=${frontend[key]}`
    )
  }
}

console.log('Access policy parity check passed.')
