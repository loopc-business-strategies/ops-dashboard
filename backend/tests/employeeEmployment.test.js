const {
  isEmployedOnDate,
  buildEmployedAsOfFilter,
  parseAsOfQuery,
  toEmploymentDateKey,
} = require('../utils/employeeEmployment')

describe('employeeEmployment', () => {
  test('parseAsOfQuery accepts YYYY-MM-DD only', () => {
    expect(parseAsOfQuery('2026-11-01')).toBe('2026-11-01')
    expect(parseAsOfQuery('bad')).toBeNull()
  })

  test('toEmploymentDateKey prefers ISO prefix and uses UTC for Date objects', () => {
    expect(toEmploymentDateKey('2026-11-03T00:00:00.000Z')).toBe('2026-11-03')
    expect(toEmploymentDateKey(new Date(Date.UTC(2026, 10, 3)))).toBe('2026-11-03')
    expect(toEmploymentDateKey(null)).toBeNull()
  })

  test('isEmployedOnDate requires joiningDate and respects deletedAt', () => {
    expect(isEmployedOnDate({ joiningDate: null }, '2026-11-01')).toBe(false)
    expect(isEmployedOnDate({}, '2026-11-01')).toBe(false)
    expect(isEmployedOnDate({ joiningDate: '2026-11-03' }, '2026-11-01')).toBe(false)
    expect(isEmployedOnDate({ joiningDate: '2026-11-03' }, '2026-11-03')).toBe(true)
    expect(isEmployedOnDate({
      joiningDate: '2026-10-01',
      isDeleted: true,
      deletedAt: '2026-11-05T12:00:00.000Z',
    }, '2026-11-04')).toBe(true)
    expect(isEmployedOnDate({
      joiningDate: '2026-10-01',
      isDeleted: true,
      deletedAt: '2026-11-05T12:00:00.000Z',
    }, '2026-11-05')).toBe(false)
  })

  test('buildEmployedAsOfFilter requires joiningDate and returns mongo shape', () => {
    const filter = buildEmployedAsOfFilter('2026-05-15')
    expect(filter).toBeTruthy()
    expect(filter.$and).toHaveLength(2)
    expect(filter.$and[0].joiningDate.$lte).toBeInstanceOf(Date)
    expect(filter.$and[0].joiningDate.$ne).toBeNull()
  })

  test('buildEmployedAsOfFilter activeOnly excludes archived branch', () => {
    const filter = buildEmployedAsOfFilter('2026-05-15', { activeOnly: true })
    expect(filter.$and[1]).toEqual({ isDeleted: { $ne: true } })
  })
})
