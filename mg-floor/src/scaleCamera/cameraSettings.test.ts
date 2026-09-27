import { describe, expect, it } from 'vitest'
import {
  CAMERA_OCR_DEFAULTS,
  checkWeightAgainstScale,
  decimalsForResolution,
  formatWeight,
  resolveCameraOcrSettings,
  toWeighProfile,
} from './cameraSettings'

const gj = (policy: 'REJECT' | 'REVIEW' = 'REJECT') =>
  toWeighProfile({
    scaleId: 'MG-GJ-01',
    unit: 'g',
    capacity: 2200,
    resolution: 0.01,
    captureMethods: ['CAMERA_OCR'],
    cameraOcr: { overCapacityPolicy: policy },
  })

describe('camera OCR settings', () => {
  it('fills defaults and clamps out-of-range values', () => {
    expect(resolveCameraOcrSettings(null)).toEqual(CAMERA_OCR_DEFAULTS)
    const s = resolveCameraOcrSettings({ minConfidence: 0.2, consecutiveFrames: 99 })
    expect(s.minConfidence).toBe(0.6)
    expect(s.consecutiveFrames).toBe(30)
  })

  it('clamps decoder tuning to its bounds', () => {
    const s = resolveCameraOcrSettings({ segmentThreshold: 0.05, guideBoxAspect: 9, guideBoxWidth: 0.1 })
    expect(s.segmentThreshold).toBe(0.15)
    expect(s.guideBoxAspect).toBe(6)
    expect(s.guideBoxWidth).toBe(0.5)
    const ok = resolveCameraOcrSettings({ segmentThreshold: 0.35, guideBoxAspect: 4, guideBoxWidth: 0.8 })
    expect([ok.segmentThreshold, ok.guideBoxAspect, ok.guideBoxWidth]).toEqual([0.35, 4, 0.8])
  })

  it('derives decimals from resolution', () => {
    expect(decimalsForResolution(0.01)).toBe(2)
    expect(decimalsForResolution(0.1)).toBe(1)
    expect(decimalsForResolution(1)).toBe(0)
    expect(decimalsForResolution(0.005)).toBe(3)
    expect(decimalsForResolution(null)).toBeNull()
    expect(formatWeight(12.5, 0.01)).toBe('12.50')
  })

  it('profile defaults to digital when methods are missing', () => {
    expect(toWeighProfile({ scaleId: 'X' }).captureMethods).toEqual(['DIGITAL_RS232'])
  })
})

describe('checkWeightAgainstScale (GJ-2000, 2200 g)', () => {
  it('2200.00 is valid', () => {
    expect(checkWeightAgainstScale(2200, gj()).status).toBe('OK')
  })

  it('2200.01 is rejected under REJECT and needs review under REVIEW', () => {
    expect(checkWeightAgainstScale(2200.01, gj('REJECT')).status).toBe('OUT_OF_RANGE')
    expect(checkWeightAgainstScale(2200.01, gj('REVIEW')).status).toBe('REVIEW')
  })

  it('2500 is always invalid', () => {
    expect(checkWeightAgainstScale(2500, gj('REJECT')).status).toBe('OUT_OF_RANGE')
    expect(checkWeightAgainstScale(2500, gj('REVIEW')).status).toBe('OUT_OF_RANGE')
  })

  it('rejects zero and off-resolution values', () => {
    expect(checkWeightAgainstScale(0, gj()).status).toBe('INVALID')
    expect(checkWeightAgainstScale(12.345, gj()).status).toBe('INVALID')
  })
})
