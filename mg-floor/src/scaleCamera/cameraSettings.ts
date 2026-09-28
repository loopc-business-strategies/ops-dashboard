export type CaptureMethod = 'DIGITAL_RS232' | 'CAMERA_OCR' | 'MANUAL'
export type ScaleCaptureMethod = 'DIGITAL_RS232' | 'CAMERA_OCR'
export type OverCapacityPolicy = 'REJECT' | 'REVIEW'

export type CameraOcrSettings = {
  enabled: boolean
  minConfidence: number
  consecutiveFrames: number
  stableDurationMs: number
  allowedVariation: number
  overCapacityPolicy: OverCapacityPolicy
  imageQuality: number
  sevenSegmentCrossCheck: boolean
  /** Share of a segment zone that must be lit for the segment to count as on. */
  segmentThreshold: number
  /** Guide box width ÷ height. */
  guideBoxAspect: number
  /** Guide box width as a fraction of the preview width. */
  guideBoxWidth: number
}

/** Mirrors backend/constants/mgFloorWeightCapture.js CAMERA_OCR_DEFAULTS. */
export const CAMERA_OCR_DEFAULTS: CameraOcrSettings = {
  enabled: true,
  minConfidence: 0.9,
  consecutiveFrames: 5,
  stableDurationMs: 1500,
  allowedVariation: 0.01,
  overCapacityPolicy: 'REJECT',
  imageQuality: 0.6,
  sevenSegmentCrossCheck: true,
  segmentThreshold: 0.3,
  guideBoxAspect: 3.2,
  guideBoxWidth: 0.72,
}

/** Above capacity × this ratio a reading is always out of range, even with the REVIEW policy. */
export const OVER_CAPACITY_HARD_LIMIT_RATIO = 1.1

/** Disagreeing OCR engines score ≤ 0.5, so the threshold can never be configured at or below that. */
export const MIN_CAMERA_OCR_CONFIDENCE = 0.6

/** Same bounds as backend deviceRegistry CAMERA_OCR_LIMITS (incl. CAMERA_OCR_TUNING_LIMITS). */
export const CAMERA_OCR_LIMITS = {
  minConfidence: [MIN_CAMERA_OCR_CONFIDENCE, 1],
  consecutiveFrames: [2, 30],
  stableDurationMs: [0, 30000],
  allowedVariation: [0, 100],
  imageQuality: [0.2, 1],
  segmentThreshold: [0.15, 0.6],
  guideBoxAspect: [2, 6],
  guideBoxWidth: [0.5, 0.9],
} as const

export type ScaleWeighProfile = {
  scaleId: string
  unit: string
  capacity: number | null
  resolution: number | null
  captureMethods: ScaleCaptureMethod[]
  cameraOcr: CameraOcrSettings
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function resolveCameraOcrSettings(raw?: Partial<CameraOcrSettings> | null): CameraOcrSettings {
  const src = raw || {}
  const d = CAMERA_OCR_DEFAULTS
  const L = CAMERA_OCR_LIMITS
  return {
    enabled: src.enabled == null ? d.enabled : Boolean(src.enabled),
    minConfidence: clampNumber(src.minConfidence, L.minConfidence[0], L.minConfidence[1], d.minConfidence),
    consecutiveFrames: Math.round(
      clampNumber(src.consecutiveFrames, L.consecutiveFrames[0], L.consecutiveFrames[1], d.consecutiveFrames),
    ),
    stableDurationMs: Math.round(
      clampNumber(src.stableDurationMs, L.stableDurationMs[0], L.stableDurationMs[1], d.stableDurationMs),
    ),
    allowedVariation: clampNumber(src.allowedVariation, L.allowedVariation[0], L.allowedVariation[1], d.allowedVariation),
    overCapacityPolicy: String(src.overCapacityPolicy || '').toUpperCase() === 'REVIEW' ? 'REVIEW' : 'REJECT',
    imageQuality: clampNumber(src.imageQuality, L.imageQuality[0], L.imageQuality[1], d.imageQuality),
    sevenSegmentCrossCheck:
      src.sevenSegmentCrossCheck == null ? d.sevenSegmentCrossCheck : Boolean(src.sevenSegmentCrossCheck),
    segmentThreshold: clampNumber(src.segmentThreshold, L.segmentThreshold[0], L.segmentThreshold[1], d.segmentThreshold),
    guideBoxAspect: clampNumber(src.guideBoxAspect, L.guideBoxAspect[0], L.guideBoxAspect[1], d.guideBoxAspect),
    guideBoxWidth: clampNumber(src.guideBoxWidth, L.guideBoxWidth[0], L.guideBoxWidth[1], d.guideBoxWidth),
  }
}

type RawScale = {
  scaleId?: string
  unit?: string | null
  capacity?: number | null
  resolution?: number | null
  captureMethods?: string[] | null
  cameraOcr?: Partial<CameraOcrSettings> | null
}

export function toWeighProfile(scale: RawScale): ScaleWeighProfile {
  const methods = (scale.captureMethods?.length ? scale.captureMethods : ['DIGITAL_RS232'])
    .map((m) => String(m).toUpperCase())
    .filter((m): m is ScaleCaptureMethod => m === 'DIGITAL_RS232' || m === 'CAMERA_OCR')
  const capacity = Number(scale.capacity)
  const resolution = Number(scale.resolution)
  return {
    scaleId: String(scale.scaleId || ''),
    unit: String(scale.unit || 'g'),
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    resolution: Number.isFinite(resolution) && resolution > 0 ? resolution : null,
    captureMethods: methods.length ? methods : ['DIGITAL_RS232'],
    cameraOcr: resolveCameraOcrSettings(scale.cameraOcr),
  }
}

/** Must match DEFAULT_CAMERA_SCALE in backend/constants/mgFloorWeightCapture.js (server creates it on first capture). */
export const DEFAULT_CAMERA_SCALE_ID = 'MG-CAMERA'

export const DEFAULT_CAMERA_SCALE_PROFILE: ScaleWeighProfile = toWeighProfile({
  scaleId: DEFAULT_CAMERA_SCALE_ID,
  unit: 'g',
  capacity: 2200,
  resolution: 0.01,
  captureMethods: ['CAMERA_OCR'],
})

export function supportsCameraOcr(profile: ScaleWeighProfile) {
  return profile.captureMethods.includes('CAMERA_OCR') && profile.cameraOcr.enabled
}

export function supportsDigital(profile: ScaleWeighProfile) {
  return profile.captureMethods.includes('DIGITAL_RS232')
}

/** Number of decimals implied by a resolution (0.01 → 2, 0.1 → 1, 1 → 0, 0.005 → 3). */
export function decimalsForResolution(resolution: number | null | undefined) {
  if (!resolution || !Number.isFinite(resolution) || resolution <= 0) return null
  for (let d = 0; d <= 6; d += 1) {
    const scaled = resolution * 10 ** d
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d
  }
  return 6
}

export function isMultipleOfResolution(weight: number, resolution: number | null | undefined) {
  if (!resolution) return true
  const steps = weight / resolution
  return Math.abs(steps - Math.round(steps)) < 1e-6
}

export type CapacityCheck =
  | { status: 'OK' }
  | { status: 'REVIEW'; message: string }
  | { status: 'OUT_OF_RANGE'; message: string }
  | { status: 'INVALID'; message: string }

export function checkWeightAgainstScale(
  weight: number,
  profile: Pick<ScaleWeighProfile, 'capacity' | 'resolution' | 'unit'> & { cameraOcr: Pick<CameraOcrSettings, 'overCapacityPolicy'> },
): CapacityCheck {
  if (!Number.isFinite(weight) || weight <= 0) {
    return { status: 'INVALID', message: 'Weight must be greater than zero' }
  }
  if (!isMultipleOfResolution(weight, profile.resolution)) {
    return { status: 'INVALID', message: `Weight does not match scale resolution ${profile.resolution} ${profile.unit}` }
  }
  const capacity = profile.capacity
  if (!capacity || weight <= capacity + 1e-9) return { status: 'OK' }
  if (profile.cameraOcr.overCapacityPolicy === 'REVIEW' && weight <= capacity * OVER_CAPACITY_HARD_LIMIT_RATIO + 1e-9) {
    return {
      status: 'REVIEW',
      message: `Above scale capacity ${capacity} ${profile.unit} — supervisor review required`,
    }
  }
  return { status: 'OUT_OF_RANGE', message: `Above scale capacity ${capacity} ${profile.unit}` }
}

export function formatWeight(weight: number, resolution: number | null | undefined) {
  const decimals = decimalsForResolution(resolution)
  return decimals == null ? String(weight) : weight.toFixed(decimals)
}
