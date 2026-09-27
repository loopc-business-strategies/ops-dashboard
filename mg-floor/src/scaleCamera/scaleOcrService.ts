import { isScaleOcrAvailable, processFrame, type ProcessedFrame } from '@/modules/scale-ocr'
import type { ScaleWeighProfile } from './cameraSettings'
import type { GuideBoxFraction, Rect } from './guideBox'
import { base64ToBytes } from './imagePixels'
import { combineOcrReadings, type FrameReading } from './ocrCombine'
import { decodeSevenSegment, type SevenSegmentResult } from './sevenSegment'

export const OCR_TARGET_WIDTH = 480

export function isCameraOcrSupported() {
  return isScaleOcrAvailable()
}

export function guideBoxFractionFor(profile: ScaleWeighProfile): GuideBoxFraction {
  return { width: profile.cameraOcr.guideBoxWidth, aspect: profile.cameraOcr.guideBoxAspect }
}

export type FrameOcrResult = FrameReading & { processingMs: number }

export type DetailedFrameOcrResult = FrameOcrResult & {
  frame: ProcessedFrame
  seven: SevenSegmentResult | null
}

/** Same pipeline as readScaleFrame, also returning the processed frame and decoder detail (diagnostics). */
export async function readScaleFrameDetailed(
  uri: string,
  crop: Rect,
  profile: ScaleWeighProfile,
): Promise<DetailedFrameOcrResult> {
  const started = Date.now()
  const frame = await processFrame(uri, crop, OCR_TARGET_WIDTH)
  const seven = profile.cameraOcr.sevenSegmentCrossCheck
    ? decodeSevenSegment(base64ToBytes(frame.gray), frame.width, frame.height, {
      segmentThreshold: profile.cameraOcr.segmentThreshold,
    })
    : null
  const reading = combineOcrReadings({ ml: frame, seven, profile })
  return { ...reading, processingMs: Date.now() - started, frame, seven }
}

/** Crop + enhance natively, run ML Kit, decode seven segments in JS, then combine. */
export async function readScaleFrame(uri: string, crop: Rect, profile: ScaleWeighProfile): Promise<FrameOcrResult> {
  const { frame: _frame, seven: _seven, ...result } = await readScaleFrameDetailed(uri, crop, profile)
  return result
}
