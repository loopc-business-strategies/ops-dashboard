import { describe, expect, it } from 'vitest'
import { toWeighProfile } from './cameraSettings'
import { OCR_SAMPLE_VERSION, buildOcrSample, bundleSamples, normalizeExpectedDisplay, samplesFromJson } from './ocrSamples'

const profile = toWeighProfile({
  scaleId: 'MG-GJ2000-01',
  unit: 'g',
  capacity: 2200,
  resolution: 0.01,
  captureMethods: ['CAMERA_OCR'],
  cameraOcr: { segmentThreshold: 0.35 },
})

function makeSample(expected: string | null) {
  return buildOcrSample({
    id: 'abc',
    capturedAt: new Date('2026-09-27T08:00:00.000Z'),
    profile,
    frame: { text: '1250.35 g', lines: [], gray: 'AAAA', width: 2, height: 1, processingMs: 12 },
    observed: { status: 'OK', displayWeight: 1250.35, confidence: 0.9, sevenText: '1250.35' },
    expected,
    note: 'x'.repeat(250),
  })
}

describe('normalizeExpectedDisplay', () => {
  it('accepts display digits and a decimal comma', () => {
    expect(normalizeExpectedDisplay(' 1250.35 ')).toBe('1250.35')
    expect(normalizeExpectedDisplay('1250,35')).toBe('1250.35')
    expect(normalizeExpectedDisplay('-12.5')).toBe('-12.5')
  })

  it('rejects anything that is not a plain number', () => {
    for (const raw of ['', '12.3.4', '1250 g', 'abc', '.5', '1e3']) expect(normalizeExpectedDisplay(raw)).toBeNull()
  })
})

describe('buildOcrSample', () => {
  it('captures the frame, the settings in force and caps the note', () => {
    const s = makeSample('1250.35')
    expect(s.version).toBe(OCR_SAMPLE_VERSION)
    expect(s.scaleId).toBe('MG-GJ2000-01')
    expect(s.settings.segmentThreshold).toBe(0.35)
    expect(s.ml).toEqual({ text: '1250.35 g', lines: [] })
    expect(s.note).toHaveLength(200)
    expect(s).not.toHaveProperty('processingMs')
  })
})

describe('samplesFromJson', () => {
  it('reads a single sample or a bundle and drops invalid entries', () => {
    const a = makeSample('1250.35')
    const b = makeSample(null)
    expect(samplesFromJson(a)).toEqual([a])
    const bundle = bundleSamples([a, b], new Date('2026-09-27T09:00:00.000Z'))
    expect(bundle.exportedAt).toBe('2026-09-27T09:00:00.000Z')
    expect(samplesFromJson(JSON.parse(JSON.stringify({ ...bundle, samples: [a, { bogus: true }, b] })))).toEqual([a, b])
    expect(samplesFromJson({ version: 99, samples: [a] })).toEqual([])
    expect(samplesFromJson(null)).toEqual([])
  })
})
