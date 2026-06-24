import { describe, expect, test } from 'vitest'
import {
  buildErpReportDateRange,
  buildErpReportRequestKey,
  createInitialReportsState,
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
})
