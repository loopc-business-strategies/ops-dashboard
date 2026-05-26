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
})
