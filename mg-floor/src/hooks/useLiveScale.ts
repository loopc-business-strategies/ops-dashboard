import { useCallback, useEffect, useState } from 'react'
import {
  acquireFloorSocket,
  releaseFloorSocket,
  reconnectFloorSocket,
  subscribeFloorSocketStatus,
  type SocketConnectionStatus,
} from '@/src/realtime/floorSocket'

export type LiveScaleReading = {
  scaleId: string
  weight: number | null
  stable: boolean
  status?: string
  timestamp?: string
}

export type LiveScaleState = {
  connectionStatus: SocketConnectionStatus
  lastReading: LiveScaleReading | null
  lastStableReading: LiveScaleReading | null
  lastReadingAt: string | null
  error: string | null
  /** @deprecated prefer lastReading.weight */
  weight: number | null
  /** @deprecated prefer lastReading.stable */
  stable: boolean | null
  scaleId: string | null
  reconnect: () => void
}

export function useLiveScale(scaleId: string | null): LiveScaleState {
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('DISCONNECTED')
  const [error, setError] = useState<string | null>(null)
  const [lastReading, setLastReading] = useState<LiveScaleReading | null>(null)
  const [lastStableReading, setLastStableReading] = useState<LiveScaleReading | null>(null)
  const [lastReadingAt, setLastReadingAt] = useState<string | null>(null)

  useEffect(() => {
    setLastReading(null)
    setLastStableReading(null)
    setLastReadingAt(null)
  }, [scaleId])

  useEffect(() => {
    if (!scaleId) {
      setConnectionStatus('DISCONNECTED')
      return
    }

    const sock = acquireFloorSocket()
    const unsubStatus = subscribeFloorSocketStatus((status, err) => {
      setConnectionStatus(status)
      setError(err || null)
    })

    const onReading = (payload: LiveScaleReading) => {
      if (String(payload.scaleId || '').toUpperCase() !== String(scaleId).toUpperCase()) return
      setLastReading(payload)
      setLastReadingAt(payload.timestamp || new Date().toISOString())
      if (payload.stable) setLastStableReading(payload)
    }

    sock?.on('mg-floor:scale', onReading)

    return () => {
      sock?.off('mg-floor:scale', onReading)
      unsubStatus()
      releaseFloorSocket()
    }
  }, [scaleId])

  const reconnect = useCallback(() => {
    reconnectFloorSocket()
  }, [])

  return {
    connectionStatus,
    lastReading,
    lastStableReading,
    lastReadingAt,
    error,
    weight: lastReading?.weight ?? null,
    stable: lastReading ? lastReading.stable : null,
    scaleId,
    reconnect,
  }
}
