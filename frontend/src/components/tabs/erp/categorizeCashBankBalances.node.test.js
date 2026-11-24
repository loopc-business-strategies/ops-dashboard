import { describe, expect, test } from 'vitest'
import {
  accountBalanceSections,
  cashBankBalanceGroups,
  categorizeAccountBalances,
  categorizeCashBankBalances,
  collectAccountBalanceRows,
  collectCashBankBalanceRows,
  hasNonZeroBalance,
} from './categorizeCashBankBalances'

describe('categorizeCashBankBalances', () => {
  test('groups bank vs cash vs other by name/code', () => {
    expect(categorizeCashBankBalances([
      { accountCode: '1010', accountName: 'Main Bank Account', balance: 1 },
      { accountCode: '101001', accountName: 'NATIONAL BANK OF UZBEKISTAN-USD', balance: 2 },
      { accountCode: '1000', accountName: 'Cash on Hand', balance: 3 },
      { accountCode: '1020', accountName: 'Petty Cash', balance: 4 },
      { accountCode: '1099', accountName: 'Treasury Float', balance: 5 },
    ])).toEqual({
      bank: [
        { accountCode: '1010', accountName: 'Main Bank Account', balance: 1 },
        { accountCode: '101001', accountName: 'NATIONAL BANK OF UZBEKISTAN-USD', balance: 2 },
      ],
      cash: [
        { accountCode: '1000', accountName: 'Cash on Hand', balance: 3 },
        { accountCode: '1020', accountName: 'Petty Cash', balance: 4 },
      ],
      other: [
        { accountCode: '1099', accountName: 'Treasury Float', balance: 5 },
      ],
    })
  })

  test('prefers allCashBankBalances and dedupes legacy bank+cash lists', () => {
    const all = [{ accountCode: '1010', accountName: 'Main Bank', balance: 10 }]
    expect(collectCashBankBalanceRows({ allCashBankBalances: all })).toEqual(all)
    expect(collectCashBankBalanceRows({
      bankBalances: [
        { accountCode: '1010', accountName: 'Main Bank', balance: 1 },
        { accountCode: '1010', accountName: 'Main Bank', balance: 1 },
      ],
      cashBalances: [{ accountCode: '1000', accountName: 'Cash', balance: 2 }],
    })).toHaveLength(2)
  })

  test('cashBankBalanceGroups uses allCashBankBalances when present', () => {
    const groups = cashBankBalanceGroups({
      allCashBankBalances: [
        { accountCode: '101003', accountName: 'KAPITAL BANK - USD', balance: 0 },
        { accountCode: '100001', accountName: 'cash-soms', balance: 214.31 },
      ],
      bankBalances: [],
      cashBalances: [],
    })
    expect(groups.bank).toHaveLength(1)
    expect(groups.cash).toHaveLength(1)
  })
})

describe('categorizeAccountBalances', () => {
  test('groups by account type and hides zero balances', () => {
    const sections = categorizeAccountBalances([
      { accountCode: '1010', accountName: 'Main Bank', accountType: 'Asset', balance: -209.92 },
      { accountCode: '101003', accountName: 'KAPITAL BANK - USD', accountType: 'Asset', balance: 0 },
      { accountCode: '101004', accountName: 'KAPITAL BANK - SOMS', accountType: 'Asset', balance: -0 },
      { accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', balance: 500 },
      { accountCode: '3000', accountName: 'Owner Equity', accountType: 'Equity', balance: 1000 },
      { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', balance: -50 },
      { accountCode: '6000', accountName: 'Rent Expense', accountType: 'Expense', balance: 80 },
    ], { hideZero: true })

    expect(sections.map((s) => s.label)).toEqual([
      'Assets',
      'Liabilities',
      'Equity',
      'Income',
      'Expenses',
    ])
    expect(sections.find((s) => s.key === 'asset').rows).toHaveLength(1)
    expect(sections.find((s) => s.key === 'asset').rows[0].accountCode).toBe('1010')
    expect(hasNonZeroBalance({ balance: 0 })).toBe(false)
    expect(hasNonZeroBalance({ balance: -0.001 })).toBe(false)
  })

  test('accountBalanceSections prefers allAccountBalances', () => {
    const sections = accountBalanceSections({
      allAccountBalances: [
        { accountCode: '1010', accountName: 'Main Bank', accountType: 'Asset', balance: 10 },
        { accountCode: '2000', accountName: 'AP', accountType: 'Liability', balance: 0 },
      ],
      allCashBankBalances: [
        { accountCode: '9999', accountName: 'Should ignore', accountType: 'Asset', balance: 99 },
      ],
    })
    expect(collectAccountBalanceRows({
      allAccountBalances: [{ accountCode: '1010', accountType: 'Asset', balance: 1 }],
    })).toHaveLength(1)
    expect(sections).toHaveLength(1)
    expect(sections[0].label).toBe('Assets')
    expect(sections[0].rows[0].accountCode).toBe('1010')
  })
})
