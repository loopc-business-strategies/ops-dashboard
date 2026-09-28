import { describe, expect, it } from 'vitest'
import { CAMERA_OCR_DEFAULTS } from './cameraSettings'
import {
  evaluateStability,
  isFresh,
  MAX_READING_AGE_MS,
  type OcrFrame,
  pushFrame,
  stabilityConfigFor,
  stabilitySnapshot,
  stabilityStatus,
  stabilityTolerance,
  withinTolerance,
} from './weightStability'

const cfg = { consecutiveFrames: 5, stableDurationMs: 1500, allowedVariation: 0, minConfidence: 0.9 }

function frames(values: (number | null)[], stepMs = 400, confidence = 0.95): OcrFrame[] {
  return values.map((weight, i) => ({ weight, confidence, at: i * stepMs }))
}

describe('evaluateStability', () => {
  it('is stable after enough identical confident frames over the duration', () => {
    const s = evaluateStability(frames([1250.35, 1250.35, 1250.35, 1250.35, 1250.35]), cfg)
    expect(s).toMatchObject({ stable: true, reason: 'STABLE', weight: 1250.35, frames: 5, durationMs: 1600 })
  })

  it('needs the minimum duration as well as the frame count', () => {
    const s = evaluateStability(frames([10, 10, 10, 10, 10], 100), cfg)
    expect(s.stable).toBe(false)
    expect(s.reason).toBe('COLLECTING')
  })

  it('a changed value restarts the run', () => {
    const s = evaluateStability(frames([10, 10, 10, 10, 10.01]), cfg)
    expect(s).toMatchObject({ stable: false, reason: 'CHANGING', frames: 1 })
  })

  it('allowedVariation tolerates small jitter', () => {
    const s = evaluateStability(frames([10, 10.01, 10, 10.01, 10]), { ...cfg, allowedVariation: 0.01 })
    expect(s.stable).toBe(true)
  })

  it('a missing frame breaks the run', () => {
    const s = evaluateStability(frames([10, 10, 10, null, 10, 10]), cfg)
    expect(s.frames).toBe(2)
    expect(s.stable).toBe(false)
  })

  it('low confidence frames never count', () => {
    const list = frames([10, 10, 10, 10, 10, 10])
    list[5] = { ...list[5], confidence: 0.5 }
    expect(evaluateStability(list, cfg)).toMatchObject({ stable: false, reason: 'LOW_CONFIDENCE' })
  })

  it('reports the lowest confidence of the stable run', () => {
    const list = frames([10, 10, 10, 10, 10])
    list[2] = { ...list[2], confidence: 0.91 }
    expect(evaluateStability(list, cfg).confidence).toBe(0.91)
  })

  it('no frames → NO_READING', () => {
    expect(evaluateStability([], cfg).reason).toBe('NO_READING')
  })

  it('pushFrame keeps a bounded history', () => {
    let list: OcrFrame[] = []
    for (let i = 0; i < 10; i += 1) list = pushFrame(list, { weight: i, confidence: 1, at: i }, 4)
    expect(list.map((f) => f.weight)).toEqual([6, 7, 8, 9])
  })
})

/** GJ-2000 style profile: 0.01 g resolution; legacy scales still store allowedVariation 0. */
const legacyProfile = { resolution: 0.01, cameraOcr: { ...CAMERA_OCR_DEFAULTS, allowedVariation: 0 } }
const floorCfg = stabilityConfigFor(legacyProfile)

/** Background reads 400 ms apart, as the camera sampler produces them. */
function reads(values: (number | null)[], startAt = 0): OcrFrame[] {
  return values.map((weight, i) => ({ weight, confidence: weight == null ? 0 : 0.95, at: startAt + i * 400 }))
}

describe('floor stability (spec test cases)', () => {
  it('tolerance is at least the scale resolution', () => {
    expect(stabilityTolerance(legacyProfile)).toBe(0.01)
    expect(stabilityTolerance({ resolution: 0.01, cameraOcr: { ...CAMERA_OCR_DEFAULTS, allowedVariation: 0.05 } })).toBe(0.05)
    expect(CAMERA_OCR_DEFAULTS.allowedVariation).toBe(0.01)
  })

  it('TEST 1 — stable weight within ± one digit is STABLE', () => {
    const s = evaluateStability(reads([1250.2, 1250.2, 1250.21, 1250.2, 1250.19]), floorCfg)
    expect(s).toMatchObject({ stable: true, reason: 'STABLE', frames: 5, weight: 1250.2 })
    expect(stabilityStatus(s, (w) => `${w.toFixed(2)} g`)).toEqual({
      label: 'STABLE — 1250.20 g · CAPTURE READY',
      tone: 'ok',
      ready: true,
    })
  })

  it('TEST 2 — moving weight is NOT stable', () => {
    const s = evaluateStability(reads([1250.2, 1250.5, 1250.9, 1250.4, 1250.15]), floorCfg)
    expect(s.stable).toBe(false)
    expect(s.reason).toBe('CHANGING')
    expect(stabilityStatus(s, String).label).toBe('WEIGHT MOVING')
  })

  it('TEST 3 — an invalid OCR frame never counts toward stability', () => {
    const list = reads([1250.2, null, 1250.2, 1250.2, 1250.2])
    const s = evaluateStability(list, floorCfg)
    expect(s.stable).toBe(false)
    expect(s.frames).toBe(3)
    const recovered = [...list, ...reads([1250.2, 1250.2], 5 * 400)]
    expect(evaluateStability(recovered, floorCfg).stable).toBe(true)
  })

  it('TEST 4 — a sudden change resets the run and never reports the old weight', () => {
    const s = evaluateStability(reads([1250.2, 1250.2, 1250.2, 1270.2, 1270.2]), floorCfg)
    expect(s.stable).toBe(false)
    expect(s.frames).toBe(2)
    expect(s.weight).toBe(1270.2)
  })

  it('TEST 5 — after RETAKE the new session starts clean', () => {
    const before = reads([1250.2, 1250.2, 1250.2, 1250.2, 1250.2])
    expect(evaluateStability(before, floorCfg).stable).toBe(true)
    const afterRetake = pushFrame([], { weight: 1250.2, confidence: 0.95, at: 10_000 })
    const s = evaluateStability(afterRetake, floorCfg)
    expect(s).toMatchObject({ stable: false, frames: 1 })
    expect(stabilityStatus(s, String).ready).toBe(false)
    expect(stabilityStatus(null, String).label).toBe('WAITING FOR SCALE')
  })

  it('a single reading is never stable', () => {
    expect(evaluateStability(reads([1250.2]), floorCfg).stable).toBe(false)
  })

  it('stale readings cannot back a capture', () => {
    const list = reads([1250.2, 1250.2, 1250.2, 1250.2, 1250.2])
    const last = list[list.length - 1].at
    expect(isFresh(list, last + 200)).toBe(true)
    expect(isFresh(list, last + MAX_READING_AGE_MS + 1)).toBe(false)
    expect(isFresh([], last)).toBe(false)
  })

  it('a long gap between readings breaks the run', () => {
    const list = [...reads([1250.2, 1250.2, 1250.2]), ...reads([1250.2, 1250.2], 5000)]
    const s = evaluateStability(list, floorCfg)
    expect(s.stable).toBe(false)
    expect(s.frames).toBe(2)
  })

  it('snapshot records the run that proved stability', () => {
    const list = reads([1260, 1250.2, 1250.2, 1250.21, 1250.2, 1250.19])
    const s = evaluateStability(list, floorCfg)
    const snap = stabilitySnapshot(list, s, 0.01)
    expect(snap).toMatchObject({ stable: true, stableFrames: 5, durationMs: 1600, tolerance: 0.01, weight: 1250.2 })
    expect(snap.readings.map((r) => r.weight)).toEqual([1250.2, 1250.2, 1250.21, 1250.2, 1250.19])
    expect(snap.readings[0].offsetMs).toBe(0)
  })

  it('withinTolerance compares numerically, not as text', () => {
    expect(withinTolerance(1250.2, 1250.21, 0.01)).toBe(true)
    expect(withinTolerance(1250.2, 1250.22, 0.01)).toBe(false)
  })
})
