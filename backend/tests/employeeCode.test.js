const {
  parseEmployeeCodeSuffix,
  formatEmployeeCode,
  normalizeEmployeeCodeFormat,
} = require('../utils/employeeCode')

describe('employeeCode', () => {
  test('parses EMP-NNN and bare numbers', () => {
    expect(parseEmployeeCodeSuffix('EMP-003')).toBe(3)
    expect(parseEmployeeCodeSuffix('emp-12')).toBe(12)
    expect(parseEmployeeCodeSuffix('7')).toBe(7)
    expect(parseEmployeeCodeSuffix('ABC')).toBe(0)
  })

  test('formats padded codes', () => {
    expect(formatEmployeeCode(1)).toBe('EMP-001')
    expect(formatEmployeeCode(42)).toBe('EMP-042')
  })

  test('normalizeEmployeeCodeFormat upgrades bare digits', () => {
    expect(normalizeEmployeeCodeFormat('001')).toBe('EMP-001')
    expect(normalizeEmployeeCodeFormat('4')).toBe('EMP-004')
    expect(normalizeEmployeeCodeFormat('EMP-007')).toBe('EMP-007')
    expect(normalizeEmployeeCodeFormat('emp-008')).toBe('EMP-008')
  })
})
