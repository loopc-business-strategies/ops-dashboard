import { describe, expect, test } from 'vitest'
import { formatDirectionalBalanceValue } from './formatDirectionalBalanceValue'

describe('formatDirectionalBalanceValue', () => {
  test('money mode keeps currency prefix', () => {
    expect(formatDirectionalBalanceValue(-1170, {}, (abs) => `USD ${abs.toFixed(2)}`))
      .toBe('USD 1170.00 Cr')
  })

  test('weight mode omits currency prefix on Pure WT / position grams', () => {
    expect(formatDirectionalBalanceValue(-1170, { asWeight: true }))
      .toBe('1,170.00 Cr')
    expect(formatDirectionalBalanceValue(1000, { asWeight: true, unit: 'grams' }))
      .toBe('1,000.00 Dr')
  })

  test('zero weight has no Dr/Cr suffix', () => {
    expect(formatDirectionalBalanceValue(0, { asWeight: true })).toBe('0.00')
  })
})
