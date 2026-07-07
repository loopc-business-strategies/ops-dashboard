import { describe, expect, it } from 'vitest'
import { isReportPdfDownloadEnabled } from '../../../config/tenantBranding'
import {
  buildReportExportPayload,
  buildReportPdfMeta,
  buildReportPdfTable,
  formatReportPeriodText,
  getReportNotReadyMessage,
  isReportDataReady,
} from './reportExportHelpers'

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`

describe('isReportPdfDownloadEnabled', () => {
  it('is enabled for loopc only in phase 1', () => {
    expect(isReportPdfDownloadEnabled('loopc')).toBe(true)
    expect(isReportPdfDownloadEnabled('mg')).toBe(false)
    expect(isReportPdfDownloadEnabled('cg')).toBe(false)
  })
})

describe('isReportDataReady', () => {
  it('checks the active report dataset per view', () => {
    const reports = {
      trialBalance: { trialBalance: [] },
      profitLoss: { incomeBreakdown: [] },
      balanceSheet: { assets: [] },
      dayBook: { entries: [] },
      customerOutstanding: { rows: [] },
      vendorOutstanding: { rows: [] },
      forex: { byCurrency: {} },
    }

    expect(isReportDataReady('trial', reports, [])).toBe(true)
    expect(isReportDataReady('pnl', reports, [])).toBe(true)
    expect(isReportDataReady('balanceSheet', reports, [])).toBe(true)
    expect(isReportDataReady('dayBook', reports, [])).toBe(true)
    expect(isReportDataReady('outstanding', reports, [])).toBe(true)
    expect(isReportDataReady('forex', reports, [])).toBe(true)
    expect(isReportDataReady('ledger', reports, [{ entryId: '1' }])).toBe(true)

    expect(isReportDataReady('pnl', { trialBalance: reports.trialBalance }, [])).toBe(false)
    expect(isReportDataReady('ledger', reports, [])).toBe(false)
  })
})

describe('getReportNotReadyMessage', () => {
  it('names the active report view in the error', () => {
    expect(getReportNotReadyMessage('pnl', 'downloading')).toContain('Profit & Loss')
    expect(getReportNotReadyMessage('trial', 'printing')).toContain('Trial Balance')
  })
})

describe('formatReportPeriodText', () => {
  it('uses profit and loss period when on pnl view', () => {
    const text = formatReportPeriodText({
      profitLoss: { period: { startDate: '2026-01-01', endDate: '2026-06-30' } },
      trialBalance: { period: { startDate: '2025-01-01', endDate: '2025-12-31' } },
    }, 'pnl')
    expect(text).toBe('2026-01-01 to 2026-06-30')
  })
})

describe('buildReportPdfMeta', () => {
  it('includes trial balance totals and period', () => {
    const meta = buildReportPdfMeta({
      reportView: 'trial',
      reports: {
        trialBalance: {
          period: { startDate: '2026-01-01', endDate: '2026-06-30' },
          totalDebit: 1000,
          totalCredit: 1000,
          difference: 0,
          balanced: true,
        },
      },
    })
    expect(meta.title).toBe('Trial Balance')
    expect(meta.periodText).toContain('2026-01-01')
    expect(meta.summaryLines.some((line) => line.includes('Balanced'))).toBe(true)
    expect(meta.fileBase).toContain('trial-balance')
  })

  it('includes profit and loss summary totals', () => {
    const meta = buildReportPdfMeta({
      reportView: 'pnl',
      reports: {
        profitLoss: {
          period: { startDate: '2026-01-01', endDate: '2026-06-30' },
          totalIncome: 5000,
          totalExpense: 3000,
          netProfit: 2000,
        },
      },
    })
    expect(meta.title).toBe('Profit & Loss Statement')
    expect(meta.summaryLines.some((line) => line.includes('Net Profit'))).toBe(true)
  })
})

describe('buildReportPdfTable', () => {
  it('builds profit and loss rows with subtotals and net profit', () => {
    const { body } = buildReportPdfTable({
      reportView: 'pnl',
      reports: {
        profitLoss: {
          incomeBreakdown: [{ accountCode: '4000', accountName: 'Sales', amount: 5000 }],
          expenseBreakdown: [{ accountCode: '6000', accountName: 'Rent', amount: 1000 }],
          totalIncome: 5000,
          totalExpense: 1000,
          netProfit: 4000,
        },
      },
      formatMoney,
    })
    expect(body.some((row) => row[2] === 'Total Income')).toBe(true)
    expect(body.some((row) => row[2] === 'Total Expense')).toBe(true)
    expect(body.some((row) => row[2] === 'Net Profit' && row[3] === '$4000.00')).toBe(true)
  })
})

describe('buildReportExportPayload', () => {
  it('allows pnl export without trial balance loaded', () => {
    const payload = buildReportExportPayload({
      reportView: 'pnl',
      reports: {
        profitLoss: {
          incomeBreakdown: [{ accountCode: '4000', accountName: 'Sales', amount: 100 }],
          expenseBreakdown: [],
        },
      },
      branding: {},
      defaultBranding: {},
    })
    expect(payload).not.toBeNull()
    expect(payload.successLabel).toBe('Profit & loss')
  })
})
