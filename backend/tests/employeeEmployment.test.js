const {
  isEmployedOnDate,
  buildEmployedAsOfFilter,
  parseAsOfQuery,
} = require('../utils/employeeEmployment')

describe('employeeEmployment', () => {
  test('parseAsOfQuery accepts YYYY-MM-DD only', () => {
    expect(parseAsOfQuery('2026-11-01')).toBe('2026-11-01')
    expect(parseAsOfQuery('bad')).toBeNull()
  })

  test('isEmployedOnDate respects joining and deletedAt', () => {
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

  test('buildEmployedAsOfFilter returns mongo shape', () => {
    const filter = buildEmployedAsOfFilter('2026-05-15')
    expect(filter).toBeTruthy()
    expect(filter.$and).toHaveLength(2)
  })
})
