import type { ProcessedFrame } from '@/modules/scale-ocr'
import type { CameraOcrSettings, ScaleWeighProfile } from './cameraSettings'
import type { FrameStatus, MlReading } from './ocrCombine'

export const OCR_SAMPLE_VERSION = 1

/**
 * One diagnostics frame saved on site: the processed grayscale crop, the ML Kit result and the
 * scale settings in force, plus what the display really showed. `expected: null` marks a frame that
 * must NOT produce a confirmable reading (glare, display half outside the box, …).
 */
export type OcrSample = {
  version: typeof OCR_SAMPLE_VERSION
  id: string
  scaleId: string
  capturedAt: string
  expected: string | null
  note: string
  profile: { unit: string; capacity: number | null; resolution: number | null }
  settings: CameraOcrSettings
  width: number
  height: number
  /** Grayscale pixels, base64, 1 byte per pixel (width × height). */
  gray: string
  ml: MlReading
  observed: { status: FrameStatus; displayWeight: number | null; confidence: number; sevenText: string | null }
}

export type OcrSampleBundle = { version: typeof OCR_SAMPLE_VERSION; exportedAt: string; samples: OcrSample[] }

/** Display text the operator typed ("1250.35"); digits with an optional single decimal point. */
export function normalizeExpectedDisplay(raw: string): string | null {
  const text = String(raw || '').trim().replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(text) ? text : null
}

export function buildOcrSample(input: {
  id: string
  capturedAt: Date
  profile: ScaleWeighProfile
  frame: ProcessedFrame
  observed: OcrSample['observed']
  expected: string | null
  note?: string
}): OcrSample {
  const { frame, profile } = input
  return {
    version: OCR_SAMPLE_VERSION,
    id: input.id,
    scaleId: profile.scaleId,
    capturedAt: input.capturedAt.toISOString(),
    expected: input.expected,
    note: String(input.note || '').slice(0, 200),
    profile: { unit: profile.unit, capacity: profile.capacity, resolution: profile.resolution },
    settings: profile.cameraOcr,
    width: frame.width,
    height: frame.height,
    gray: frame.gray,
    ml: { text: frame.text, lines: frame.lines },
    observed: input.observed,
  }
}

function isSample(value: unknown): value is OcrSample {
  const s = value as Partial<OcrSample> | null
  return Boolean(
    s
      && s.version === OCR_SAMPLE_VERSION
      && typeof s.gray === 'string'
      && Number.isInteger(s.width)
      && Number.isInteger(s.height)
      && s.ml
      && s.settings
      && s.profile
      && (s.expected === null || typeof s.expected === 'string'),
  )
}

/** Accepts a single exported sample or a bundle; anything else is ignored. */
export function samplesFromJson(json: unknown): OcrSample[] {
  if (isSample(json)) return [json]
  const bundle = json as Partial<OcrSampleBundle> | null
  if (bundle && bundle.version === OCR_SAMPLE_VERSION && Array.isArray(bundle.samples)) {
    return bundle.samples.filter(isSample)
  }
  return []
}

export function bundleSamples(samples: OcrSample[], exportedAt: Date): OcrSampleBundle {
  return { version: OCR_SAMPLE_VERSION, exportedAt: exportedAt.toISOString(), samples }
}
