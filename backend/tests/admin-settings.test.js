const {
  validatePasswordPolicy,
  resolveSessionMaxAgeMs,
  resolveJwtExpiresIn,
} = require('../services/adminSettings')

describe('admin settings helpers', () => {
  test('strong password policy requires length, letters, numbers, and symbol', () => {
    expect(validatePasswordPolicy('short1!', 'strong')).toMatch(/8 characters/)
    expect(validatePasswordPolicy('longenough', 'strong')).toMatch(/letters and numbers/)
    expect(validatePasswordPolicy('LongEnough1', 'strong')).toMatch(/symbol/)
    expect(validatePasswordPolicy('ValidPass1!', 'strong')).toBeNull()
  })

  test('medium password policy requires 8 characters only', () => {
    expect(validatePasswordPolicy('short', 'medium')).toMatch(/8 characters/)
    expect(validatePasswordPolicy('longenough', 'medium')).toBeNull()
  })

  test('session timeout resolves from admin settings within bounds', () => {
    expect(resolveSessionMaxAgeMs({ sessionTimeoutMinutes: '45' })).toBe(45 * 60 * 1000)
    expect(resolveSessionMaxAgeMs({ sessionTimeoutMinutes: '2' })).toBeGreaterThan(45 * 60 * 1000)
    expect(resolveJwtExpiresIn(30 * 60 * 1000)).toBe('1800s')
  })
})
