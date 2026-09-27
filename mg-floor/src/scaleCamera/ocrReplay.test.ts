import { describe, expect, it } from 'vitest'
import { renderSevenSegment } from './__testutils__/renderSevenSegment'
import { resolveCameraOcrSettings } from './cameraSettings'
import { bytesToBase64 } from './imagePixels'
import type { MlReading } from './ocrCombine'
import { replayOcrSample } from './ocrReplay'
import { OCR_SAMPLE_VERSION, type OcrSample } from './ocrSamples'

function mlFor(text: string, confidence = 0.95): MlReading {
  const token = text.split(' ')[0]
  return {
    text,
    lines: [{
      text,
      confidence,
      elements: [{ text: token, confidence, symbols: token.split('').map((ch) => ({ text: ch, confidence })) }],
    }],
  }
}

function sample(display: string, expected: string | null, mlText = `${display} g`): OcrSample {
  const { px, width, height } = renderSevenSegment(display)
  return {
    version: OCR_SAMPLE_VERSION,
    id: 's1',
    scaleId: 'MG-GJ2000-01',
    capturedAt: '2026-09-27T08:00:00.000Z',
    expected,
    note: '',
    profile: { unit: 'g', capacity: 2200, resolution: 0.01 },
    settings: resolveCameraOcrSettings({}),
    width,
    height,
    gray: bytesToBase64(px),
    ml: mlFor(mlText),
    observed: { status: 'OK', displayWeight: Number(display), confidence: 0.95, sevenText: display },
  }
}

describe('replayOcrSample', () => {
  it('passes when both engines read the expected display', () => {
    const r = replayOcrSample(sample('1250.35', '1250.35'))
    expect(r.pass).toBe(true)
    expect(r.seven?.text).toBe('1250.35')
    expect(r.reading.status).toBe('OK')
  })

  it('fails loudly when a confirmable reading has the wrong weight', () => {
    const r = replayOcrSample(sample('1250.35', '1250.36'))
    expect(r.pass).toBe(false)
    expect(r.reason).toMatch(/WRONG WEIGHT/)
  })

  it('fails a should-not-read sample that still confirms a weight', () => {
    const r = replayOcrSample(sample('1250.35', null))
    expect(r.pass).toBe(false)
  })

  it('passes a should-not-read sample when the engines disagree', () => {
    const r = replayOcrSample(sample('1250.35', null, '1250.85 g'))
    expect(r.pass).toBe(true)
    expect(r.reading.status).not.toBe('OK')
  })

  it('scores candidate settings through overrides', () => {
    const s = sample('1250.35', '1250.35')
    expect(replayOcrSample(s, { segmentThreshold: 0.45 }).pass).toBe(true)
    // At 0.6 the decoder refuses the 3, so the positive sample fails instead of mis-reading.
    const strict = replayOcrSample(s, { segmentThreshold: 0.6 })
    expect(strict.pass).toBe(false)
    expect(strict.reason).not.toMatch(/WRONG WEIGHT/)
  })
})
