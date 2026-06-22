const { describe, expect, test } = require('@jest/globals')
const {
  summarizeProfitLossEntriesFromLedgerRows,
  buildProfitLossDateQuery,
  toEndOfDay,
} = require('../services/erpAccounting/reportSummaryService')

const expenseId = 'exp-620001'
const incomeId = 'inc-4190'
const bankId = 'bank-1000'

const pnlAccounts = {
  incomeById: new Map([[incomeId, { accountCode: '4190', accountName: 'Exchange Gain' }]]),
  expenseById: new Map([[expenseId, { accountCode: '620001', accountName: 'advance payment- payroll' }]]),
  incomeIds: new Set([incomeId]),
  expenseIds: new Set([expenseId]),
}

describe('summarizeProfitLossEntriesFromLedgerRows', () => {
  test('nets expense debits and credits in period', () => {
    const entries = [
      { debitAccountId: expenseId, creditAccountId: bankId, amount: 6544, exchangeRate: 1 },
      { debitAccountId: bankId, creditAccountId: expenseId, amount: 4000, exchangeRate: 1 },
    ]

    const summary = summarizeProfitLossEntriesFromLedgerRows(entries, pnlAccounts, false)

    expect(summary.totalExpense).toBe(2544)
    expect(summary.expenseBreakdown).toHaveLength(1)
    expect(summary.expenseBreakdown[0]).toMatchObject({
      accountCode: '620001',
      amount: 2544,
    })
  })

  test('reduces income when debited (reversal)', () => {
    const entries = [
      { debitAccountId: bankId, creditAccountId: incomeId, amount: 500, exchangeRate: 1 },
      { debitAccountId: incomeId, creditAccountId: bankId, amount: 120, exchangeRate: 1 },
    ]

    const summary = summarizeProfitLossEntriesFromLedgerRows(entries, pnlAccounts, false)

    expect(summary.totalIncome).toBe(380)
    expect(summary.incomeBreakdown[0].amount).toBe(380)
  })

  test('totalExpense equals sum of expense breakdown rows', () => {
    const rentId = 'exp-rent'
    const accounts = {
      incomeById: pnlAccounts.incomeById,
      expenseById: new Map([
        [expenseId, { accountCode: '620001', accountName: 'advance payment- payroll' }],
        [rentId, { accountCode: '6000', accountName: 'Rent Expense' }],
      ]),
      incomeIds: pnlAccounts.incomeIds,
      expenseIds: new Set([expenseId, rentId]),
    }
    const entries = [
      { debitAccountId: expenseId, creditAccountId: bankId, amount: 1000, exchangeRate: 1 },
      { debitAccountId: rentId, creditAccountId: bankId, amount: 500, exchangeRate: 1 },
      { debitAccountId: bankId, creditAccountId: expenseId, amount: 200, exchangeRate: 1 },
    ]

    const summary = summarizeProfitLossEntriesFromLedgerRows(entries, accounts, false)
    const breakdownSum = summary.expenseBreakdown.reduce((sum, row) => sum + Number(row.amount || 0), 0)

    expect(summary.totalExpense).toBe(breakdownSum)
    expect(summary.totalExpense).toBe(1300)
  })

  test('omits zero-net expense account when includeZero is false', () => {
    const entries = [
      { debitAccountId: expenseId, creditAccountId: bankId, amount: 4000, exchangeRate: 1 },
      { debitAccountId: bankId, creditAccountId: expenseId, amount: 4000, exchangeRate: 1 },
    ]

    const summary = summarizeProfitLossEntriesFromLedgerRows(entries, pnlAccounts, false)

    expect(summary.totalExpense).toBe(0)
    expect(summary.expenseBreakdown).toHaveLength(0)
  })

  test('includes zero-net expense account when includeZero is true', () => {
    const entries = [
      { debitAccountId: expenseId, creditAccountId: bankId, amount: 4000, exchangeRate: 1 },
      { debitAccountId: bankId, creditAccountId: expenseId, amount: 4000, exchangeRate: 1 },
    ]

    const summary = summarizeProfitLossEntriesFromLedgerRows(entries, pnlAccounts, true)

    expect(summary.totalExpense).toBe(0)
    expect(summary.expenseBreakdown).toHaveLength(1)
    expect(summary.expenseBreakdown[0].amount).toBe(0)
  })
})

describe('buildProfitLossDateQuery', () => {
  test('endDate is inclusive through end of calendar day', () => {
    const query = buildProfitLossDateQuery('2026-06-22', '2026-06-22')

    expect(query.$gte).toEqual(new Date('2026-06-22T00:00:00.000'))
    expect(query.$lte).toEqual(toEndOfDay('2026-06-22'))

    const lateEntry = new Date('2026-06-22T18:30:00.000')
    expect(lateEntry >= query.$gte && lateEntry <= query.$lte).toBe(true)
  })
})
