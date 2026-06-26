import { describe, expect, test } from 'vitest'
import type { LedgerEntryRow } from '@/src/api/ledger'
import { groupJvLedgerEntries, jvLedgerGroupKey } from '@/src/utils/jvLedgerGrouping'

function line(overrides: Partial<LedgerEntryRow> & { _id: string }): LedgerEntryRow {
  return {
    date: '2026-06-15',
    amount: 100,
    currency: 'USD',
    exchangeRate: 1,
    referenceType: 'journal',
    description: 'Jv/2026/0001 — Test narration',
    debitAccountId: { accountCode: '1000', accountName: 'Cash' },
    creditAccountId: { accountCode: '2000', accountName: 'Payable' },
    ...overrides,
  }
}

describe('jvLedgerGroupKey', () => {
  test('groups by referenceId when valid ObjectId', () => {
    const entry = line({ _id: 'a', referenceId: '507f1f77bcf86cd799439011' })
    expect(jvLedgerGroupKey(entry)).toBe('ref:507f1f77bcf86cd799439011')
  })

  test('groups by doc no and date when no referenceId', () => {
    const entry = line({ _id: 'b', referenceId: '', description: 'Jv/2026/0042 — Foo' })
    expect(jvLedgerGroupKey(entry)).toBe('doc:Jv/2026/0042:2026-06-15')
  })
})

describe('groupJvLedgerEntries', () => {
  test('collapses multi-line JV batch into one voucher', () => {
    const refId = '507f1f77bcf86cd799439011'
    const entries = [
      line({ _id: '1', referenceId: refId, amount: 50 }),
      line({ _id: '2', referenceId: refId, amount: 50, description: 'Jv/2026/0001 — Line 2' }),
    ]
    const grouped = groupJvLedgerEntries(entries, { baseCurrencyCode: 'USD' })
    expect(grouped).toHaveLength(1)
    expect(grouped[0].lineCount).toBe(2)
    expect(grouped[0].voucherNo).toBe('Jv/2026/0001')
    expect(grouped[0].totalBaseAmount).toBe(100)
  })

  test('excludes system FX adjustment journal rows', () => {
    const entries = [
      line({
        _id: 'fx',
        description: 'Exchange gain adjustment for transaction abc',
      }),
    ]
    expect(groupJvLedgerEntries(entries)).toHaveLength(0)
  })

  test('bank_jv uses autoTxNo when doc no missing', () => {
    const entries = [
      line({
        _id: 'b1',
        referenceType: 'bank_jv',
        description: 'Payment',
        autoTxNo: 'BJV-20260615-001',
      }),
    ]
    const grouped = groupJvLedgerEntries(entries)
    expect(grouped[0].voucherNo).toBe('BJV-20260615-001')
  })
})
