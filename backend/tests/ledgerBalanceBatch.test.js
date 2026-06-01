const { describe, expect, test } = require('@jest/globals')
const {
  computeAgingFromEntries,
  getLedgerEntryAmount,
  isDashboardExpenseLedgerEntry,
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
})
