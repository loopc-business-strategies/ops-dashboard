import { describe, expect, it } from 'vitest'
import {
  aggregateExpensesByMonth,
  buildMomSummaryRows,
  expenseMonthDateRange,
  expenseMonthLabel,
} from './expenseMonthFilterUtils'
import { buildExpenseMomExportPayload, buildExpenseMonthExportPayload } from './expenseExportHelpers'

describe('expenseMonthDateRange', () => {
  it('returns full year through today when month is all', () => {
    const { startDate, endDate } = expenseMonthDateRange(2026, '')
    expect(startDate).toBe('2026-01-01')
    expect(endDate).toMatch(/^2026-/)
  })

  it('returns specific month bounds', () => {
    const { startDate, endDate } = expenseMonthDateRange(2026, '5')
    expect(startDate).toBe('2026-06-01')
    expect(endDate).toBe('2026-06-30')
  })
})

describe('aggregateExpensesByMonth', () => {
  it('buckets items by calendar month', () => {
    const buckets = aggregateExpensesByMonth([
      { date: '2026-06-15T00:00:00.000Z', amount: 100 },
      { date: '2026-07-01T00:00:00.000Z', amount: 50 },
    ], 2026)
    expect(buckets[5].amount).toBe(100)
    expect(buckets[5].count).toBe(1)
    expect(buckets[6].amount).toBe(50)
  })
})

describe('buildMomSummaryRows', () => {
  it('computes month-over-month change', () => {
    const rows = buildMomSummaryRows([
      { label: 'January', amount: 100, count: 2 },
      { label: 'February', amount: 150, count: 3 },
    ])
    expect(rows[0].change).toBe(100)
    expect(rows[1].priorMonth).toBe(100)
    expect(rows[1].change).toBe(50)
    expect(rows[1].changePct).toBe(50)
  })
})

describe('expense export payloads', () => {
  it('builds month export rows', () => {
    const payload = buildExpenseMonthExportPayload({
      items: [{ date: '2026-06-01', category: 'Rent', amount: 500, paymentMethod: 'Bank' }],
      year: 2026,
      monthIndex: '5',
    })
    expect(payload.fileBase).toContain('june')
    expect(payload.rows.some((r) => r[1] === 'Rent')).toBe(true)
  })

  it('builds mom export with 12 months', () => {
    const payload = buildExpenseMomExportPayload({
      year: 2026,
      monthRows: buildMomSummaryRows(aggregateExpensesByMonth([], 2026)),
    })
    expect(payload.fileBase).toContain('mom-2026')
    expect(payload.rows.filter((r) => r[0] === 'January').length).toBe(1)
  })
})

describe('expenseMonthLabel', () => {
  it('returns All months for empty index', () => {
    expect(expenseMonthLabel('')).toBe('All months')
    expect(expenseMonthLabel('6')).toBe('July')
  })
})
