import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import { getTenant, API_URL } from '@/src/config/tenant'

const trimApiSuffix = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

export function buildMetalRatesSocketUrl(): string {
  const base = trimApiSuffix(API_URL)
  return base ? `${base}/metal-rates` : '/metal-rates'
}

export type MetalRatesSocket = Socket

export type MetalRatesUpdatePayload = {
  rates?: Record<string, unknown>
  data?: { rates?: Record<string, unknown> }
}

export function createMetalRatesSocket(token: string, tenant: string): MetalRatesSocket {
  const tenantKey = tenant || getTenant()
  const transports =
    Platform.OS === 'web' ? (['websocket', 'polling'] as const) : (['polling', 'websocket'] as const)
  return io(buildMetalRatesSocketUrl(), {
    transports: [...transports],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1500,
    withCredentials: false,
    extraHeaders: {
      'x-tenant': tenantKey,
      'x-company': tenantKey,
      'X-Client': 'mobile',
    },
    auth: {
      token,
    },
  })
}

export function startMetalRatesRealtime({
  token,
  tenant,
  onRatesUpdate,
  onConnect,
  onDisconnect,
}: {
  token: string
  tenant: string
  onRatesUpdate: (payload: MetalRatesUpdatePayload) => void
  onConnect?: () => void
  onDisconnect?: () => void
}): () => void {
  const tenantKey = String(tenant || '').trim()
  if (!tenantKey || !token) return () => {}

  const socket = createMetalRatesSocket(token, tenantKey)

  socket.on('connect', () => {
    socket.emit('subscribe:tenant', tenantKey)
    onConnect?.()
  })

  socket.on('disconnect', () => {
    onDisconnect?.()
  })

  socket.on('metal-rates:update', onRatesUpdate)

  return () => {
    socket.off('metal-rates:update', onRatesUpdate)
    socket.off('connect')
    socket.off('disconnect')
    socket.disconnect()
    onDisconnect?.()
  }
}
