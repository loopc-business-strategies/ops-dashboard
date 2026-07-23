const { timingSafeEqualString } = require('../utils/timingSafeEqualString')

describe('timingSafeEqualString', () => {
  test('returns true for equal strings', () => {
    expect(timingSafeEqualString('secret-token', 'secret-token')).toBe(true)
  })

  test('returns false for different values of same length', () => {
    expect(timingSafeEqualString('secret-token', 'secret-wrong')).toBe(false)
  })

  test('returns false for different lengths', () => {
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false)
  })

  test('coerces nullish to empty string', () => {
    expect(timingSafeEqualString(null, '')).toBe(true)
    expect(timingSafeEqualString(undefined, 'x')).toBe(false)
  })
})
