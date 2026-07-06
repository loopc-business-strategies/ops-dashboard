import { describe, expect, it } from 'vitest'
import {
  buildExpensePdfFileName,
  buildExpensePdfMeta,
  buildExpensesPdfTableBody,
  formatPdfAccountRoute,
  formatPdfLedgerCell,
} from './expenseExportHelpers'

describe('formatPdfAccountRoute', () => {
  it('splits paymentRoute at arrow into two lines', () => {
    const route = 'Bank Account Director (111100) → Gpay/Paytm (55500)'
    expect(formatPdfAccountRoute({ paymentRoute: route })).toBe(
      'Bank Account Director (111100)\n-> Gpay/Paytm (55500)',
    )
  })

  it('builds fallback route from funding and expense accounts', () => {
    expect(formatPdfAccountRoute({
      fundingAccount: 'HSBC Current (1010)',
      expenseAccount: 'Operating Expenses (6100)',
    })).toBe('HSBC Current (1010)\n-> Operating Expenses (6100)')
  })
})

describe('formatPdfLedgerCell', () => {
  it('includes reference type and ledger ref on separate lines', () => {
    expect(formatPdfLedgerCell({
      referenceType: 'bank_jv',
      ledgerRef: 'JV-2026/0006',
    })).toBe('Bank_jv\nJV-2026/0006')
  })

  it('returns capitalized reference type when ledger ref is missing', () => {
    expect(formatPdfLedgerCell({ referenceType: 'journal' })).toBe('Journal')
  })
})

describe('buildExpensesPdfTableBody', () => {
  it('maps register rows to PDF table columns', () => {
    const body = buildExpensesPdfTableBody([{
      date: '2026-07-01T00:00:00.000Z',
      category: 'Travel',
      description: 'Client lunch',
      amount: 120.5,
      paymentMethod: 'Bank',
      paymentRoute: 'HSBC (1010) → Travel (6200)',
      referenceType: 'journal',
      ledgerRef: 'JV-100',
    }])
    expect(body).toHaveLength(1)
    expect(body[0][1]).toBe('Travel')
    expect(body[0][3]).toBe('$120.50')
    expect(body[0][5]).toBe('HSBC (1010)\n-> Travel (6200)')
    expect(body[0][6]).toBe('Journal\nJV-100')
  })
})

describe('buildExpensePdfMeta', () => {
  it('includes active filter labels', () => {
    const meta = buildExpensePdfMeta({
      year: 2026,
      monthIndex: '6',
      filters: {
        startDate: '2026-07-01',
        endDate: '2026-07-06',
        paymentSource: 'bank',
        category: 'Travel',
      },
      total: 5,
      exportedCount: 5,
      totalAmount: 500,
    })
    expect(meta.title).toBe('Expense Report')
    expect(meta.lines.some((line) => line.includes('July'))).toBe(true)
    expect(meta.lines.some((line) => line.includes('Bank'))).toBe(true)
    expect(meta.lines.some((line) => line.includes('Travel'))).toBe(true)
    expect(meta.lines.some((line) => line.includes('2026-07-01'))).toBe(true)
  })
})

describe('buildExpensePdfFileName', () => {
  it('builds a pdf filename with year and month', () => {
    const name = buildExpensePdfFileName({ year: 2026, monthIndex: '6' })
    expect(name).toMatch(/^expenses-report-2026-july-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
