import { resolveCameraOcrSettings, toWeighProfile, type CameraOcrSettings } from './cameraSettings'
import { base64ToBytes } from './imagePixels'
import { combineOcrReadings, type FrameReading } from './ocrCombine'
import type { OcrSample } from './ocrSamples'
import { decodeSevenSegment, type SevenSegmentResult } from './sevenSegment'

export type ReplayOutcome = {
  pass: boolean
  reason: string
  reading: FrameReading
  seven: SevenSegmentResult | null
}

/**
 * Re-run the seven-segment decode and the combine step on a saved frame. `overrides` lets candidate
 * settings (e.g. a new segmentThreshold) be scored against real samples before changing a scale.
 * A sample passes when it reads exactly the expected value, or — for `expected: null` — when it
 * produces nothing confirmable. A confirmable but wrong weight always fails.
 */
export function replayOcrSample(sample: OcrSample, overrides: Partial<CameraOcrSettings> = {}): ReplayOutcome {
  const settings = resolveCameraOcrSettings({ ...sample.settings, ...overrides })
  const profile = toWeighProfile({
    scaleId: sample.scaleId,
    unit: sample.profile.unit,
    capacity: sample.profile.capacity,
    resolution: sample.profile.resolution,
    captureMethods: ['CAMERA_OCR'],
    cameraOcr: settings,
  })
  const seven = settings.sevenSegmentCrossCheck
    ? decodeSevenSegment(base64ToBytes(sample.gray), sample.width, sample.height, {
      segmentThreshold: settings.segmentThreshold,
    })
    : null
  const reading = combineOcrReadings({ ml: sample.ml, seven, profile })
  const confirmable = (reading.status === 'OK' || reading.status === 'REVIEW') && reading.weight != null

  if (sample.expected === null) {
    return confirmable
      ? { pass: false, reason: `should not read, but confirmed ${reading.weight}`, reading, seven }
      : { pass: true, reason: `refused (${reading.status})`, reading, seven }
  }
  const expectedWeight = Number(sample.expected)
  if (!confirmable) {
    return { pass: false, reason: `expected ${sample.expected}, got ${reading.status}: ${reading.message}`, reading, seven }
  }
  if (Math.abs((reading.weight as number) - expectedWeight) > 1e-9) {
    return { pass: false, reason: `WRONG WEIGHT: expected ${sample.expected}, confirmed ${reading.weight}`, reading, seven }
  }
  return { pass: true, reason: `read ${sample.expected}`, reading, seven }
}
