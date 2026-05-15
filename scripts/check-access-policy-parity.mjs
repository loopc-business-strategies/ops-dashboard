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

function deriveGeneratedPolicy(user) {
  const canViewAccounts = evaluatePermission(user, 'canViewAccounts')
  const canViewCustomers = evaluatePermission(user, 'canViewCustomers')
  const canAccessTransactions = evaluatePermission(user, 'canAccessTransactions')
  const canAccessInventory = evaluatePermission(user, 'canAccessInventory')

  return {
    isSuperAdmin: evaluatePredicate(user, 'isSuperAdmin'),
    isDepartmentHead: evaluatePredicate(user, 'isDepartmentHead'),
    isManagementRole: evaluatePredicate(user, 'isManagementRole'),
    isFinance: evaluatePredicate(user, 'isFinance'),
    isSalesRole: evaluatePredicate(user, 'isSalesRole'),
    isOperationsRole: evaluatePredicate(user, 'isOperationsRole'),
    isHRRole: evaluatePredicate(user, 'isHRRole'),
    canViewAccounts,
    canManageAccounts: evaluatePermission(user, 'canManageAccounts'),
    canViewLedger: evaluatePermission(user, 'canViewLedger'),
    canViewCustomers,
    canManageCustomers: evaluatePermission(user, 'canManageCustomers'),
    canViewBalanceEnquiry: evaluatePermission(user, 'canViewAccountSummary'),
    canUpdateMetalRates: evaluatePermission(user, 'canUpdateMetalRates'),
    canExportAccountSummary: evaluatePermission(user, 'canExportAccountSummary'),
    canAccessTransactions,
    canAccessReports: evaluatePermission(user, 'canAccessReports'),
    canAccessVendors: evaluatePermission(user, 'canAccessVendors'),
    canManageVendors: evaluatePermission(user, 'canManageVendors'),
    canUpdateVendorOperational: evaluatePermission(user, 'canUpdateVendorOperational'),
    canAccessInventory,
    canAccessVouchers: evaluatePermission(user, 'canAccessVouchers'),
    canAccessDirectDeals: evaluatePermission(user, 'canAccessDirectDeals'),
    canAccessERP: canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers,
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
  'canAccessERP',
]

for (const user of scenarios) {
  const backend = backendPolicy.deriveErpAccessPolicy(user)
  const frontend = deriveGeneratedPolicy(user)

  for (const key of parityKeys) {
    assert.equal(
      backend[key],
      frontend[key],
      `Policy mismatch for ${JSON.stringify(user)} on key ${key}: backend=${backend[key]} frontend=${frontend[key]}`
    )
  }
}

console.log('Access policy parity check passed.')
