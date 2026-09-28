import NetInfo from '@react-native-community/netinfo'
import { toApiError } from '@/src/api/errors'
import {
  createWeightCapture,
  uploadWeightCapturePhoto,
  type CreateWeightCaptureBody,
} from '@/src/api/weightCaptures'
import { getDeviceId } from '@/src/device/deviceIdentity'
import { enqueueOutbox } from '@/src/offline/outbox'
import { enqueueCapturePhoto } from '@/src/offline/photoQueue'
import type { CaptureMethod, ScaleWeighProfile } from './cameraSettings'
import { deleteCapturePhoto, saveCapturePhoto } from './capturePhoto'

/** Weight locked for a Metal IN/OUT submission, whatever method produced it. */
export type CapturedWeight = {
  method: CaptureMethod
  weight: number
  unit: string
  scaleId: string
  /** DIGITAL_RS232 only — HardwareEvent id from capture-stable. */
  scaleReadingId?: string
  /** CAMERA_OCR / MANUAL — FloorWeightCapture id. */
  weightCaptureId?: string
  confidence?: number | null
  /** Capture record is waiting in the offline outbox. */
  queued?: boolean
  capturedAt: string
}

export type CaptureContext = {
  department?: string | null
  batchId?: string | null
  batchNumber?: string | null
  passId?: string | null
}

export type RecordWeightCaptureInput = {
  captureId: string
  method: 'CAMERA_OCR' | 'MANUAL'
  profile: ScaleWeighProfile
  weight: number
  confidence?: number | null
  rawText?: string | null
  crossCheckAgreed?: boolean | null
  stableFrames?: number | null
  reviewAcknowledged?: boolean
  manualReason?: string | null
  frameUri?: string | null
  context?: CaptureContext
}

const OBJECT_ID = /^[a-f0-9]{24}$/i

function optionalObjectId(value?: string | null) {
  const v = String(value || '').trim()
  return OBJECT_ID.test(v) ? v : null
}

function isTransient(kind: string) {
  return kind === 'NETWORK_ERROR' || kind === 'TIMEOUT' || kind === 'SERVER_ERROR' || kind === 'OFFLINE'
}

/**
 * Persist a confirmed camera/manual reading as a FloorWeightCapture: compress the frame photo,
 * POST the record (or queue it in the outbox when offline), then upload/queue the photo.
 * Reusing the same captureId on retry is idempotent server-side.
 */
export async function recordWeightCapture(input: RecordWeightCaptureInput): Promise<CapturedWeight> {
  const { profile, context = {} } = input
  const capturedAt = new Date().toISOString()
  const deviceId = await getDeviceId().catch(() => '')

  let photoUri: string | null = null
  if (input.frameUri) {
    photoUri = await saveCapturePhoto(input.frameUri, input.captureId, profile.cameraOcr.imageQuality)
  }

  const body: CreateWeightCaptureBody = {
    captureId: input.captureId,
    scaleId: profile.scaleId,
    weight: input.weight,
    unit: profile.unit,
    captureMethod: input.method,
    ocrConfidence: input.method === 'CAMERA_OCR' ? input.confidence ?? null : null,
    ocrRawText: input.rawText ? String(input.rawText).slice(0, 64) : null,
    crossCheckAgreed: input.crossCheckAgreed ?? null,
    stable: input.method === 'CAMERA_OCR',
    stableFrames: input.stableFrames ?? null,
    reviewAcknowledged: Boolean(input.reviewAcknowledged),
    manualReason: input.method === 'MANUAL' ? input.manualReason || null : null,
    hasPhoto: Boolean(photoUri),
    deviceId: deviceId || null,
    department: context.department || null,
    batchId: optionalObjectId(context.batchId),
    batchNumber: context.batchNumber || null,
    passId: optionalObjectId(context.passId),
    capturedAt,
  }

  const result: CapturedWeight = {
    method: input.method,
    weight: input.weight,
    unit: profile.unit,
    scaleId: profile.scaleId,
    weightCaptureId: input.captureId,
    confidence: body.ocrConfidence ?? null,
    capturedAt,
  }

  const queueOffline = async () => {
    await enqueueOutbox({
      operationId: `wc_${input.captureId}`,
      operationType: 'weight_capture',
      payload: body as unknown as Record<string, unknown>,
      deviceId: deviceId || undefined,
      scaleId: profile.scaleId,
    })
    if (photoUri) await enqueueCapturePhoto(input.captureId, photoUri)
    return { ...result, queued: true }
  }

  const net = await NetInfo.fetch().catch(() => null)
  if (net && net.isConnected === false) return queueOffline()

  try {
    await createWeightCapture(body)
  } catch (err) {
    const e = toApiError(err)
    if (isTransient(e.kind)) return queueOffline()
    if (photoUri) deleteCapturePhoto(photoUri)
    throw e
  }

  if (photoUri) {
    try {
      await uploadWeightCapturePhoto(input.captureId, photoUri)
      deleteCapturePhoto(photoUri)
    } catch {
      await enqueueCapturePhoto(input.captureId, photoUri)
    }
  }
  return result
}

/** Metal IN/OUT payload fields that reference the weight source. */
export function weightSourcePayload(captured: CapturedWeight): Record<string, string> {
  if (captured.method === 'DIGITAL_RS232') {
    return captured.scaleReadingId ? { stableReadingId: captured.scaleReadingId } : {}
  }
  return captured.weightCaptureId ? { weightCaptureId: captured.weightCaptureId } : {}
}

export function captureMethodLabel(method: CaptureMethod) {
  if (method === 'DIGITAL_RS232') return 'DIGITAL SCALE'
  if (method === 'CAMERA_OCR') return 'SCALE CAMERA'
  return 'MANUAL'
}
