import { describe, expect, test } from 'vitest'
import {
  cashBankBalanceGroups,
  categorizeCashBankBalances,
  collectCashBankBalanceRows,
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
