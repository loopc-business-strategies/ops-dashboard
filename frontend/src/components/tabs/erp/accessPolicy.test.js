import { describe, expect, test } from 'vitest'
import { deriveErpAccessPolicy } from './accessPolicy'

describe('ERP access policy', () => {
  test('uses granular ERP subtabs for non-role ERP users', () => {
    const policy = deriveErpAccessPolicy({
      role: 'external',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            transactions: { on: true },
            vendors: { on: true },
          },
        },
      },
    })

    expect(policy.canAccessERP).toBe(true)
    expect(policy.canAccessTransactions).toBe(true)
    expect(policy.canAccessVendors).toBe(true)
    expect(policy.canViewAccounts).toBe(false)
    expect(policy.canAccessInventory).toBe(false)
  })

  test('granular ERP sub tabs block unconfigured ERP pages', () => {
    const policy = deriveErpAccessPolicy({
      role: 'management',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            dashboard: { on: true },
            customers: { on: true },
          },
        },
      },
    })

    expect(policy.canAccessERP).toBe(true)
    expect(policy.canViewAccounts).toBe(true)
    expect(policy.canAccessTransactions).toBe(false)
    expect(policy.canAccessInventory).toBe(false)
    expect(policy.canAccessErpSettings).toBe(false)
    expect(policy.canAccessCurrencies).toBe(false)
    expect(policy.canAccessFixingRegister).toBe(false)
  })

  test('blocks ERP when granular ERP permission is off', () => {
    const policy = deriveErpAccessPolicy({
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: {
        erp: { on: false },
      },
    })

    expect(policy.canAccessERP).toBe(false)
    expect(policy.canAccessTransactions).toBe(false)
  })

  test('management role is read-only for ERP manage actions', () => {
    const policy = deriveErpAccessPolicy({
      role: 'management',
      allowedModules: ['erp'],
    })

    expect(policy.isManagementRole).toBe(true)
    expect(policy.canAccessTransactions).toBe(true)
    expect(policy.canManageCustomers).toBe(false)
    expect(policy.canManageVendors).toBe(false)
    expect(policy.canManageAccounts).toBe(false)
  })

  test('dashboard subtab grants accounts but not mappings', () => {
    const policy = deriveErpAccessPolicy({
      role: 'management',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            dashboard: { on: true },
            transactions: { on: true },
          },
        },
      },
    })

    expect(policy.canAccessTransactions).toBe(true)
    expect(policy.canViewAccounts).toBe(true)
    expect(policy.canViewMappings).toBe(false)
  })

  test('customer margin and account summary permissions are not role blocked', () => {
    const policy = deriveErpAccessPolicy({
      role: 'external',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            'customer-margin': { on: true },
            enquiry: { on: true },
          },
        },
      },
    })

    expect(policy.canAccessERP).toBe(true)
    expect(policy.canViewCustomers).toBe(true)
    expect(policy.canViewBalanceEnquiry).toBe(true)
    expect(policy.canViewAccounts).toBe(false)
  })
})
