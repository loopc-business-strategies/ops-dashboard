import { describe, expect, test } from 'vitest'
import { pinProblem } from './pinRules'

describe('floor PIN rules (same as server)', () => {
  test('accepts 4-6 digit PINs that are not trivial', () => {
    expect(pinProblem('2580')).toBeNull()
    expect(pinProblem('739104', '739104')).toBeNull()
  })

  test('refuses wrong length, letters, repeats, sequences and mismatched confirmation', () => {
    expect(pinProblem('123')).toMatch(/4 to 6 digits/)
    expect(pinProblem('1234567')).toMatch(/4 to 6 digits/)
    expect(pinProblem('12a4')).toMatch(/4 to 6 digits/)
    expect(pinProblem('0000')).toMatch(/same digit/)
    expect(pinProblem('3456')).toMatch(/sequence/)
    expect(pinProblem('6543')).toMatch(/sequence/)
    expect(pinProblem('2580', '2581')).toMatch(/do not match/)
  })
})
