import { describe, expect, test } from 'vitest'
import { buildStatementExportModel } from './statementExportModel'

const baseCtx = {
  accountEnquiryData: {
    account: {
      accountCode: '101001',
      accountName: 'NATIONAL BANK OF UZBEKISTAN-USD',
      address: '',
    },
    balances: { netBalance: 1250.75 },
    metals: { goldBalance: 0, silverBalance: 0 },
  },
  filteredStatementEntries: [
    {
      _id: 'e1',
      date: '2026-03-24T12:00:00',
      description: 'Перевод средств на расчётный счёт поставщика по договору поставки металла',
      debitAmount: 0,
      creditAmount: 1200,
      metalSignedWeight: 0,
      referenceType: 'bank_jv',
    },
  ],
  resolveStatementReceiptNo: () => 'BnkJV/2026/0002',
  statementSelectedMetalCode: 'XAU',
  resolvePreferredStatementMetalCode: () => 'XAU',
  statementDisplayCurrency: 'USD',
  rawStatementEntries: [],
  formatStatementDate: (value) => String(value || ''),
  convertStatementDisplayAmount: (value) => Number(value || 0),
  tenantBranding: { key: 'mg', displayName: 'MG' },
  user: { name: 'Nan', company: 'mg' },
  branding: {
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
    address: 'Namangan',
  },
  defaultBranding: { companyName: 'LoopC', logoWidth: 120, logoHeight: 90 },
  statementFilters: { startDate: '2026-02-20', endDate: '2026-07-20' },
}

describe('buildStatementExportModel', () => {
  test('keeps long Doc No and Cyrillic narration in separate cells', () => {
    const model = buildStatementExportModel(baseCtx)
    expect(model).toBeTruthy()
    const entry = model.tableRows.find((row) => row.kind === 'entry')
    expect(entry.cells[0]).toBe('BnkJV/2026/0002')
    expect(entry.cells[1]).toMatch(/24-Mar-26/)
    expect(entry.cells[2]).toContain('Перевод средств')
    expect(entry.cells[0]).not.toContain('Mar')
    expect(entry.cells[1]).not.toContain('BnkJV')
  })

  test('includes opening and closing balance rows with Dr/Cr spacing', () => {
    const model = buildStatementExportModel(baseCtx)
    const opening = model.tableRows.find((row) => row.kind === 'opening')
    const closing = model.tableRows.find((row) => row.kind === 'closing')
    expect(opening.cells[2]).toBe('Balance B/F')
    expect(closing.cells[2]).toBe('Balance C/F')
    expect(opening.cells[5]).toMatch(/\d[\d,]*\.\d{2} Dr|\d[\d,]*\.\d{2} Cr/)
    expect(closing.cells[5]).toContain('1,250.75 Dr')
  })

  test('uses newest entry runningBalance as closing when present', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      accountEnquiryData: {
        ...baseCtx.accountEnquiryData,
        balances: { netBalance: 9999 },
      },
      filteredStatementEntries: [
        {
          _id: 'e-old',
          date: '2026-02-01T12:00:00',
          description: 'Older',
          debitAmount: 100,
          creditAmount: 0,
          metalSignedWeight: 0,
          referenceType: 'payment',
          runningBalance: 900,
        },
        {
          _id: 'e-new',
          date: '2026-07-01T12:00:00',
          description: 'Newer',
          debitAmount: 0,
          creditAmount: 50,
          metalSignedWeight: 0,
          referenceType: 'payment',
          runningBalance: 850,
        },
      ],
      statementFilters: { startDate: '2026-02-01', endDate: '2026-07-31' },
    })
    const closing = model.tableRows.find((row) => row.kind === 'closing')
    expect(closing.cells[5]).toContain('850.00 Dr')
    const opening = model.tableRows.find((row) => row.kind === 'opening')
    // closing 850 - (-50 + 100) signed = 850 - 50 = 800
    expect(opening.cells[5]).toContain('800.00 Dr')
  })

  test('builds autoTable head with currency and metal group labels', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      statementDisplayCurrency: 'UZS',
      statementSelectedMetalCode: 'XAU',
    })
    expect(model.head[0][3]).toEqual({ content: 'Amount (UZS)', colSpan: 3 })
    expect(model.head[0][4]).toEqual({ content: 'XAU(GMS)', colSpan: 3 })
    expect(model.head[1]).toEqual(['Debit', 'Credit', 'Balance', 'Debit', 'Credit', 'Balance'])
    expect(model.body[0]).toEqual(model.tableRows[0].cells)
  })

  test('returns null without account enquiry data', () => {
    expect(buildStatementExportModel({ ...baseCtx, accountEnquiryData: null })).toBeNull()
  })

  test('strips JV doc numbers and uses notes when description is only a voucher no', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      filteredStatementEntries: [{
        _id: 'jv1',
        date: '2026-05-26T12:00:00',
        description: 'Jv/2026/0001',
        notes: 'Month-end bank transfer',
        debitAmount: 100,
        creditAmount: 0,
        metalSignedWeight: 0,
        referenceType: 'journal',
        offsetAccountCode: '71011',
        offsetAccountName: 'Bank charges',
      }],
      resolveStatementReceiptNo: () => 'Jv/2026/0001',
    })
    const entry = model.tableRows.find((row) => row.kind === 'entry')
    expect(entry.cells[0]).toBe('Jv/2026/0001')
    expect(entry.cells[2]).toBe('Month-end bank transfer')
    expect(entry.cells[2]).not.toContain('Jv/2026/0001')
  })

  test('uses payment line narration instead of payment voucher Pay/number', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      filteredStatementEntries: [{
        _id: 'pay1',
        date: '2026-03-18T12:00:00',
        description: 'payment voucher Pay/2026/0002',
        lineNarration: 'advance payment for purchase of machines from mumbai',
        debitAmount: 23000,
        creditAmount: 0,
        metalSignedWeight: 0,
        referenceType: 'payment',
        sourceTransactionNumber: 'Pay/2026/0002',
      }],
      resolveStatementReceiptNo: () => 'Pay/2026/0002',
    })
    const entry = model.tableRows.find((row) => row.kind === 'entry')
    expect(entry.cells[0]).toBe('Pay/2026/0002')
    expect(entry.cells[2]).toBe('advance payment for purchase of machines from mumbai')
    expect(entry.cells[2]).not.toMatch(/Pay\/2026\/0002/i)
  })

  test('keeps Bank JV text after an em-dash and drops the repeated doc no', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      filteredStatementEntries: [{
        _id: 'bnk1',
        date: '2026-03-24T12:00:00',
        description: 'BnkJV/2026/0002 — 71011 Свободная покупка у юр лиц',
        debitAmount: 0,
        creditAmount: 1200,
        metalSignedWeight: 0,
        referenceType: 'bank_jv',
        sourceTransactionNumber: 'BnkJV/2026/0002',
      }],
      resolveStatementReceiptNo: () => 'BnkJV/2026/0002',
    })
    const entry = model.tableRows.find((row) => row.kind === 'entry')
    expect(entry.cells[0]).toBe('BnkJV/2026/0002')
    expect(entry.cells[2]).toBe('71011 Свободная покупка у юр лиц')
    expect(entry.cells[2]).not.toContain('BnkJV/2026/0002')
  })

  test('falls back to offset account when narration is only a voucher number', () => {
    const model = buildStatementExportModel({
      ...baseCtx,
      filteredStatementEntries: [{
        _id: 'empty1',
        date: '2026-02-23T12:00:00',
        description: 'BnkJV/2026/0001',
        debitAmount: 50,
        creditAmount: 0,
        metalSignedWeight: 0,
        referenceType: 'bank_jv',
        offsetAccountCode: '101001',
        offsetAccountName: 'NATIONAL BANK OF UZBEKISTAN-USD',
      }],
      resolveStatementReceiptNo: () => 'BnkJV/2026/0001',
    })
    const entry = model.tableRows.find((row) => row.kind === 'entry')
    expect(entry.cells[2]).toBe('101001 NATIONAL BANK OF UZBEKISTAN-USD')
    expect(entry.cells[2]).not.toBe('BnkJV/2026/0001')
  })
})
