import { requireOptionalNativeModule } from 'expo'

export type OcrSymbol = { text: string; confidence: number }
export type OcrElement = { text: string; confidence: number; symbols: OcrSymbol[] }
export type OcrLine = {
  text: string
  confidence: number
  elements: OcrElement[]
  frame?: { left: number; top: number; width: number; height: number } | null
}
export type OcrResult = { text: string; lines: OcrLine[] }

/** OCR result for a cropped, contrast-enhanced frame plus its grayscale pixels (base64, 1 byte/pixel). */
export type ProcessedFrame = OcrResult & {
  gray: string
  width: number
  height: number
  processingMs: number
}

/** Crop rectangle normalized to 0..1 of the correctly oriented photo. */
export type NormalizedCrop = { x: number; y: number; width: number; height: number }

type ScaleOcrNative = {
  recognizeAsync(uri: string): Promise<OcrResult>
  processFrameAsync(
    uri: string,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
    targetWidth: number,
  ): Promise<ProcessedFrame>
}

const native = requireOptionalNativeModule<ScaleOcrNative>('ScaleOcr')

/** On-device ML Kit (Latin) text recognition. Android only; null elsewhere or when not linked. */
export function isScaleOcrAvailable() {
  return native != null
}

export async function recognizeText(uri: string): Promise<OcrResult> {
  if (!native) throw new Error('On-device OCR is not available on this device build')
  return native.recognizeAsync(uri)
}

export async function processFrame(uri: string, crop: NormalizedCrop, targetWidth = 480): Promise<ProcessedFrame> {
  if (!native) throw new Error('On-device OCR is not available on this device build')
  return native.processFrameAsync(uri, crop.x, crop.y, crop.width, crop.height, Math.round(targetWidth))
}
