import { describe, expect, it } from 'vitest'
import { compareMetalOut, formatWait, minutesWaiting, undoMinutesLeft } from './floorBatchCheck'

describe('compareMetalOut', () => {
  it('works out loss and flags it above the limit', () => {
    const r = compareMetalOut({ weight: 520, fineGold: 497.5 }, { weight: 517, fineGold: 497 }, 0.5)
    expect(r).toMatchObject({ inWeight: 520, outWeight: 517, loss: 3, lossPct: 0.58, overLimit: true, outMoreThanIn: false, purityTooHigh: false })
  })

  it('flags Out more than In and fine gold that grew', () => {
    const r = compareMetalOut({ weight: 520, fineGold: 497.5 }, { weight: 517, fineGold: 514.415 }, 0.5)
    expect(r.purityTooHigh).toBe(true)
    expect(r.maxPurity).toBe(96.22)
    expect(compareMetalOut({ weight: 514 }, { weight: 514517 }, 0.5).outMoreThanIn).toBe(true)
  })

  it('skips checks it has no numbers for', () => {
    expect(compareMetalOut(null, { weight: 5 }, 0.5)).toBeNull()
    const r = compareMetalOut({ weight: 10, fineGold: null }, { weight: 9.9, fineGold: 9.8 }, null)
    expect(r).toMatchObject({ loss: 0.1, overLimit: false, purityTooHigh: false, maxPurity: null })
  })
})

describe('waiting time', () => {
  it('counts and formats minutes', () => {
    const now = Date.parse('2026-09-30T12:00:00Z')
    expect(minutesWaiting('2026-09-30T10:25:00Z', now)).toBe(95)
    expect(minutesWaiting('nope', now)).toBeNull()
    expect(formatWait(95)).toBe('1h 35m')
    expect(formatWait(20)).toBe('20m')
  })
})

describe('undo window', () => {
  const now = Date.parse('2026-09-30T12:00:00Z')
  it('counts down from the approval time', () => {
    expect(undoMinutesLeft({ status: 'APPROVED', decidedAt: '2026-09-30T10:00:00Z' }, 24, now)).toBe(22 * 60)
  })
  it('is gone after the window, for other statuses and without a window', () => {
    expect(undoMinutesLeft({ status: 'APPROVED', decidedAt: '2026-09-29T11:59:00Z' }, 24, now)).toBeNull()
    expect(undoMinutesLeft({ status: 'REJECTED', decidedAt: '2026-09-30T10:00:00Z' }, 24, now)).toBeNull()
    expect(undoMinutesLeft({ status: 'APPROVED', decidedAt: '2026-09-30T10:00:00Z' }, 0, now)).toBeNull()
  })
})
