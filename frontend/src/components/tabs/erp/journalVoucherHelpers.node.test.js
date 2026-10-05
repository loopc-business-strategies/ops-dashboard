import { describe, expect, test } from 'vitest'
import {
  allocateJvLedgerEntries,
  applyBankJvExchangeBalancing,
  buildJvPostingPayloads,
  buildJvPrintHtml,
  convertJvAmountBetweenCurrencies,
  inferLegacyJvBatchDisplayFc,
  normalizeJvCurrencyCode,
  reconstructJvEditLines,
  validateJvLines,
} from './journalVoucherHelpers.js'

describe('journalVoucherHelpers (node)', () => {
  const usdAccount = (code, id = code) => ({
    _id: id,
    accountCode: code,
    accountName: `Account ${code}`,
  })

  test('applyBankJvExchangeBalancing is a no-op for non-bank_jv', () => {
    const lines = [{ id: 1, accountId: 'a', debit: '10', credit: '' }]
    const out = applyBankJvExchangeBalancing(lines, { jvMode: 'journal', entryAccountOptions: [] })
    expect(out).toBe(lines)
  })

  test('applyBankJvExchangeBalancing posts FX loss (5190 debit) when base credits exceed debits', () => {
    const entryAccountOptions = [usdAccount('101001', 'bank1'), usdAccount('101002', 'bank2'), usdAccount('5190', 'loss1')]
    const lines = [
      { id: 1, accountId: 'bank1', accountInput: '', description: '', debit: '98', credit: '', autoFx: false },
      { id: 2, accountId: 'bank2', accountInput: '', description: '', debit: '', credit: '100', autoFx: false },
      { id: 3, accountId: 'loss1', accountInput: '', description: '', debit: '', credit: '', autoFx: true },
    ]
    const ctx = {
      jvMode: 'bank_jv',
      entryAccountOptions,
      baseCurrencyCode: 'USD',
      convertJvAmount: (amt) => amt,
      inferJvAccountCurrency: () => 'USD',
      accountLookupText: (a) => `${a.accountCode} - ${a.accountName}`,
    }
    const out = applyBankJvExchangeBalancing(lines, ctx)
    const lossLine = out.find((l) => l.accountId === 'loss1')
    expect(lossLine).toBeTruthy()
    expect(Number(lossLine.debit || 0)).toBeCloseTo(2, 5)
    expect(lossLine.credit).toBe('')
  })

  test('buildJvPostingPayloads uses journal referenceType by default', () => {
    const { error, payloads } = buildJvPostingPayloads({
      entries: [{ debitAccountId: 'a', creditAccountId: 'b', amount: 50, lineDesc: 'x' }],
      jvHeader: { docNo: 'Jv/2026/0001', date: '2026-05-26', narration: 'n', currency: 'USD' },
      baseCurrencyCode: 'USD',
      currencies: [],
      jvMode: 'journal',
      jvGroupId: '507f1f77bcf86cd799439011',
    })
    expect(error).toBeNull()
    expect(payloads).toHaveLength(1)
    expect(payloads[0].referenceType).toBe('journal')
    expect(payloads[0].amount).toBe(50)
  })

  test('reconstructJvEditLines aggregates same-account debits', () => {
    const editableEntries = [
      {
        amount: 10,
        currency: 'USD',
        date: '2026-05-26',
        debitAccountId: { _id: 'acc1', accountCode: '1000', accountName: 'Cash' },
        creditAccountId: null,
      },
      {
        amount: 5,
        currency: 'USD',
        debitAccountId: { _id: 'acc1', accountCode: '1000', accountName: 'Cash' },
        creditAccountId: null,
      },
    ]
    const r = reconstructJvEditLines(editableEntries, {
      _id: 'e1',
      referenceType: 'journal',
      description: 'Jv/2026/0001 — hi',
      date: '2026-05-26',
    }, {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amt) => amt,
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    })
    expect(r.lines.filter((l) => l.accountId === 'acc1' && l.debit)).toHaveLength(1)
    expect(r.lines.find((l) => l.accountId === 'acc1').debit).toBe(15)
  })

  describe('USD bank JV with a UZS bank leg', () => {
    const currencies = [
      { code: 'USD', baseCurrency: true, exchangeRate: 1 },
      { code: 'UZS', exchangeRate: 1 / 12100 },
    ]
    const coa = {
      usdBank: { _id: 'usdBank', accountCode: '101001', accountName: 'Bank USD', currency: 'USD' },
      uzsBank: { _id: 'uzsBank', accountCode: '101002', accountName: 'Bank UZS', currency: 'UZS' },
      fxLoss: { _id: 'fxLoss', accountCode: '5190', accountName: 'Exchange loss', currency: '' },
    }
    const convertJvAmount = (amt, from, to) => convertJvAmountBetweenCurrencies(amt, from, to, currencies, 'USD')
    const inferJvAccountCurrency = (id) => normalizeJvCurrencyCode(coa[id]?.currency || '') || 'USD'
    const stored = [
      {
        _id: 'e1', referenceType: 'bank_jv', amount: 3201.27, currency: 'USD', exchangeRate: 1,
        date: '2026-10-05', createdAt: '2026-10-05T10:00:00Z', description: 'BnkJV/2026/0099 — conv',
        debitAccountId: coa.uzsBank, creditAccountId: coa.usdBank,
      },
      {
        _id: 'e2', referenceType: 'bank_jv', amount: 98.73, currency: 'USD', exchangeRate: 1,
        date: '2026-10-05', createdAt: '2026-10-05T10:00:01Z', description: 'BnkJV/2026/0099 — conv',
        debitAccountId: coa.fxLoss, creditAccountId: coa.usdBank,
      },
    ]

    test('is not relabelled as soms in the list', () => {
      expect(inferLegacyJvBatchDisplayFc(stored, 'USD')).toBeNull()
    })

    test('reopens with a USD header and balanced totals', () => {
      const r = reconstructJvEditLines(stored, stored[0], {
        baseCurrencyCode: 'USD',
        convertJvAmount,
        inferJvAccountCurrency,
        inferLegacyJvBatchDisplayFc,
      })
      expect(r.headerCurrency).toBe('USD')
      const v = validateJvLines({
        lines: r.lines,
        jvMode: 'bank_jv',
        jvHeader: { currency: r.headerCurrency },
        baseCurrencyCode: 'USD',
        inferJvAccountCurrency,
        convertJvAmount,
      })
      expect(v.isBalanced).toBe(true)
      expect(v.totalCredit).toBeCloseTo(3300, 2)
    })

    test('reopens a soms bank JV with one USD bank row and the saved soms amounts', () => {
      const uzsRows = [
        { ...stored[0], amount: 38735400, currency: 'UZS', exchangeRate: 1 / 12100 },
        { ...stored[1], amount: 1194600, currency: 'UZS', exchangeRate: 1 / 12100 },
      ]
      const r = reconstructJvEditLines(uzsRows, uzsRows[0], {
        baseCurrencyCode: 'USD',
        convertJvAmount,
        inferJvAccountCurrency,
        inferLegacyJvBatchDisplayFc,
      })
      expect(r.headerCurrency).toBe('UZS')
      expect(r.lines.map((l) => [l.accountId, l.debit || 0, l.credit || 0])).toEqual([
        ['uzsBank', 38735400, 0],
        ['usdBank', 0, 39930000],
        ['fxLoss', 1194600, 0],
      ])
      expect(r.jvEditEntryIds).toEqual(['e1', 'e2'])

      const v = validateJvLines({
        lines: r.lines,
        jvMode: 'bank_jv',
        jvHeader: { currency: 'UZS' },
        baseCurrencyCode: 'USD',
        inferJvAccountCurrency,
        convertJvAmount,
      })
      expect(v.isBalanced).toBe(true)
      const resaved = allocateJvLedgerEntries(v.activeLines, {
        jvLines: r.lines,
        useRawJvLineAmountsForSave: v.useRawJvLineAmountsForSave,
        amountCurrencyCode: 'UZS',
      })
      expect(resaved.entries.map((e) => [e.debitAccountId, e.creditAccountId, e.amount])).toEqual([
        ['uzsBank', 'usdBank', 38735400],
        ['fxLoss', 'usdBank', 1194600],
      ])
    })

    test('reopens a mixed UZS/USD bank JV with a USD header and balanced totals', () => {
      const mixedRows = [
        { ...stored[0], amount: 71489946, currency: 'UZS', exchangeRate: 1 / 12100 },
        { ...stored[1], amount: 91.74, currency: 'USD', exchangeRate: 1 },
      ]
      const r = reconstructJvEditLines(mixedRows, mixedRows[0], {
        baseCurrencyCode: 'USD',
        convertJvAmount,
        inferJvAccountCurrency,
        inferLegacyJvBatchDisplayFc,
      })
      expect(r.headerCurrency).toBe('USD')
      const v = validateJvLines({
        lines: r.lines,
        jvMode: 'bank_jv',
        jvHeader: { currency: r.headerCurrency },
        baseCurrencyCode: 'USD',
        inferJvAccountCurrency,
        convertJvAmount,
      })
      expect(v.isBalanced).toBe(true)
      expect(v.totalCredit).toBeCloseTo(6000, 2)
    })

    test('legacy journal rows still infer soms from the COA leg', () => {
      const journalRows = stored.map((e) => ({ ...e, referenceType: 'journal' }))
      expect(inferLegacyJvBatchDisplayFc(journalRows, 'USD')).toBe('UZS')
    })
  })

  test('buildJvPrintHtml includes colgroup for balanced debit and credit columns', () => {
    const html = buildJvPrintHtml({
      validation: { activeLines: [{ accountId: 'a1', debit: '1,250.75', credit: '' }], totalDebit: 1250.75, totalCredit: 0 },
      jvLines: [],
      jvHeader: { docNo: 'Jv/2026/0001', date: '2026-05-26', currency: 'USD' },
      branding: { companyName: 'LoopC' },
      getJvAccountById: () => ({ accountCode: '1000', accountName: 'Cash' }),
    })
    expect(html).toContain('<colgroup>')
    expect(html).toContain('width:18%')
    expect(html).toContain('class="num">Debit</th>')
  })
})
