const {
  canCreateTransactionFor,
  canAccessTransactions,
  canViewLedger,
  canAccessDirectDeals,
  canManageVendors,
} = require('../services/erpAccounting/accessPolicy')

describe('ERP accounting access policy', () => {
  test('finance department head can view ledger and post all transaction types', () => {
    const user = { role: 'department_head', department: 'finance' }

    expect(canViewLedger(user)).toBe(true)
    expect(canCreateTransactionFor(user, 'sale')).toBe(true)
    expect(canCreateTransactionFor(user, 'purchase')).toBe(true)
    expect(canCreateTransactionFor(user, 'payroll')).toBe(true)
  })

  test('sales department head can only post sales receipts and direct deals', () => {
    const user = { role: 'department_head', department: 'sales' }

    expect(canCreateTransactionFor(user, 'sale')).toBe(true)
    expect(canCreateTransactionFor(user, 'receipt')).toBe(true)
    expect(canCreateTransactionFor(user, 'purchase')).toBe(false)
    expect(canCreateTransactionFor(user, 'payroll')).toBe(false)
    expect(canAccessDirectDeals(user)).toBe(true)
  })

  test('operations department head can access transactions but not direct deals', () => {
    const user = { role: 'department_head', department: 'operations' }

    expect(canAccessTransactions(user)).toBe(true)
    expect(canCreateTransactionFor(user, 'purchase')).toBe(true)
    expect(canCreateTransactionFor(user, 'expense')).toBe(true)
    expect(canCreateTransactionFor(user, 'sale')).toBe(false)
    expect(canAccessDirectDeals(user)).toBe(false)
    expect(canManageVendors(user)).toBe(false)
  })
})
