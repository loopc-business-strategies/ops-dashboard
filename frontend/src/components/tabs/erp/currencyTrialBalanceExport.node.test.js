import { describe, expect, it } from 'vitest'
import { buildCurrencyBalanceSheetModel, buildCurrencyProfitLossModel, buildCurrencyTrialBalanceModel, formatTrialRange } from './currencyTrialBalanceExport'

const rows = [
  { accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', debit: 100, credit: 40, net: 60 },
  { accountCode: '1010', accountName: 'National Bank', accountType: 'Asset', debit: 20, credit: 5, net: 15 },
  { accountCode: '1319', accountName: 'test (Debtor)', accountType: 'Asset', debit: 10, credit: 0, net: 10 },
  { accountCode: '2000', accountName: 'Supplier (Creditor)', accountType: 'Liability', debit: 0, credit: 30, net: -30 },
  { accountCode: '5000', accountName: 'Sales', accountType: 'Income', debit: 0, credit: 80, net: -80 },
  { accountCode: '6000', accountName: 'Rent', accountType: 'Expense', debit: 25, credit: 0, net: 25 },
]

describe('currency trial balance export', () => {
  it('groups accounts and shows the selected currency on amount and net', () => {
    const model = buildCurrencyTrialBalanceModel({
      rows,
      convert: (value) => Number(value || 0) * 100,
      baseCurrency: 'USD',
      displayCurrency: 'UZS',
    })
    const text = model.body.map((row) => row[0])
    expect(model.title).toBe('CURRENCY TRIAL BALANCE (TILL DATE)')
    expect(model.pdfHead[0][4].content).toBe('Amount (UZS)')
    expect(text).toContain('ASSETS')
    expect(text).toContain('CASH BALANCES')
    expect(text).toContain('BANK BALANCES')
    expect(text).toContain('TRADE DEBTOR')
    expect(text).toContain('Sub Total - CASH BALANCES')
    expect(text).toContain('TRADE CREDITOR')
    expect(text).toContain('INCOME')
    expect(text).toContain('EXPENSES')
    expect(text[text.length - 1]).toBe('Gross Total')

    const cash = model.body.find((row) => row[1] === '1000')
    expect(cash[2]).toBe('USD')
    expect(cash[3]).toBe('100.00')
    expect(cash[5]).toBe('10,000.00')
    expect(cash[7]).toBe('6,000.00')

    const total = model.body[model.body.length - 1]
    expect(total[5]).toBe('15,500.00')
    expect(total[6]).toBe('15,500.00')
  })

  it('formats the period like the reference', () => {
    expect(formatTrialRange({ startDate: '2026-01-01', endDate: '2026-10-12' })).toBe('From 01/01/2026 To 12/10/2026')
  })
})

describe('currency profit and loss export', () => {
  it('uses the selected currency and groups expenses', () => {
    const model = buildCurrencyProfitLossModel({
      income: [{ accountCode: '4190', accountName: 'Exchange Gain', amount: 200 }],
      expenses: [
        { accountCode: '6000', accountName: 'Rent Expense', amount: 25 },
        { accountCode: '5192', accountName: 'Bank charges', amount: 10 },
        { accountCode: '6310', accountName: 'Sales Commission', amount: 5 },
        { accountCode: '9000', accountName: 'Food Expenses- staff', amount: 8 },
      ],
      convert: (value) => Number(value || 0) * 100,
      baseCurrency: 'USD',
      displayCurrency: 'UZS',
    })
    const labels = model.body.map((row) => row[0])
    expect(model.title).toBe('CURRENCY PROFIT & LOSS')
    expect(model.pdfHead[0][4].content).toBe('Amount (UZS)')
    expect(labels).toContain('RENT')
    expect(labels).toContain('FINANCIAL EXPENSES')
    expect(labels).toContain('SELLING EXPENSES')
    expect(labels).toContain('ADMINISTRATIVE EXPENSES')
    expect(labels).toContain('Net Profit')
    const gain = model.body.find((row) => row[1] === '4190')
    expect(gain[2]).toBe('USD')
    expect(gain[4]).toBe('200.00')
    expect(gain[6]).toBe('20,000.00')
    const total = model.body[model.body.length - 1]
    expect(total[0]).toBe('Gross Total')
    expect(total[5]).toBe('20,000.00')
    expect(total[6]).toBe('20,000.00')
  })
})

describe('currency balance sheet export', () => {
  it('groups like the reference and converts amount and net', () => {
    const model = buildCurrencyBalanceSheetModel({
      assets: [
        { accountCode: '1000', accountName: 'Cash on Hand', balance: 60, direction: 'Dr', isCurrent: true },
        { accountCode: '1010', accountName: 'National Bank', balance: 15, direction: 'Dr', isCurrent: true },
        { accountCode: '1319', accountName: 'test (Debtor)', balance: 10, direction: 'Dr', isCurrent: true },
        { accountCode: '1200', accountName: 'Gold Stock', balance: 8, direction: 'Dr', isCurrent: true },
        { accountCode: '1500', accountName: 'Machinery', balance: 40, direction: 'Dr', isCurrent: false },
      ],
      liabilities: [
        { accountCode: '2100', accountName: 'VAT Output', balance: 5, direction: 'Cr', isCurrent: true },
        { accountCode: '2300', accountName: 'Supplier (Creditor)', balance: 30, direction: 'Cr', isCurrent: true },
        { accountCode: '2500', accountName: 'Term Loan', balance: 20, direction: 'Cr', isCurrent: false },
      ],
      equity: [
        { accountCode: '3000', accountName: 'Capital', balance: 70, direction: 'Cr', isCurrent: false },
        { accountCode: 'RETAINED', accountName: 'Current Period Earnings', balance: 8, direction: 'Cr', isCurrent: false },
      ],
      convert: (value) => Number(value || 0) * 100,
      baseCurrency: 'USD',
      displayCurrency: 'UZS',
    })
    const labels = model.body.map((row) => row[0])
    expect(model.title).toBe('CURRENCY BALANCE SHEET')
    expect(model.pdfHead[0][4].content).toBe('Amount (UZS)')
    expect(labels).toEqual(expect.arrayContaining([
      'ASSETS',
      'NET CURRENT ASSETS',
      'CURRENT ASSETS',
      'CASH BALANCES',
      'BANK BALANCES',
      'CURRENT ACCOUNTS',
      'TRADE DEBTOR',
      'OTHER CURRENT ASSETS',
      'CURRENT LIABILITIES',
      'VAT ACCOUNTS',
      'TRADE CREDITOR',
      'FIXED ASSETS',
      'TOTAL NET ASSETS',
      'LONG TERM LIABILITIES',
      'EQUITY',
      'Sub Total - FUNDS EMPLOYED',
      'Gross Total',
    ]))
    const cash = model.body.find((row) => row[1] === '1000')
    expect(cash[2]).toBe('USD')
    expect(cash[3]).toBe('60.00')
    expect(cash[5]).toBe('6,000.00')
    expect(cash[7]).toBe('6,000.00')
    const netCurrent = model.body.find((row) => row[0] === 'NET CURRENT ASSETS' && row[7])
    expect(netCurrent[7]).toBe('5,800.00')
    const total = model.body[model.body.length - 1]
    expect(total[5]).toBe('13,300.00')
    expect(total[6]).toBe('13,300.00')
  })
})
