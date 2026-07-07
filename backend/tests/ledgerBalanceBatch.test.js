const { describe, expect, test } = require('@jest/globals')
const {
  computeAgingFromEntries,
  getLedgerEntryAmount,
  isDashboardExpenseLedgerEntry,
  isDashboardExpenseRegisterEntry,
  summarizeDashboardExpenses,
} = require('../utils/ledgerBalanceBatch')

describe('computeAgingFromEntries', () => {
  test('returns zero receivable when customer credits exceed open debits', () => {
    const accountId = '507f1f77bcf86cd799439011'
    const entries = [
      {
        date: new Date('2026-01-10'),
        debitAccountId: accountId,
        creditAccountId: 'cash',
        amount: 1000,
        exchangeRate: 1,
      },
      {
        date: new Date('2026-01-15'),
        debitAccountId: 'cash',
        creditAccountId: accountId,
        amount: 1500,
        exchangeRate: 1,
      },
    ]

    const aging = computeAgingFromEntries(entries, accountId, new Date('2026-06-01'))

    expect(aging.total).toBe(0)
  })

  test('returns remaining open debits after partial payment', () => {
    const accountId = '507f1f77bcf86cd799439011'
    const entries = [
      {
        date: new Date('2026-01-10'),
        debitAccountId: accountId,
        creditAccountId: 'cash',
        amount: 1000,
        exchangeRate: 1,
      },
      {
        date: new Date('2026-01-15'),
        debitAccountId: 'cash',
        creditAccountId: accountId,
        amount: 400,
        exchangeRate: 1,
      },
    ]

    const aging = computeAgingFromEntries(entries, accountId, new Date('2026-06-01'))

    expect(aging.total).toBe(600)
  })
})

describe('dashboard expense helpers', () => {
  const getType = (accountId) => (String(accountId) === 'expense-1' ? 'Expense' : 'Asset')

  test('counts purchase vouchers even when debited to inventory asset accounts', () => {
    expect(isDashboardExpenseLedgerEntry({
      referenceType: 'purchase',
      debitAccountId: 'inventory-1',
    }, getType)).toBe(true)
  })

  test('ignores vendor payments to avoid double counting purchases', () => {
    expect(isDashboardExpenseLedgerEntry({
      referenceType: 'vendor_payment',
      debitAccountId: 'expense-1',
    }, getType)).toBe(true)
    expect(isDashboardExpenseLedgerEntry({
      referenceType: 'vendor_payment',
      debitAccountId: 'ap-1',
    }, getType)).toBe(false)
  })

  test('applies exchange rate to ledger amounts', () => {
    expect(getLedgerEntryAmount({ amount: 100, exchangeRate: 1.25 })).toBe(125)
  })

  test('nets expense debits and credits for account 620001-style payroll advances', () => {
    const expenseId = 'exp-620001'
    const bankId = 'bank-1000'
    const accountMetaMap = new Map([
      [expenseId, { accountCode: '620001', accountName: 'advance payment- payroll', accountType: 'Expense' }],
      [bankId, { accountCode: '1000', accountName: 'Bank', accountType: 'Asset' }],
    ])
    const entries = [
      { debitAccountId: expenseId, creditAccountId: bankId, amount: 6544, exchangeRate: 1 },
      { debitAccountId: bankId, creditAccountId: expenseId, amount: 4000, exchangeRate: 1 },
    ]

    const summary = summarizeDashboardExpenses(entries, accountMetaMap)

    expect(summary.total).toBe(2544)
    expect(summary.byCategory['advance payment- payroll']).toBe(2544)
  })

  test('includes credit-to-expense rows in register eligibility', () => {
    const getType = (accountId) => (String(accountId) === 'expense-1' ? 'Expense' : 'Asset')
    expect(isDashboardExpenseRegisterEntry({
      debitAccountId: 'bank-1',
      creditAccountId: 'expense-1',
      referenceType: 'journal',
    }, getType)).toBe(true)
  })
})
