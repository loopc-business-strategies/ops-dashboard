import { describe, expect, test } from 'vitest'
import { formatCustomerMarginPercent, isMarginPercentDisplayable } from './marginFormatters'

describe('Margin % display', () => {
  test('shows ordinary and large figures', () => {
    expect(formatCustomerMarginPercent(152.4)).toBe('152.40 %')
    expect(formatCustomerMarginPercent(-25000)).toBe('-25000.00 %')
    expect(formatCustomerMarginPercent(0)).toBe('0.00 %')
  })

  test('hides figures from a tiny metal position and missing values', () => {
    expect(formatCustomerMarginPercent(-603358)).toBe('-')
    expect(formatCustomerMarginPercent(100000)).toBe('-')
    expect(formatCustomerMarginPercent(null)).toBe('-')
    expect(formatCustomerMarginPercent(undefined)).toBe('-')
    expect(formatCustomerMarginPercent(Number.NaN)).toBe('-')
    expect(isMarginPercentDisplayable(99999.99)).toBe(true)
  })
})
