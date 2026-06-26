import { describe, expect, test } from 'vitest'
import type { TransactionRow } from '@/src/api/transactions'
import type { GroupedJvVoucher } from '@/src/utils/jvLedgerGrouping'
import {
  buildOperationEntries,
  computeCategorySummaries,
  computeOutcomeIncome,
  filterOperationEntries,
  formatMonthPillLabel,
  groupEntriesByDate,
  MIN_TRANSACTION_MONTH_YEAR,
  monthPresets,
  buildMonthFilterOptions,
  allDatesMonthPreset,
} from '@/src/utils/operationsFeed'
import { operationKeyMatchesCategory, normalizeOperationKey } from '@/src/constants/transactionTypes'

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
      operationKey: 'grp_payment',
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

  test('operationKeyMatchesCategory groups payment receipt and jv types', () => {
    expect(operationKeyMatchesCategory('grp_payment', 'txn_payment')).toBe(true)
    expect(operationKeyMatchesCategory('grp_payment', 'txn_receipt')).toBe(false)
    expect(operationKeyMatchesCategory('grp_receipt', 'txn_receipt')).toBe(true)
    expect(operationKeyMatchesCategory('jv_journal', 'jv_journal')).toBe(true)
    expect(operationKeyMatchesCategory('jv_journal', 'jv_bank')).toBe(false)
    expect(operationKeyMatchesCategory('jv_bank', 'jv_bank')).toBe(true)
    expect(operationKeyMatchesCategory('jv_bank', 'txn_payment')).toBe(false)
    expect(normalizeOperationKey('grp_jv')).toBe('')
    expect(normalizeOperationKey('grp_vouchers')).toBe('')
    expect(operationKeyMatchesCategory('grp_jv', 'jv_journal')).toBe(true)
  })

  test('formatMonthPillLabel shows All for empty range', () => {
    expect(formatMonthPillLabel('', '')).toBe('All')
  })

  test('formatMonthPillLabel shows month name for full month', () => {
    expect(formatMonthPillLabel('2025-03-01', '2025-03-31')).toBe('March 2025')
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
    const start = `${y}-${m}-01`
    const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
    expect(formatMonthPillLabel(start, end)).toBe(
      now.toLocaleDateString(undefined, { month: 'long' }),
    )
  })

  test('monthPresets returns descending months from min year', () => {
    const presets = monthPresets(3)
    expect(presets).toHaveLength(3)
    expect(presets[0].startDate <= presets[1].startDate).toBe(false)
    for (const preset of presets) {
      expect(preset.startDate.slice(0, 4) >= String(MIN_TRANSACTION_MONTH_YEAR)).toBe(true)
    }
  })

  test('monthPresets excludes months before 2026', () => {
    const presets = monthPresets(24)
    expect(presets.every((p) => p.startDate >= '2026-01-01')).toBe(true)
    const now = new Date()
    const expectedCount = now.getMonth() + 1
    expect(presets).toHaveLength(expectedCount)
  })

  test('buildMonthFilterOptions is All then 2026 months without duplicates', () => {
    const options = buildMonthFilterOptions()
    expect(options[0]).toEqual(allDatesMonthPreset())
    expect(options[0].label).toBe('All')
    const months = options.slice(1)
    expect(months.every((p) => p.startDate >= '2026-01-01')).toBe(true)
    const keys = months.map((p) => `${p.startDate}-${p.endDate}`)
    expect(new Set(keys).size).toBe(keys.length)
    const now = new Date()
    expect(months).toHaveLength(now.getMonth() + 1)
  })
})
