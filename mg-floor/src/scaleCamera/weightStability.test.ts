import { describe, expect, it } from 'vitest'
import { evaluateStability, type OcrFrame, pushFrame } from './weightStability'

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
