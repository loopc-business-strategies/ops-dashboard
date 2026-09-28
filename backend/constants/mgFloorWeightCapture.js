/** Scale capture methods a registry entry can enable. */
const SCALE_CAPTURE_METHODS = ['DIGITAL_RS232', 'CAMERA_OCR']

/** Methods recorded on a FloorWeightCapture (DIGITAL_RS232 readings stay as HardwareEvent). */
const WEIGHT_CAPTURE_METHODS = ['CAMERA_OCR', 'MANUAL']

const OVER_CAPACITY_POLICIES = ['REJECT', 'REVIEW']

/** Readings where the OCR engines disagree are scored ≤ 0.5, so the threshold must stay above that. */
const MIN_CAMERA_OCR_CONFIDENCE = 0.6

const CAMERA_OCR_DEFAULTS = Object.freeze({
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
})

/** On-site decoder tuning bounds; none of these relax the confidence floor or the parser rules. */
const CAMERA_OCR_TUNING_LIMITS = Object.freeze({
  segmentThreshold: [0.15, 0.6],
  guideBoxAspect: [2, 6],
  guideBoxWidth: [0.5, 0.9],
})

/**
 * Built-in camera-only scale (GJ-2000 profile) the tablet uses when no camera scale is registered.
 * Created on its first capture; once it exists a manager's archive/disable is respected.
 */
const DEFAULT_CAMERA_SCALE = Object.freeze({
  scaleId: 'MG-CAMERA',
  name: 'Tablet camera (GJ-2000)',
  manufacturer: 'Shinko Denshi',
  model: 'GJ-2000',
  connectionType: 'CAMERA',
  captureMethods: ['CAMERA_OCR'],
  capacity: 2200,
  resolution: 0.01,
  unit: 'g',
})

module.exports = {
  DEFAULT_CAMERA_SCALE,
  SCALE_CAPTURE_METHODS,
  WEIGHT_CAPTURE_METHODS,
  OVER_CAPACITY_POLICIES,
  MIN_CAMERA_OCR_CONFIDENCE,
  CAMERA_OCR_DEFAULTS,
  CAMERA_OCR_TUNING_LIMITS,
}
