const {
  canAccessTransactions,
  canAccessVouchers,
  canAccessOperationalTransactions,
  canReadErpReferenceData,
  canReadErpParties,
  canReadErpDashboardReport,
  canReadErpInventory,
  canReadDirectDeals,
  canAccessVendors,
  canManageCustomers,
  canManageDirectDeals,
  canCreateTransaction,
  canCreateTransactionFor,
  canViewAccounts,
  canViewMappings,
  canViewAccountSummary,
  canViewCustomers,
  canAccessReports,
  canAccessInventory,
  canAccessDirectDeals,
  canAccessErpSettings,
  canAccessCurrencies,
  canAccessFixingRegister,
  deriveErpAccessPolicy,
} = require('../services/erpAccounting/accessPolicy')
const { getRoleTransactionTypes } = require('../routes/erp-accounting/transactionHelpers')

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

  test('management role remains read-only for ERP writes', () => {
    const user = { role: 'management', allowedModules: ['erp'] }
    expect(canManageCustomers(user)).toBe(false)
    expect(canManageDirectDeals(user)).toBe(false)
    expect(canCreateTransactionFor(user, 'sale')).toBe(false)
    expect(canAccessTransactions(user)).toBe(true)
    expect(canViewCustomers(user)).toBe(true)
  })

  test('dashboard ERP subtab grants accounts but not mappings access', () => {
    const user = {
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
    }

    expect(canAccessTransactions(user)).toBe(true)
    expect(canViewAccounts(user)).toBe(true)
    expect(canViewMappings(user)).toBe(false)
  })

  test('non-ERP granular permissions fall back to role matrix for ERP reads', () => {
    const user = {
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: {
        sales: { on: true },
      },
    }

    expect(canAccessTransactions(user)).toBe(true)
    expect(deriveErpAccessPolicy(user).canAccessERP).toBe(true)
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

  test('vouchers permission grants operational transaction and reference reads', () => {
    const user = {
      role: 'department_user',
      department: 'operations',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            vouchers: { on: true },
          },
        },
      },
    }

    expect(canAccessVouchers(user)).toBe(true)
    expect(canAccessTransactions(user)).toBe(false)
    expect(canAccessOperationalTransactions(user)).toBe(true)
    expect(canCreateTransaction(user)).toBe(true)
    expect(canCreateTransactionFor(user, 'payment')).toBe(true)
    expect(canReadErpReferenceData(user)).toBe(true)
    expect(canReadErpParties(user)).toBe(true)
    expect(getRoleTransactionTypes(user)).toEqual(expect.arrayContaining(['payment', 'receipt']))
  })

  test('account summary permission alone does not grant accounts tab access', () => {
    const user = {
      role: 'department_user',
      department: 'sales',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            enquiry: { on: true },
          },
        },
      },
    }

    expect(canViewAccountSummary(user)).toBe(true)
    expect(canViewAccounts(user)).toBe(false)
    expect(canReadErpReferenceData(user)).toBe(true)
  })

  test('reports-only permission grants dashboard report and reference reads', () => {
    const user = {
      role: 'department_user',
      department: 'finance',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            reports: { on: true },
          },
        },
      },
    }

    expect(canAccessReports(user)).toBe(true)
    expect(canViewAccounts(user)).toBe(false)
    expect(canReadErpDashboardReport(user)).toBe(true)
    expect(canReadErpReferenceData(user)).toBe(true)
  })

  test('fixing register permission grants operational reads without full tabs', () => {
    const user = {
      role: 'department_user',
      department: 'operations',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            'fixing-register': { on: true },
          },
        },
      },
    }

    expect(canAccessFixingRegister(user)).toBe(true)
    expect(canAccessTransactions(user)).toBe(false)
    expect(canAccessDirectDeals(user)).toBe(false)
    expect(canAccessInventory(user)).toBe(false)
    expect(canAccessOperationalTransactions(user)).toBe(true)
    expect(canReadDirectDeals(user)).toBe(true)
    expect(canReadErpInventory(user)).toBe(true)
    expect(canReadErpReferenceData(user)).toBe(true)
    expect(canReadErpParties(user)).toBe(true)
  })

  test('inventory-only permission does not grant fixing register reads', () => {
    const user = {
      role: 'department_user',
      department: 'operations',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            inventory: { on: true },
          },
        },
      },
    }

    expect(canAccessInventory(user)).toBe(true)
    expect(canReadErpInventory(user)).toBe(true)
    expect(canReadDirectDeals(user)).toBe(false)
    expect(canAccessOperationalTransactions(user)).toBe(false)
  })

  test('settings and currencies permissions grant reference reads only', () => {
    const settingsUser = {
      role: 'department_user',
      department: 'finance',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            settings: { on: true },
          },
        },
      },
    }
    const currenciesUser = {
      role: 'department_user',
      department: 'finance',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            currencies: { on: true },
          },
        },
      },
    }

    expect(canAccessErpSettings(settingsUser)).toBe(true)
    expect(canAccessCurrencies(currenciesUser)).toBe(true)
    expect(canReadErpReferenceData(settingsUser)).toBe(true)
    expect(canReadErpReferenceData(currenciesUser)).toBe(true)
    expect(canReadErpParties(settingsUser)).toBe(false)
    expect(canReadErpParties(currenciesUser)).toBe(false)
  })
})
