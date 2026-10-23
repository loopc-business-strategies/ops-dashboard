const { describe, expect, test } = require('@jest/globals')
const { resolveRange, resolveVoucherTypeFilter } = require('./activityLogRoutes')

describe('activityLogRoutes.resolveVoucherTypeFilter', () => {
  test('accepts known voucher types', () => {
    expect(resolveVoucherTypeFilter('payment')).toBe('payment')
    expect(resolveVoucherTypeFilter('Receipt')).toBe('receipt')
    expect(resolveVoucherTypeFilter('metal_transfer')).toBe('metal_transfer')
  })

  test('rejects unknown types', () => {
    expect(resolveVoucherTypeFilter('')).toBe('')
    expect(resolveVoucherTypeFilter('not-a-type')).toBe('')
  })
})

describe('activityLogRoutes.resolveRange', () => {
  test('uses financial year when provided', () => {
    const { start, end } = resolveRange({ financialYear: '2026' })
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })

  test('uses month key when provided', () => {
    const { start, end } = resolveRange({ month: '2026-03' })
    expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-31T23:59:59.999Z')
  })

  test('intersects explicit dates with FY', () => {
    const { start, end } = resolveRange({
      financialYear: '2026',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-30T23:59:59.999Z')
  })
})
