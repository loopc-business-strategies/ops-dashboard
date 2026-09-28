import { describe, expect, it } from 'vitest'
import { cleanNumberInput, cleanTimeInput, normalizeTime } from './fieldInput'

describe('cleanNumberInput', () => {
  it('keeps digits and one decimal point', () => {
    expect(cleanNumberInput('12,5', 9)).toBe('12.5')
    expect(cleanNumberInput('1.2kg', 9)).toBe('1.2')
    expect(cleanNumberInput('1.2.3', 9)).toBe('1.23')
    expect(cleanNumberInput('-3', 9)).toBe('3')
    expect(cleanNumberInput('123456789.12', 9)).toBe('123456789')
  })
})

describe('cleanTimeInput', () => {
  it('turns the typed separator into a colon and keeps it short', () => {
    expect(cleanTimeInput('22.45')).toBe('22:45')
    expect(cleanTimeInput('9,05')).toBe('9:05')
    expect(cleanTimeInput('22:4:5')).toBe('22:45')
    expect(cleanTimeInput('2245pm')).toBe('2245')
    expect(cleanTimeInput('22:455')).toBe('22:45')
  })
})

describe('normalizeTime', () => {
  it('accepts common ways of typing a time', () => {
    expect(normalizeTime('')).toBe('')
    expect(normalizeTime('22:45')).toBe('22:45')
    expect(normalizeTime('9:05')).toBe('09:05')
    expect(normalizeTime('2245')).toBe('22:45')
    expect(normalizeTime('945')).toBe('09:45')
    expect(normalizeTime('9')).toBe('09:00')
    expect(normalizeTime('00:00')).toBe('00:00')
  })

  it('rejects times that are not real', () => {
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('10:60')).toBeNull()
    expect(normalizeTime('10:5')).toBeNull()
    expect(normalizeTime('123:45')).toBeNull()
  })
})
