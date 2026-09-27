import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import {
  type CaptureMethod,
  type ScaleWeighProfile,
  supportsCameraOcr,
  supportsDigital,
} from '@/src/scaleCamera/cameraSettings'
import type { CapturedWeight } from '@/src/scaleCamera/weightCaptureService'

export function availableCaptureMethods(profile: ScaleWeighProfile | null): CaptureMethod[] {
  const methods: CaptureMethod[] = []
  // Unknown profile (still loading / cached list without profiles) keeps the existing digital flow.
  if (!profile || supportsDigital(profile)) methods.push('DIGITAL_RS232')
  if (profile && supportsCameraOcr(profile)) methods.push('CAMERA_OCR')
  return methods.length ? methods : ['DIGITAL_RS232']
}

/**
 * Weight source for Metal IN/OUT: the existing digital stable capture plus single-photo camera OCR,
 * as enabled per scale. Exposes one `captured` value whatever method produced it.
 */
export function useWeightCapture(scaleId: string, profile: ScaleWeighProfile | null) {
  const digital = useStableScaleCapture(scaleId)
  const methods = useMemo(() => availableCaptureMethods(profile), [profile])
  const [method, setMethodState] = useState<CaptureMethod>(methods[0])
  const [recorded, setRecorded] = useState<CapturedWeight | null>(null)

  useEffect(() => {
    setRecorded(null)
  }, [scaleId])

  const methodsKey = methods.join(',')
  useEffect(() => {
    if (!methods.includes(method)) setMethodState(methods[0])
  }, [methodsKey])

  const { clearCapture: clearDigital } = digital
  const setMethod = useCallback(
    (next: CaptureMethod) => {
      if (next === method) return
      clearDigital()
      setRecorded(null)
      setMethodState(next)
    },
    [method, clearDigital],
  )

  const clearCapture = useCallback(() => {
    clearDigital()
    setRecorded(null)
  }, [clearDigital])

  const digitalCaptured = digital.captured
  const captured: CapturedWeight | null = useMemo(() => {
    if (method === 'DIGITAL_RS232') {
      if (!digitalCaptured?.scaleReadingId) return null
      return {
        method: 'DIGITAL_RS232',
        weight: digitalCaptured.weight,
        unit: digitalCaptured.unit,
        scaleId: digitalCaptured.scaleId,
        scaleReadingId: digitalCaptured.scaleReadingId,
        capturedAt: digitalCaptured.recordedAt || new Date().toISOString(),
      }
    }
    return recorded && recorded.method === method ? recorded : null
  }, [method, digitalCaptured, recorded])

  return {
    digital,
    profile,
    methods,
    method,
    setMethod,
    captured,
    hasCapture: Boolean(captured),
    clearCapture,
    setRecorded,
  }
}

export type WeightCaptureApi = ReturnType<typeof useWeightCapture>
