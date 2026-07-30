const {
  buildYearMonthsDateFilter,
  normalizeMonths,
  normalizeYear,
} = require('../utils/yearMonthsDateFilter')

describe('yearMonthsDateFilter', () => {
  test('normalizes year and months', () => {
    expect(normalizeYear('2026')).toBe(2026)
    expect(normalizeYear('26')).toBeNull()
    expect(normalizeMonths('7,8,7')).toEqual([7, 8])
    expect(normalizeMonths([3, '1', 15])).toEqual([1, 3])
  })

  test('builds full-year date range', () => {
    const clause = buildYearMonthsDateFilter('2026', '')
    expect(clause.date.$gte.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(clause.date.$lte.toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })

  test('builds month $or ranges for selected months in a year', () => {
    const clause = buildYearMonthsDateFilter('2026', '7,8')
    expect(clause.$or).toHaveLength(2)
    expect(clause.$or[0].date.$gte.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(clause.$or[0].date.$lte.toISOString()).toBe('2026-07-31T23:59:59.999Z')
    expect(clause.$or[1].date.$gte.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(clause.$or[1].date.$lte.toISOString()).toBe('2026-08-31T23:59:59.999Z')
  })

  test('months without year use $expr month match', () => {
    const clause = buildYearMonthsDateFilter('', '6,7')
    expect(clause.$expr).toEqual({ $in: [{ $month: '$date' }, [6, 7]] })
  })

  test('returns null when no filters', () => {
    expect(buildYearMonthsDateFilter('', '')).toBeNull()
  })
})
