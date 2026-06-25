import { describe, expect, test } from 'vitest'
import { buildJvPostingPayloads } from './journalVoucherHelpers.js'

describe('journal voucher batch payloads', () => {
  test('buildJvPostingPayloads produces postings suitable for batch save (no client referenceId)', () => {
    const built = buildJvPostingPayloads({
      entries: [{
        debitAccountId: '507f1f77bcf86cd799439011',
        creditAccountId: '507f1f77bcf86cd799439012',
        amount: 100,
        lineDesc: '',
      }],
      jvHeader: {
        docNo: 'Jv/2026/0041',
        date: '2026-06-24',
        narration: 'courier and travel expense',
        currency: 'USD',
      },
      baseCurrencyCode: 'USD',
      currencies: [],
      jvMode: 'journal',
      jvGroupId: '507f1f77bcf86cd799439099',
    })

    expect(built.error).toBeNull()
    expect(built.payloads).toHaveLength(1)
    const posting = built.payloads[0]
    expect(posting.amount).toBe(100)
    expect(posting.description).toContain('Jv/2026/0041')
    expect(posting.debitAccountId).toBe('507f1f77bcf86cd799439011')
    expect(posting.creditAccountId).toBe('507f1f77bcf86cd799439012')
    expect(posting.referenceType).toBe('journal')
    expect(posting.referenceId).toBe('507f1f77bcf86cd799439099')

    const batchShape = {
      date: posting.date,
      description: posting.description,
      notes: posting.notes,
      currency: posting.currency,
      exchangeRate: posting.exchangeRate,
      debitAccountId: posting.debitAccountId,
      creditAccountId: posting.creditAccountId,
      amount: posting.amount,
    }
    expect(batchShape.referenceId).toBeUndefined()
    expect(batchShape.referenceType).toBeUndefined()
  })
})
