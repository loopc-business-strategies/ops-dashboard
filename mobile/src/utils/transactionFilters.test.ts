import { describe, expect, it } from 'vitest'
import { chipToApiType, apiTypeToLabel } from '@/src/constants/transactionTypes'
import { filterTransactionsByAccount } from './transactionFilters'
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
})
