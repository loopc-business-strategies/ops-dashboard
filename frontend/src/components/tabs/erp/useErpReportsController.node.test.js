import { describe, expect, test } from 'vitest'
import {
  buildErpReportDateRange,
  buildErpReportHeadlineKey,
  buildErpReportRequestKey,
  createInitialReportsState,
  isHeadlineReportCacheFresh,
  reportNeedsBalanceSheet,
  reportNeedsForex,
  reportNeedsProfitLoss,
  reportNeedsTrialBalance,
} from './useErpReportsController'

describe('useErpReportsController helpers', () => {
  test('buildErpReportDateRange resolves ytd, month, today, and custom ranges', () => {
    const now = new Date('2026-06-24T12:00:00.000Z')

    expect(buildErpReportDateRange({ period: 'ytd' }, now)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-06-24',
      commonRange: { startDate: '2026-01-01', endDate: '2026-06-24' },
    })
    expect(buildErpReportDateRange({ period: 'month' }, now)).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      commonRange: { startDate: '2026-06-01', endDate: '2026-06-30' },
    })
    expect(buildErpReportDateRange({
      period: 'month',
      reportYear: '2026',
      reportMonth: '3',
    }, now)).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      commonRange: { startDate: '2026-04-01', endDate: '2026-04-30' },
    })
    expect(buildErpReportDateRange({ period: 'today' }, now)).toEqual({
      startDate: '2026-06-24',
      endDate: '2026-06-24',
      commonRange: { startDate: '2026-06-24', endDate: '2026-06-24' },
    })
    expect(buildErpReportDateRange({ period: 'custom', startDate: '2026-06-10', endDate: '2026-06-20' }, now)).toEqual({
      startDate: '2026-06-10',
      endDate: '2026-06-20',
      commonRange: { startDate: '2026-06-10', endDate: '2026-06-20' },
    })
  })

  test('buildErpReportRequestKey excludes client-only search text', () => {
    const common = {
      targetView: 'trial',
      commonRange: { startDate: '2026-01-01', endDate: '2026-06-24' },
    }
    const baseFilters = {
      accountType: 'Asset',
      includeZeroAccounts: true,
      sortBy: 'accountCode',
      sortDir: 'asc',
      comparePrevious: true,
      referenceType: '',
      minAmount: '',
    }

    expect(buildErpReportRequestKey({ ...common, reportFilters: { ...baseFilters, search: 'cash' } }))
      .toBe(buildErpReportRequestKey({ ...common, reportFilters: { ...baseFilters, search: 'bank' } }))
  })

  test('buildErpReportRequestKey changes when selected report month changes', () => {
    const common = {
      targetView: 'pnl',
      commonRange: { startDate: '2026-06-01', endDate: '2026-06-30' },
    }
    const baseFilters = {
      reportYear: '2026',
      reportMonth: '5',
      accountType: '',
      includeZeroAccounts: false,
      sortBy: 'accountCode',
      sortDir: 'asc',
      comparePrevious: true,
      referenceType: '',
      minAmount: '',
    }

    const juneKey = buildErpReportRequestKey({ ...common, reportFilters: baseFilters })
    const julyKey = buildErpReportRequestKey({
      ...common,
      reportFilters: { ...baseFilters, reportMonth: '6' },
    })
    expect(juneKey).not.toBe(julyKey)
  })

  test('createInitialReportsState returns independent empty report buckets', () => {
    const first = createInitialReportsState()
    const second = createInitialReportsState()
    first.trialBalance = { totalDebit: 1 }

    expect(second).toEqual({
      trialBalance: null,
      profitLoss: null,
      balanceSheet: null,
      dayBook: null,
      customerOutstanding: null,
      vendorOutstanding: null,
      forex: null,
    })
  })

  test('summary and trial prefetch P&L, Balance Sheet, and Forex for headline cards', () => {
    expect(reportNeedsTrialBalance('summary')).toBe(true)
    expect(reportNeedsProfitLoss('summary')).toBe(true)
    expect(reportNeedsBalanceSheet('summary')).toBe(true)
    expect(reportNeedsForex('summary')).toBe(true)
    expect(reportNeedsTrialBalance('trial')).toBe(true)
    expect(reportNeedsProfitLoss('trial')).toBe(true)
    expect(reportNeedsBalanceSheet('trial')).toBe(true)
    expect(reportNeedsForex('trial')).toBe(true)
    expect(reportNeedsTrialBalance('pnl')).toBe(false)
    expect(reportNeedsProfitLoss('pnl')).toBe(true)
    expect(reportNeedsBalanceSheet('pnl')).toBe(false)
    expect(reportNeedsForex('pnl')).toBe(false)
    expect(reportNeedsBalanceSheet('balanceSheet')).toBe(true)
    expect(reportNeedsProfitLoss('balanceSheet')).toBe(false)
    expect(reportNeedsForex('forex')).toBe(true)
    expect(reportNeedsForex('dayBook')).toBe(false)
  })

  test('headline cache key ignores report view so Summary can fill KPI cards', () => {
    const commonRange = { startDate: '2026-01-01', endDate: '2026-10-28' }
    const reportFilters = {
      accountType: '',
      includeZeroAccounts: false,
      sortBy: 'accountCode',
      sortDir: 'asc',
      comparePrevious: true,
      referenceType: '',
      minAmount: '',
    }
    const headline = buildErpReportHeadlineKey({ commonRange, reportFilters })
    expect(headline).toBe(buildErpReportHeadlineKey({ commonRange, reportFilters }))
    expect(headline).not.toBe(buildErpReportRequestKey({
      targetView: 'summary',
      commonRange,
      reportFilters,
    }))
    expect(isHeadlineReportCacheFresh({ key: headline, at: Date.now(), hasPnl: true, hasBs: true }, headline)).toBe(true)
    expect(isHeadlineReportCacheFresh({ key: headline, at: Date.now() - 60_000 }, headline)).toBe(false)
  })
})
