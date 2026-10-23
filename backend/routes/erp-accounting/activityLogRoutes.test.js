const { resolveRange } = require('./activityLogRoutes')

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
