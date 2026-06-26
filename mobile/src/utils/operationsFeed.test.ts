import { describe, expect, test } from 'vitest'
import type { TransactionRow } from '@/src/api/transactions'
import type { GroupedJvVoucher } from '@/src/utils/jvLedgerGrouping'
import {
  buildOperationEntries,
  computeCategorySummaries,
  computeOutcomeIncome,
  filterOperationEntries,
  groupEntriesByDate,
} from '@/src/utils/operationsFeed'

function tx(overrides: Partial<TransactionRow> & { _id: string }): TransactionRow {
  return {
    type: 'payment',
    status: 'posted',
    date: '2026-06-20',
    amount: 1000,
    currency: 'UZS',
    customerId: { name: 'ACME' },
    ...overrides,
  }
}

function jv(overrides: Partial<GroupedJvVoucher> & { key: string }): GroupedJvVoucher {
  return {
    entries: [],
    representative: { _id: 'l1', referenceType: 'journal' },
    entryIds: ['l1'],
    lineCount: 1,
    voucherNo: 'Jv/2026/0001',
    date: '2026-06-18',
    referenceType: 'journal',
    narration: 'Office supplies',
    debitAccounts: '1000',
    creditAccounts: '5000',
    totalBaseAmount: 500,
    documentCurrencyCode: '',
    documentFaceAmount: null,
    attachmentUrl: '',
    autoTxNo: '',
    chequeNo: '',
    ...overrides,
  }
}

describe('operationsFeed', () => {
  test('buildOperationEntries merges and sorts by date desc', () => {
    const entries = buildOperationEntries(
      [tx({ _id: 't1', date: '2026-06-10' }), tx({ _id: 't2', date: '2026-06-25', type: 'receipt', amount: 200 })],
      [jv({ key: 'j1', date: '2026-06-20' })],
      'UZS',
    )
    expect(entries).toHaveLength(3)
    expect(entries[0].id).toBe('t2')
    expect(entries[1].id).toBe('j1')
  })

  test('computeOutcomeIncome splits payment vs receipt', () => {
    const entries = buildOperationEntries(
      [
        tx({ _id: 't1', type: 'payment', amount: 1000 }),
        tx({ _id: 't2', type: 'receipt', amount: 300 }),
      ],
      [jv({ key: 'j1', totalBaseAmount: 500 })],
      'UZS',
    )
    const totals = computeOutcomeIncome(entries)
    expect(totals.outcome).toBe(1500)
    expect(totals.income).toBe(300)
  })

  test('filterOperationEntries by operation key and account', () => {
    const entries = buildOperationEntries(
      [
        tx({
          _id: 't1',
          debitAccountId: { accountCode: '1111' },
          creditAccountId: { accountCode: '2222' },
        }),
        tx({ _id: 't2', type: 'receipt' }),
      ],
      [jv({ key: 'j1' })],
      'UZS',
    )
    const filtered = filterOperationEntries(entries, {
      search: '',
      status: '',
      operationKey: 'txn_payment',
      startDate: '',
      endDate: '',
      accountCode: '1111',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].kind).toBe('transaction')
  })

  test('computeCategorySummaries aggregates by type', () => {
    const entries = buildOperationEntries(
      [tx({ _id: 't1' }), tx({ _id: 't2' })],
      [jv({ key: 'j1' })],
      'UZS',
    )
    const cats = computeCategorySummaries(entries)
    expect(cats.find((c) => c.categoryKey === 'txn_payment')?.count).toBe(2)
    expect(cats.find((c) => c.categoryKey === 'jv_journal')?.count).toBe(1)
  })

  test('groupEntriesByDate produces section headers', () => {
    const entries = buildOperationEntries(
      [tx({ _id: 't1', date: '2026-06-20' }), tx({ _id: 't2', date: '2026-06-18' })],
      [],
      'UZS',
    )
    const sections = groupEntriesByDate(entries)
    expect(sections).toHaveLength(2)
    expect(sections[0].dateKey).toBe('2026-06-20')
  })
})
