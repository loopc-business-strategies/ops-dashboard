import { describe, expect, it } from 'vitest'
import { formatPct, limitEditState, lossTone, parseLossLimitInput } from './lossLimits'

describe('parseLossLimitInput', () => {
  it('accepts the same formats as the tablet', () => {
    expect(parseLossLimitInput('0.5')).toEqual({ value: 0.5 })
    expect(parseLossLimitInput(' 0,75 % ')).toEqual({ value: 0.75 })
    expect(parseLossLimitInput('1.234')).toEqual({ value: 1.23 })
    expect(parseLossLimitInput('100')).toEqual({ value: 100 })
  })

  it('rejects empty, zero, negative, over 100 and text', () => {
    expect(parseLossLimitInput('').error).toMatch(/Enter a limit/)
    for (const bad of ['0', '-1', '101', 'abc']) expect(parseLossLimitInput(bad).error).toMatch(/between 0 and 100/)
  })
})

describe('limitEditState', () => {
  it('offers Save for any edit, Remove when a saved limit is cleared', () => {
    expect(limitEditState('', null)).toBe('clean')
    expect(limitEditState('0.50', 0.5)).toBe('clean')
    expect(limitEditState('0.5', null)).toBe('dirty')
    expect(limitEditState('0.6', 0.5)).toBe('dirty')
    expect(limitEditState('abc', 0.5)).toBe('dirty')
    expect(limitEditState('  ', 0.5)).toBe('cleared')
  })
})

describe('lossTone', () => {
  it('compares the average loss with the limit', () => {
    expect(lossTone(0.7, 0.6)).toBe('over')
    expect(lossTone(0.5, 0.6)).toBe('near')
    expect(lossTone(0.3, 0.6)).toBe('ok')
    expect(lossTone(null, 0.6)).toBe('none')
    expect(lossTone(0.7, null)).toBe('none')
  })
})

describe('formatPct', () => {
  it('shows two decimals or a dash', () => {
    expect(formatPct(0.5)).toBe('0.50%')
    expect(formatPct(null)).toBe('—')
  })
})
