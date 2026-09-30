import { describe, expect, it } from 'vitest'
import {
  batchRefLabel,
  compareToOverall,
  elapsedMinutes,
  formatGrams,
  formatMinutes,
  formatPct,
  isOverLimit,
  parseLossLimit,
} from './statsFormat'

describe('stats format', () => {
  it('formats batch times, grams and percentages', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(445)).toBe('7h 25m')
    expect(formatMinutes(125)).toBe('2h 05m')
    expect(formatMinutes(null)).toBe('--')
    expect(formatGrams(10.2)).toBe('10.2 g')
    expect(formatGrams(4.33333)).toBe('4.333 g')
    expect(formatPct(0.7700001)).toBe('0.77%')
    expect(formatPct(null)).toBe('')
  })

  it('times the running batch from its Metal In', () => {
    expect(elapsedMinutes('2026-09-28T12:00:00Z', Date.parse('2026-09-28T14:15:00Z'))).toBe(135)
    expect(elapsedMinutes('bad', Date.now())).toBeNull()
  })

  it('flags loss above the limit only when a limit is set', () => {
    expect(isOverLimit(0.77, 0.5)).toBe(true)
    expect(isOverLimit(0.4, 0.5)).toBe(false)
    expect(isOverLimit(0.77, null)).toBe(false)
  })

  it('labels batches from other days with their date', () => {
    expect(batchRefLabel({ batchNumber: '2', date: '2026-09-28' }, '2026-09-28')).toBe('Batch 2')
    expect(batchRefLabel({ batchNumber: '9', date: '2026-09-20' }, '2026-09-28')).toBe('Batch 9 · 20 Sep')
  })

  it('compares today with the overall average', () => {
    expect(compareToOverall(195, 220)).toEqual({ text: '▼ 25m faster than usual', tone: 'good' })
    expect(compareToOverall(250, 163)).toEqual({ text: '▲ 1h 27m slower than usual', tone: 'bad' })
    expect(compareToOverall(163, 163.3)).toEqual({ text: 'Same as usual', tone: 'neutral' })
    expect(compareToOverall(null, 163)).toBeNull()
  })

  it('reads the loss limit a manager types', () => {
    expect(parseLossLimit('0.5')).toBe(0.5)
    expect(parseLossLimit('0,75 %')).toBe(0.75)
    expect(parseLossLimit('')).toBeNull()
    expect(parseLossLimit('0')).toBeNaN()
    expect(parseLossLimit('abc')).toBeNaN()
    expect(parseLossLimit('150')).toBeNaN()
  })
})
