import { describe, expect, test } from 'vitest'
import {
  buildJvDocNo,
  convertJvAmountBetweenCurrencies,
  createJvHeader,
  emptyJvLine,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
} from './journalVoucherHelpers'

describe('journal voucher helpers', () => {
  test('creates stable empty JV line state', () => {
    expect(emptyJvLine(7)).toEqual({
      id: 7,
      accountId: '',
      accountInput: '',
      description: '',
      debit: '',
      credit: '',
    })
  })

  test('resolves unknown JV modes to normal journal metadata', () => {
    expect(resolveJvModeMeta('unknown')).toMatchObject({
      prefix: 'Jv',
      referenceType: 'journal',
    })
  })

  test('builds the next document number from formatted and legacy ledger descriptions', () => {
    const ledger = [
      { referenceType: 'journal', description: 'Jv/2026/0002 — opening entry' },
      { referenceType: 'journal', description: 'Jv-3 — legacy entry' },
      { referenceType: 'bank_jv', description: 'BnkJV/2026/0009 — bank entry' },
      { referenceType: 'journal', description: 'Jv/2025/0099 — previous year' },
    ]

    expect(buildJvDocNo(ledger, 'journal', new Date('2026-05-18T00:00:00.000Z'))).toBe('Jv/2026/0004')
    expect(buildJvDocNo(ledger, 'bank_jv', new Date('2026-05-18T00:00:00.000Z'))).toBe('BnkJV/2026/0010')
  })

  test('creates a header with document number, date, narration, and currency', () => {
    expect(createJvHeader([], 'AED', 'bank_jv', new Date('2026-05-18T10:20:00.000Z'))).toEqual({
      docNo: 'BnkJV/2026/0001',
      date: '2026-05-18',
      narration: '',
      currency: 'AED',
    })
  })

  test('normalizes SOMS aliases to UZS for JV currency conversion', () => {
    const currencies = [
      { code: 'USD', exchangeRate: 1 },
      { code: 'UZS', exchangeRate: 0.000078 },
    ]

    expect(normalizeJvCurrencyCode('SOMS')).toBe('UZS')
    expect(convertJvAmountBetweenCurrencies(100000, 'SOMS', 'USD', currencies, 'USD')).toBe(7.8)
    expect(convertJvAmountBetweenCurrencies(7.8, 'USD', 'SOMS', currencies, 'USD')).toBe(100000)
  })
})
