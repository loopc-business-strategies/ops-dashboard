import { describe, expect, test } from 'vitest'
import { buildLedgerJvListExportData } from './ledgerJvListExportHelpers'

describe('ledgerJvListExportHelpers', () => {
  test('builds Normal JV export rows and xlsx payload', () => {
    const result = buildLedgerJvListExportData({
      ledgerVoucherTab: 'journal',
      baseCurrencyCode: 'USD',
      vouchers: [{
        date: '2026-11-24',
        voucherNo: 'Jv/2026/0226',
        narration: 'SIM Card Payment For Office',
        debitAccounts: '6130',
        creditAccounts: '1302',
        totalBaseAmount: 15.95,
        referenceType: 'journal',
        lineCount: 1,
      }],
    })

    expect(result.title).toBe('Normal JV - List')
    expect(result.sheetName).toBe('Normal JV')
    expect(result.fileBase).toMatch(/^normal-jv-list-\d{4}-\d{2}-\d{2}$/)
    expect(result.head).toEqual([
      'Date',
      'Voucher No.',
      'Narration / Detail',
      'Debit Account',
      'Credit Account',
      'Amount',
      'Type',
    ])
    expect(result.rowCount).toBe(1)
    expect(result.body[0][1]).toBe('Jv/2026/0226')
    expect(result.body[0][2]).toBe('SIM Card Payment For Office')
    expect(result.body[0][5]).toContain('15.95')
    expect(result.body[0][6]).toBe('Normal JV')
    expect(result.xlsxRows[4]).toEqual(result.head)
    expect(result.xlsxRows[5]).toEqual(result.body[0])
  })

  test('builds Bank JV export rows with FC amount and cheque metadata', () => {
    const result = buildLedgerJvListExportData({
      ledgerVoucherTab: 'bank_jv',
      baseCurrencyCode: 'USD',
      vouchers: [{
        date: '2026-11-25',
        voucherNo: 'BnkJV/2026/0010',
        narration: 'Bank transfer',
        debitAccounts: '101001',
        creditAccounts: '101002',
        totalBaseAmount: 100,
        documentFaceAmount: 1250000,
        documentCurrencyCode: 'UZS',
        referenceType: 'bank_jv',
        lineCount: 2,
        autoTxNo: 'TX-99',
        chequeNo: 'CHQ-1',
      }],
    })

    expect(result.title).toBe('Bank JV - List')
    expect(result.sheetName).toBe('Bank JV')
    expect(result.fileBase).toMatch(/^bank-jv-list-\d{4}-\d{2}-\d{2}$/)
    expect(result.body[0][5]).toContain('UZS')
    expect(result.body[0][5]).toContain('USD')
    expect(result.body[0][6]).toContain('Bank JV')
    expect(result.body[0][6]).toContain('2 lines')
    expect(result.body[0][6]).toContain('Chq: CHQ-1')
  })
})
