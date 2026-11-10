const {
  normalizeIdNumber,
  normalizePhoneNumber,
} = require('../utils/employeeIdentity')

describe('employeeIdentity', () => {
  test('normalizes national ID', () => {
    expect(normalizeIdNumber(' ac-2076035 ')).toBe('AC2076035')
    expect(normalizeIdNumber('AB_12-34')).toBe('AB1234')
  })

  test('normalizes phone to digits', () => {
    expect(normalizePhoneNumber('+998 90 333-4444')).toBe('998903334444')
    expect(normalizePhoneNumber('')).toBe('')
  })
})
