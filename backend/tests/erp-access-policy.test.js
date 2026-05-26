const {
  canAccessTransactions,
  canAccessVendors,
  canViewAccounts,
  deriveErpAccessPolicy,
} = require('../services/erpAccounting/accessPolicy')

describe('ERP accounting access policy', () => {
  test('uses granular ERP subtabs for users outside the role matrix', () => {
    const user = {
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
    }

    expect(canAccessTransactions(user)).toBe(true)
    expect(canAccessVendors(user)).toBe(true)
    expect(canViewAccounts(user)).toBe(false)
    expect(deriveErpAccessPolicy(user).canAccessERP).toBe(true)
  })

  test('granular ERP off overrides legacy allowed module access', () => {
    const user = {
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: {
        erp: { on: false },
      },
    }

    expect(canAccessTransactions(user)).toBe(false)
    expect(deriveErpAccessPolicy(user).canAccessERP).toBe(false)
  })
})
