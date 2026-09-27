import { describe, expect, it } from 'vitest'
import { parseScaleWeight } from './weightParser'

const GJ2000 = { unit: 'g', resolution: 0.01, capacity: 2200 }

describe('parseScaleWeight (GJ-2000 profile)', () => {
  it.each([
    ['100.00', 100],
    ['500.00', 500],
    ['999.99', 999.99],
    ['1250.35', 1250.35],
    ['1500.25', 1500.25],
    ['2200.00', 2200],
  ])('accepts %s', (text, weight) => {
    const r = parseScaleWeight(`${text} g`, GJ2000)
    expect(r).toMatchObject({ ok: true, weight, unit: 'g', unitDetected: true })
  })

  it.each(['1250.3B', 'ABC1250', '1250XX', 'l250.35', '12?0.35', '1250.35x'])('rejects contaminated %s', (text) => {
    const r = parseScaleWeight(text, GJ2000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('INVALID_CHARACTERS')
  })

  it('never reads model or serial numbers as a weight', () => {
    expect(parseScaleWeight('GJ-2000', GJ2000)).toMatchObject({ ok: false, reason: 'INVALID_CHARACTERS' })
    expect(parseScaleWeight('SN 2000', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
    expect(parseScaleWeight('SN12345678', GJ2000)).toMatchObject({ ok: false, reason: 'INVALID_CHARACTERS' })
    expect(parseScaleWeight('GJ-2000\n1250.35 g', GJ2000)).toMatchObject({ ok: true, weight: 1250.35 })
  })

  it('requires the exact decimals implied by the resolution', () => {
    expect(parseScaleWeight('1250.3', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
    expect(parseScaleWeight('1250.355', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
    expect(parseScaleWeight('1250', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
    expect(parseScaleWeight('01250.35', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
  })

  it('caps integer digits from the capacity', () => {
    expect(parseScaleWeight('12500.35', GJ2000)).toMatchObject({ ok: false, reason: 'WRONG_FORMAT' })
    expect(parseScaleWeight('2500.00', GJ2000)).toMatchObject({ ok: true, weight: 2500 })
  })

  it('rejects two numeric candidates as ambiguous', () => {
    expect(parseScaleWeight('1250.35 1250.36', GJ2000)).toMatchObject({ ok: false, reason: 'AMBIGUOUS' })
  })

  it('rejects zero, negative and wrong units', () => {
    expect(parseScaleWeight('0.00 g', GJ2000)).toMatchObject({ ok: false, reason: 'ZERO' })
    expect(parseScaleWeight('-12.50 g', GJ2000)).toMatchObject({ ok: false, reason: 'NEGATIVE' })
    expect(parseScaleWeight('- 12.50 g', GJ2000)).toMatchObject({ ok: false, reason: 'NEGATIVE' })
    expect(parseScaleWeight('12.50 ct', GJ2000)).toMatchObject({ ok: false, reason: 'UNIT_MISMATCH' })
    expect(parseScaleWeight('12.50ct', GJ2000)).toMatchObject({ ok: false, reason: 'UNIT_MISMATCH' })
  })

  it('flags a missing unit without rejecting', () => {
    expect(parseScaleWeight('1250.35', GJ2000)).toMatchObject({ ok: true, unitDetected: false })
    expect(parseScaleWeight('1250.35g', GJ2000)).toMatchObject({ ok: true, unitDetected: true })
  })

  it('tolerates spacing around the decimal point and decoration', () => {
    expect(parseScaleWeight('1250 . 35 g', GJ2000)).toMatchObject({ ok: true, weight: 1250.35 })
    expect(parseScaleWeight('*1250.35*', GJ2000)).toMatchObject({ ok: true, weight: 1250.35 })
  })

  it('returns NO_READING for empty text', () => {
    expect(parseScaleWeight('', GJ2000)).toMatchObject({ ok: false, reason: 'NO_READING' })
    expect(parseScaleWeight('g', GJ2000)).toMatchObject({ ok: false, reason: 'NO_READING' })
  })
})
