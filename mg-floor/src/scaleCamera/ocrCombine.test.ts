import { describe, expect, it } from 'vitest'
import { toWeighProfile } from './cameraSettings'
import { combineOcrReadings, type MlReading, mlTokenConfidence } from './ocrCombine'
import type { SevenSegmentResult } from './sevenSegment'

const profile = (overrides: Record<string, unknown> = {}) =>
  toWeighProfile({
    scaleId: 'MG-GJ-01',
    unit: 'g',
    capacity: 2200,
    resolution: 0.01,
    captureMethods: ['CAMERA_OCR'],
    cameraOcr: { minConfidence: 0.9, ...overrides },
  })

function ml(text: string, confidence = 0.95): MlReading {
  return {
    text,
    lines: [
      {
        text,
        confidence,
        elements: text.split(/\s+/).map((t) => ({
          text: t,
          confidence,
          symbols: t.split('').map((c) => ({ text: c, confidence })),
        })),
      },
    ],
  }
}

const seven = (text: string | null, confidence = 0.9, reason?: SevenSegmentResult['reason']): SevenSegmentResult => ({
  text,
  confidence,
  digits: [],
  reason,
})

describe('combineOcrReadings', () => {
  it('agreeing engines produce a confirmable reading', () => {
    const r = combineOcrReadings({ ml: ml('1250.35 g', 0.7), seven: seven('1250.35', 0.95), profile: profile() })
    expect(r).toMatchObject({ status: 'OK', weight: 1250.35, crossCheckAgreed: true, unitDetected: true })
    expect(r.confidence).toBe(0.95)
  })

  it('disagreeing engines are never confirmable', () => {
    const r = combineOcrReadings({ ml: ml('1250.35 g'), seven: seven('1258.35'), profile: profile() })
    expect(r.status).toBe('ENGINES_DISAGREE')
    expect(r.weight).toBeNull()
    expect(r.confidence).toBeLessThanOrEqual(0.5)
  })

  it('a single engine reading is halved and low confidence', () => {
    const r = combineOcrReadings({ ml: ml('1250.3B'), seven: seven('1250.38', 1), profile: profile() })
    expect(r.status).toBe('LOW_CONFIDENCE')
    expect(r.confidence).toBe(0.5)
  })

  it('ML only when cross-check is disabled', () => {
    const r = combineOcrReadings({ ml: ml('999.99 g', 0.97), seven: null, profile: profile({ sevenSegmentCrossCheck: false }) })
    expect(r).toMatchObject({ status: 'OK', weight: 999.99, confidence: 0.97, crossCheckAgreed: null })
  })

  it('capacity policy is applied to agreed readings', () => {
    expect(combineOcrReadings({ ml: ml('2200.00 g'), seven: seven('2200.00', 0.95), profile: profile() }).status).toBe('OK')
    const over = combineOcrReadings({ ml: ml('2200.01 g'), seven: seven('2200.01', 0.95), profile: profile() })
    expect(over).toMatchObject({ status: 'OUT_OF_RANGE', weight: null })
    const review = combineOcrReadings({
      ml: ml('2200.01 g'),
      seven: seven('2200.01', 0.95),
      profile: profile({ overCapacityPolicy: 'REVIEW' }),
    })
    expect(review).toMatchObject({ status: 'REVIEW', weight: 2200.01 })
    const far = combineOcrReadings({
      ml: ml('2500.00 g'),
      seven: seven('2500.00', 0.95),
      profile: profile({ overCapacityPolicy: 'REVIEW' }),
    })
    expect(far.status).toBe('OUT_OF_RANGE')
  })

  it('surfaces clipped displays and zero readings', () => {
    expect(combineOcrReadings({ ml: ml(''), seven: seven(null, 0, 'CLIPPED'), profile: profile() }).status).toBe('CLIPPED')
    expect(combineOcrReadings({ ml: ml('0.00 g'), seven: seven('0.00'), profile: profile() }).status).toBe('ZERO')
  })

  it('confidence below the minimum is LOW_CONFIDENCE with guidance', () => {
    const r = combineOcrReadings({ ml: ml('12.50 g', 0.6), seven: seven('12.50', 0.7), profile: profile() })
    expect(r.status).toBe('LOW_CONFIDENCE')
    expect(r.message).toMatch(/Move closer/)
  })
})

describe('mlTokenConfidence', () => {
  it('uses the weakest digit symbol of the matched token', () => {
    const reading = ml('1250.35 g', 0.99)
    reading.lines[0].elements![0].symbols![2].confidence = 0.4
    expect(mlTokenConfidence(reading, '1250.35')).toBe(0.4)
  })
})
