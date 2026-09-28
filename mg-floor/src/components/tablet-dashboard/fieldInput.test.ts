import { describe, expect, it } from 'vitest'
import { cleanNumberInput, formatTimeTyping, isImpossibleTime, normalizeTime } from './fieldInput'

describe('cleanNumberInput', () => {
  it('keeps the dot anywhere, once', () => {
    expect(cleanNumberInput('99.5', 6)).toBe('99.5')
    expect(cleanNumberInput('.5', 6)).toBe('.5')
    expect(cleanNumberInput('99.', 6)).toBe('99.')
    expect(cleanNumberInput('1.2.3', 9)).toBe('1.23')
  })

  it('turns a comma into a dot and drops other characters', () => {
    expect(cleanNumberInput('12,5', 9)).toBe('12.5')
    expect(cleanNumberInput('1.2kg', 9)).toBe('1.2')
    expect(cleanNumberInput('-3', 9)).toBe('3')
    expect(cleanNumberInput('123456789.12', 9)).toBe('123456789')
  })
})

describe('formatTimeTyping', () => {
  it('adds the colon once the hour is known', () => {
    const typed = (keys: string) => [...keys].reduce((text, key) => formatTimeTyping(text + key), '')
    expect(typed('1430')).toBe('14:30')
    expect(typed('0905')).toBe('09:05')
    expect(typed('930')).toBe('9:30')
    expect(typed('2359')).toBe('23:59')
    expect(typed('14')).toBe('14')
  })

  it('uses a typed dot or colon as the colon', () => {
    expect(formatTimeTyping('14.30')).toBe('14:30')
    expect(formatTimeTyping('9.')).toBe('9:')
    expect(formatTimeTyping('9:05')).toBe('9:05')
    expect(formatTimeTyping('1:2:3')).toBe('1:23')
  })

  it('lets backspace remove the colon', () => {
    expect(formatTimeTyping('14:')).toBe('14:')
    expect(formatTimeTyping('14')).toBe('14')
  })
})

describe('normalizeTime', () => {
  it('returns HH:MM for real times', () => {
    expect(normalizeTime('')).toBe('')
    expect(normalizeTime('14:30')).toBe('14:30')
    expect(normalizeTime('9:30')).toBe('09:30')
    expect(normalizeTime('1430')).toBe('14:30')
    expect(normalizeTime('14.30')).toBe('14:30')
    expect(normalizeTime('9')).toBe('09:00')
    expect(normalizeTime('14:')).toBe('14:00')
    expect(normalizeTime('00:00')).toBe('00:00')
  })

  it('rejects times that are not real or not finished', () => {
    expect(normalizeTime('25:10')).toBeNull()
    expect(normalizeTime('10:75')).toBeNull()
    expect(normalizeTime('9:3')).toBeNull()
  })
})

describe('isImpossibleTime', () => {
  it('flags only times that can no longer be valid', () => {
    expect(isImpossibleTime('14:3')).toBe(false)
    expect(isImpossibleTime('25:10')).toBe(true)
    expect(isImpossibleTime('10:75')).toBe(true)
    expect(isImpossibleTime('')).toBe(false)
  })
})
