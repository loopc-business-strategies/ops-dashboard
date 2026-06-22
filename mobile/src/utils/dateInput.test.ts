import { describe, expect, it } from 'vitest'
import {
  formatDateToInput,
  isValidDateInput,
  normalizeDateInput,
  validateDateRange,
} from './dateInput'

describe('dateInput', () => {
  it('validates ISO date strings', () => {
    expect(isValidDateInput('2026-04-06')).toBe(true)
    expect(isValidDateInput('')).toBe(true)
    expect(isValidDateInput('06-04-2026')).toBe(false)
    expect(isValidDateInput('2026-13-01')).toBe(false)
  })

  it('normalizes trimmed dates', () => {
    expect(normalizeDateInput('  2026-04-06  ')).toBe('2026-04-06')
    expect(normalizeDateInput('')).toBe('')
  })

  it('formats Date to YYYY-MM-DD', () => {
    expect(formatDateToInput(new Date('2026-04-06T12:00:00.000Z'))).toBe('2026-04-06')
  })

  it('validates date ranges', () => {
    expect(validateDateRange('', '')).toEqual({ ok: true })
    expect(validateDateRange('2026-04-01', '2026-04-30')).toEqual({ ok: true })
    expect(validateDateRange('2026-04-30', '2026-04-01').ok).toBe(false)
    expect(validateDateRange('bad', '2026-04-01').ok).toBe(false)
  })
})
