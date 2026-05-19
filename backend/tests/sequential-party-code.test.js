const {
  getMaxPrefixedSequence,
  getNextPrefixedCode,
  parsePrefixedSequence,
} = require('../utils/sequentialPartyCode')

describe('sequential party codes', () => {
  test('parses VEN sequence numbers', () => {
    expect(parsePrefixedSequence('VEN-0008', 'VEN')).toBe(8)
    expect(parsePrefixedSequence('ven-0002', 'VEN')).toBe(2)
    expect(parsePrefixedSequence('XX-0001', 'VEN')).toBeNull()
  })

  test('finds max sequence across sparse and deleted-style gaps', () => {
    const codes = ['VEN-0002', 'VEN-0008', 'VEN-0004', 'VEN-0001', 'VEN-0003']
    expect(getMaxPrefixedSequence(codes, 'VEN')).toBe(8)
    expect(getNextPrefixedCode(codes, 'VEN')).toBe('VEN-0009')
  })

  test('ignores non-standard vendor codes when allocating next code', () => {
    const codes = ['VEN-0002', 'CUSTOM', 'VEN-0004']
    expect(getNextPrefixedCode(codes, 'VEN')).toBe('VEN-0005')
  })
})
