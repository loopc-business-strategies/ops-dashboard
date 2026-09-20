import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { captureStableReading } from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { useLiveScale } from '@/src/hooks/useLiveScale'

export type CapturedStableReading = {
  scaleReadingId: string
  scaleId: string
  weight: number
  unit: string
  recordedAt?: string
  gatewayId?: string
}

/**
 * Live scale + explicit CAPTURE STABLE → stableReadingId lock.
 * Operators cannot edit the captured weight; clear on scale change.
 */
export function useStableScaleCapture(scaleId: string) {
  const live = useLiveScale(scaleId || null)
  const [captured, setCaptured] = useState<CapturedStableReading | null>(null)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    setCaptured(null)
  }, [scaleId])

  const clearCapture = useCallback(() => {
    setCaptured(null)
  }, [])

  const captureStable = useCallback(async () => {
    if (!scaleId) {
      Alert.alert('Select a scale', 'Choose an authorized scale first.')
      return null
    }
    if (!live.lastReading?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Place material on the scale and wait until STABLE.')
      return null
    }
    setCapturing(true)
    try {
      const res = await captureStableReading(scaleId, live.weight)
      const row: CapturedStableReading = {
        scaleReadingId: String(res.scaleReadingId),
        scaleId: String(res.scaleId || scaleId),
        weight: Number(res.weight),
        unit: String(res.unit || 'g'),
        recordedAt: res.recordedAt ? String(res.recordedAt) : undefined,
        gatewayId: res.gatewayId ? String(res.gatewayId) : undefined,
      }
      setCaptured(row)
      Alert.alert('Captured', `Stable reading locked · ${row.weight.toFixed(2)} ${row.unit}`)
      return row
    } catch (err) {
      Alert.alert('Capture failed', userFacingMessage(err) || 'Unable to capture stable reading')
      return null
    } finally {
      setCapturing(false)
    }
  }, [scaleId, live.lastReading?.stable, live.weight])

  return {
    live,
    captured,
    capturing,
    captureStable,
    clearCapture,
    hasCapture: Boolean(captured?.scaleReadingId),
  }
}
