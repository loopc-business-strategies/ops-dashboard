import React, { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/src/config/env'
import { getAuthToken } from '@/src/api/client'
import { getTenant } from '@/src/config/tenant'

export type LiveScaleReading = {
  scaleId: string
  weight: number | null
  stable: boolean
  status?: string
  timestamp?: string
}

export function useLiveScale(scaleId: string | null) {
  const [reading, setReading] = useState<LiveScaleReading | null>(null)

  useEffect(() => {
    if (!scaleId) return
    const token = getAuthToken()
    if (!token) return

    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      extraHeaders: { 'x-tenant': getTenant() },
    })

    socket.on('mg-floor:scale', (payload: LiveScaleReading) => {
      if (String(payload.scaleId).toUpperCase() === String(scaleId).toUpperCase()) {
        setReading(payload)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [scaleId])

  return reading
}
