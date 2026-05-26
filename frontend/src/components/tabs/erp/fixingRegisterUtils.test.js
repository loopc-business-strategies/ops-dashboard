import { describe, expect, it } from 'vitest'
import {
  fixingRegConvertQty,
  fixingRegConvertRate,
  fixingRegConvertToOz,
  fixingRegNormalizeUnit,
} from './fixingRegisterUtils'

describe('fixingRegisterUtils', () => {
  it('normalizes ounce aliases to GOZ', () => {
    expect(fixingRegNormalizeUnit('oz')).toBe('GOZ')
    expect(fixingRegNormalizeUnit('ounce')).toBe('GOZ')
    expect(fixingRegNormalizeUnit('ounces')).toBe('GOZ')
  })

  it('converts quantities from ounces to selected units', () => {
    expect(fixingRegConvertQty(2, 'GOZ')).toBe(2)
    expect(fixingRegConvertQty(2, 'GRAM')).toBeCloseTo(62.2069536)
    expect(fixingRegConvertQty(2, 'KG')).toBeCloseTo(0.062207)
  })

  it('converts rates from per ounce to selected unit rates', () => {
    expect(fixingRegConvertRate(3100, 'GOZ')).toBe(3100)
    expect(fixingRegConvertRate(3100, 'GRAM')).toBeCloseTo(99.6673)
  })

  it('converts selected quantities back to ounces', () => {
    expect(fixingRegConvertToOz(31.1034768, 'GRAM')).toBeCloseTo(1)
    expect(fixingRegConvertToOz(0.0311034768, 'KG')).toBeCloseTo(1)
  })
})
