import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
const backendPolicy = require(path.join(repoRoot, 'backend/services/erpAccounting/accessPolicy.js'))
const frontendModuleUrl = pathToFileURL(path.join(repoRoot, 'frontend/src/components/tabs/erp/accessPolicy.js')).href
const frontendPolicy = await import(frontendModuleUrl)

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
  const frontend = frontendPolicy.deriveErpAccessPolicy(user)

  for (const key of parityKeys) {
    assert.equal(
      backend[key],
      frontend[key],
      `Policy mismatch for ${JSON.stringify(user)} on key ${key}: backend=${backend[key]} frontend=${frontend[key]}`
    )
  }
}

console.log('Access policy parity check passed.')
