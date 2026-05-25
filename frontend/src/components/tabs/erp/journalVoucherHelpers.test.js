import { describe, expect, test } from 'vitest'
import {
  buildJvDocNo,
  convertJvAmountBetweenCurrencies,
  createJvHeader,
  emptyJvLine,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
  groupJvLedgerEntries,
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

  test('groups multi-line JV ledger postings into one voucher row', () => {
    const sharedRef = '507f1f77bcf86cd799439011'
    const entries = [
      {
        _id: 'a1',
        referenceType: 'bank_jv',
        referenceId: sharedRef,
        date: '2026-05-15',
        description: 'BnkJV/2026/0004 — fx transfer',
        amount: 91.74,
        exchangeRate: 1,
        currency: 'USD',
        debitAccountId: { accountCode: '5190' },
        creditAccountId: { accountCode: '101001' },
      },
      {
        _id: 'a2',
        referenceType: 'bank_jv',
        referenceId: sharedRef,
        date: '2026-05-15',
        description: 'BnkJV/2026/0004 — fx transfer',
        amount: 71488946,
        exchangeRate: 0.000078,
        currency: 'UZS',
        debitAccountId: { accountCode: '101002' },
        creditAccountId: { accountCode: '101001' },
      },
      {
        _id: 'b1',
        referenceType: 'bank_jv',
        referenceId: '507f1f77bcf86cd799439099',
        date: '2026-05-15',
        description: 'BnkJV/2026/0005 — other',
        amount: 10,
        exchangeRate: 1,
        currency: 'USD',
        debitAccountId: { accountCode: '1000' },
        creditAccountId: { accountCode: '101001' },
      },
    ]

    const grouped = groupJvLedgerEntries(entries)
    expect(grouped).toHaveLength(2)
    expect(grouped[0].voucherNo).toBe('BnkJV/2026/0004')
    expect(grouped[0].lineCount).toBe(2)
    expect(grouped[0].debitAccounts).toBe('101002, 5190')
    expect(grouped[0].creditAccounts).toBe('101001')
    expect(grouped[0].entryIds).toEqual(['a1', 'a2'])
  })

  test('groups legacy JV rows without referenceId by doc number and date', () => {
    const entries = [
      {
        _id: 'x1',
        referenceType: 'journal',
        date: '2026-03-01',
        description: 'Jv/2026/0001 — opening',
        amount: 100,
        exchangeRate: 1,
        debitAccountId: { accountCode: '1100' },
        creditAccountId: { accountCode: '2100' },
      },
      {
        _id: 'x2',
        referenceType: 'journal',
        date: '2026-03-01',
        description: 'Jv/2026/0001 — opening',
        amount: 50,
        exchangeRate: 1,
        debitAccountId: { accountCode: '1200' },
        creditAccountId: { accountCode: '2100' },
      },
    ]

    const grouped = groupJvLedgerEntries(entries)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].lineCount).toBe(2)
    expect(grouped[0].voucherNo).toBe('Jv/2026/0001')
  })
})
