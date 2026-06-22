import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import { API_URL, getTenant } from '@/src/config/tenant'

const trimApiSuffix = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

/** Same base resolution as web `realtimeSocket.js` — namespace path is appended to API origin. */
export function buildNotificationsSocketUrl(): string {
  const base = trimApiSuffix(API_URL)
  return base ? `${base}/notifications` : '/notifications'
}

export type NotificationSocket = Socket

/**
 * Connect to Socket.IO `/notifications` with JWT (mirrors web `startUserNotifications`).
 * Sends tenant headers when supported (native may ignore `extraHeaders` on some transports).
 */
export function createNotificationsSocket(token: string, tenant: string): NotificationSocket {
  const tenantKey = tenant || getTenant()
  // RN: prefer polling first — some Android networks/OEMs block or mishandle WSS before TLS is stable.
  const transports =
    Platform.OS === 'web' ? (['websocket', 'polling'] as const) : (['polling', 'websocket'] as const)
  return io(buildNotificationsSocketUrl(), {
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

export function startUserNotificationsSocket(
  token: string,
  tenant: string,
  onNotification: (payload: NotificationPayload) => void,
): () => void {
  const socket = createNotificationsSocket(token, tenant)
  socket.on('notification', onNotification)
  return () => {
    socket.off('notification', onNotification)
    socket.disconnect()
  }
}

/** Payload shape from `RealtimeServer.sendUserNotification` */
export type NotificationPayload = {
  type?: string
  timestamp?: string | Date
  data?: Record<string, unknown>
}
