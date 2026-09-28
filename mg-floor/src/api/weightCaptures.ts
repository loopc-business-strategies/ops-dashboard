import { apiRequest, getAuthToken } from '@/src/api/client'
import { API_URL } from '@/src/config/env'
import { getTenant } from '@/src/config/tenant'

type SignalOpts = { signal?: AbortSignal }

export type WeightCaptureMethod = 'CAMERA_OCR' | 'MANUAL'

export type CreateWeightCaptureBody = {
  captureId: string
  scaleId: string
  weight: number
  unit: string
  captureMethod: WeightCaptureMethod
  ocrConfidence?: number | null
  ocrRawText?: string | null
  crossCheckAgreed?: boolean | null
  stable?: boolean
  stableFrames?: number | null
  reviewAcknowledged?: boolean
  manualReason?: string | null
  hasPhoto?: boolean
  deviceId?: string | null
  department?: string | null
  batchId?: string | null
  batchNumber?: string | null
  passId?: string | null
  capturedAt?: string | null
}

export type WeightCaptureRow = {
  captureId: string
  scaleId: string
  weight: number
  unit: string
  captureMethod: WeightCaptureMethod
  ocrConfidence?: number | null
  ocrRawText?: string
  crossCheckAgreed?: boolean | null
  overCapacityReview?: boolean
  manualReason?: string
  deviceId?: string
  department?: string
  employeeName?: string
  batchNumber?: string
  status: 'CONFIRMED' | 'CONSUMED'
  capturedAt?: string
  photo?: { status?: 'NONE' | 'PENDING' | 'UPLOADED' }
  consumedBy?: { operationType?: string; operationId?: string; at?: string } | null
}

export async function createWeightCapture(body: CreateWeightCaptureBody) {
  return apiRequest<{ success: boolean; reused?: boolean; capture: WeightCaptureRow }>(
    '/api/mg-floor/scale-camera-captures',
    { method: 'POST', body, retrySafeGet: false },
  )
}

export async function uploadWeightCapturePhoto(captureId: string, fileUri: string) {
  const form = new FormData()
  // React Native FormData accepts a { uri, name, type } file descriptor.
  form.append('photo', { uri: fileUri, name: `${captureId}.jpg`, type: 'image/jpeg' } as unknown as Blob)
  return apiRequest<{ success: boolean; reused?: boolean; captureId: string }>(
    `/api/mg-floor/scale-camera-captures/${encodeURIComponent(captureId)}/photo`,
    { method: 'POST', body: form, retrySafeGet: false },
  )
}

export async function fetchWeightCaptures(params?: Record<string, string | number>, opts?: SignalOpts) {
  return apiRequest<{ success: boolean; captures: WeightCaptureRow[]; total: number }>(
    '/api/mg-floor/scale-camera-captures',
    { params, signal: opts?.signal },
  )
}

/** Image source for an uploaded capture photo (authenticated, MG tenant headers). */
export function weightCapturePhotoSource(captureId: string) {
  const tenant = getTenant()
  const token = getAuthToken()
  return {
    uri: `${API_URL.replace(/\/$/, '')}/api/mg-floor/scale-camera-captures/${encodeURIComponent(captureId)}/photo`,
    headers: {
      'x-tenant': tenant,
      'x-company': tenant,
      'X-Client': 'mg-floor',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
}
