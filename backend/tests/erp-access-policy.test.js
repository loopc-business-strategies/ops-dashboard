const {
  canAccessTransactions,
  canAccessVendors,
  canViewAccounts,
  canViewAccountSummary,
  canViewCustomers,
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

  test('customer margin and account summary permissions are not role blocked', () => {
    const user = {
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
    }

    expect(canViewCustomers(user)).toBe(true)
    expect(canViewAccountSummary(user)).toBe(true)
    expect(deriveErpAccessPolicy(user).canViewCustomers).toBe(true)
    expect(deriveErpAccessPolicy(user).canViewBalanceEnquiry).toBe(true)
  })
})
