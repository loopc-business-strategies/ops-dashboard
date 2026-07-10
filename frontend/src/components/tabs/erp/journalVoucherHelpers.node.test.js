import { describe, expect, test } from 'vitest'
import {
  applyBankJvExchangeBalancing,
  buildJvPostingPayloads,
  buildJvPrintHtml,
  reconstructJvEditLines,
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
