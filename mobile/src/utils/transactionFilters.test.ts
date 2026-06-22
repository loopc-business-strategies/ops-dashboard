import { describe, expect, it } from 'vitest'
import { chipToApiType, apiTypeToLabel } from '@/src/constants/transactionTypes'
import { filterTransactionsByAccount, sortTransactions } from './transactionFilters'
import type { TransactionRow } from '@/src/api/transactions'

const tx = (overrides: Partial<TransactionRow> = {}): TransactionRow => ({
  _id: '1',
  amount: 100,
  date: '2026-01-15',
  ...overrides,
})

describe('transactionFilters', () => {
  it('chipToApiType maps salesInvoice to sale', () => {
    expect(chipToApiType('salesInvoice')).toBe('sale')
    expect(chipToApiType('')).toBeUndefined()
    expect(chipToApiType('payment')).toBe('payment')
  })

  it('apiTypeToLabel maps sale to salesInvoice', () => {
    expect(apiTypeToLabel('sale')).toBe('salesInvoice')
    expect(apiTypeToLabel('unknown_type')).toBe('unknown_type')
  })

  it('filterTransactionsByAccount matches debit or credit account code', () => {
    const rows = [
      tx({ debitAccountId: { accountCode: '1000' }, creditAccountId: { accountCode: '2000' } }),
      tx({ debitAccountId: { accountCode: '3000' }, creditAccountId: { accountCode: '4000' } }),
    ]
    expect(filterTransactionsByAccount(rows, '2000')).toHaveLength(1)
    expect(filterTransactionsByAccount(rows, '3000')).toHaveLength(1)
    expect(filterTransactionsByAccount(rows, '')).toHaveLength(2)
  })

  it('sortTransactions orders by date and amount', () => {
    const rows = [
      tx({ _id: 'a', date: '2026-01-01', amount: 50 }),
      tx({ _id: 'b', date: '2026-02-01', amount: 200 }),
      tx({ _id: 'c', date: '2026-01-15', amount: 150 }),
    ]
    expect(sortTransactions(rows, 'date_desc').map((r) => r._id)).toEqual(['b', 'c', 'a'])
    expect(sortTransactions(rows, 'amount_desc').map((r) => r._id)).toEqual(['b', 'c', 'a'])
  })
})
