import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  netFetch: vi.fn(),
  createWeightCapture: vi.fn(),
  uploadWeightCapturePhoto: vi.fn(),
  enqueueOutbox: vi.fn(),
  enqueueCapturePhoto: vi.fn(),
  saveCapturePhoto: vi.fn(),
  deleteCapturePhoto: vi.fn(),
}))

vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: mocks.netFetch } }))
vi.mock('@/src/api/errors', () => ({
  toApiError: (err: unknown) => (err && typeof err === 'object' ? err : { kind: 'UNKNOWN' }),
}))
vi.mock('@/src/api/weightCaptures', () => ({
  createWeightCapture: mocks.createWeightCapture,
  uploadWeightCapturePhoto: mocks.uploadWeightCapturePhoto,
}))
vi.mock('@/src/device/deviceIdentity', () => ({ getDeviceId: async () => 'device-1' }))
vi.mock('@/src/offline/outbox', () => ({ enqueueOutbox: mocks.enqueueOutbox }))
vi.mock('@/src/offline/photoQueue', () => ({ enqueueCapturePhoto: mocks.enqueueCapturePhoto }))
vi.mock('./capturePhoto', () => ({
  saveCapturePhoto: mocks.saveCapturePhoto,
  deleteCapturePhoto: mocks.deleteCapturePhoto,
}))

import { CAMERA_OCR_DEFAULTS, type ScaleWeighProfile } from './cameraSettings'
import { recordWeightCapture } from './weightCaptureService'
import type { StabilitySnapshot } from './weightStability'

const profile = {
  scaleId: 'MG-CAM-01',
  unit: 'g',
  resolution: 0.01,
  cameraOcr: { ...CAMERA_OCR_DEFAULTS },
} as unknown as ScaleWeighProfile

const stability: StabilitySnapshot = {
  stable: true,
  stableFrames: 5,
  durationMs: 1612.4,
  tolerance: 0.01,
  weight: 1250.2,
  readings: [
    { weight: 1250.2, confidence: 0.95, offsetMs: 0 },
    { weight: 1250.2, confidence: 0.96, offsetMs: 400 },
    { weight: 1250.21, confidence: 0.95, offsetMs: 800 },
    { weight: 1250.2, confidence: 0.97, offsetMs: 1200 },
    { weight: 1250.19, confidence: 0.95, offsetMs: 1612 },
  ],
}

const cameraInput = {
  captureId: 'wc_test_000001',
  method: 'CAMERA_OCR' as const,
  profile,
  weight: 1250.2,
  confidence: 0.95,
  rawText: '1250.20',
  crossCheckAgreed: true,
  stableFrames: 5,
  stability,
  frameUri: 'file:///frame.jpg',
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.saveCapturePhoto.mockResolvedValue('file:///saved.jpg')
})

describe('recordWeightCapture', () => {
  it('TEST 6 — offline: the confirmed capture and its photo go into the existing queues with stability data', async () => {
    mocks.netFetch.mockResolvedValue({ isConnected: false })
    const result = await recordWeightCapture(cameraInput)

    expect(result.queued).toBe(true)
    expect(mocks.createWeightCapture).not.toHaveBeenCalled()
    expect(mocks.enqueueOutbox).toHaveBeenCalledTimes(1)
    const op = mocks.enqueueOutbox.mock.calls[0][0]
    expect(op.operationId).toBe('wc_wc_test_000001')
    expect(op.payload).toMatchObject({
      captureMethod: 'CAMERA_OCR',
      stable: true,
      stableFrames: 5,
      stabilityDurationMs: 1612,
      stabilityTolerance: 0.01,
    })
    expect(op.payload.stabilityReadings).toHaveLength(5)
    expect(mocks.enqueueCapturePhoto).toHaveBeenCalledWith('wc_test_000001', 'file:///saved.jpg')
  })

  it('online: posts the stability metadata with the capture', async () => {
    mocks.netFetch.mockResolvedValue({ isConnected: true })
    mocks.createWeightCapture.mockResolvedValue({ success: true })
    mocks.uploadWeightCapturePhoto.mockResolvedValue({ success: true })
    await recordWeightCapture(cameraInput)

    const body = mocks.createWeightCapture.mock.calls[0][0]
    expect(body).toMatchObject({ stableFrames: 5, stabilityDurationMs: 1612, stabilityTolerance: 0.01 })
    expect(body.stabilityReadings[4]).toEqual({ weight: 1250.19, confidence: 0.95, offsetMs: 1612 })
  })

  it('manual entries carry no stability metadata', async () => {
    mocks.netFetch.mockResolvedValue({ isConnected: true })
    mocks.createWeightCapture.mockResolvedValue({ success: true })
    await recordWeightCapture({
      captureId: 'wc_test_000002',
      method: 'MANUAL',
      profile,
      weight: 12,
      manualReason: 'Scale display broken',
      stability,
    })
    const body = mocks.createWeightCapture.mock.calls[0][0]
    expect(body.stable).toBe(false)
    expect(body).not.toHaveProperty('stabilityReadings')
    expect(body).not.toHaveProperty('stabilityDurationMs')
  })
})
