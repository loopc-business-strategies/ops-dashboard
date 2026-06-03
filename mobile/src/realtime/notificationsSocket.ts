import { io, type Socket } from 'socket.io-client'
import { API_URL, TENANT } from '@/src/config/tenant'

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
export function createNotificationsSocket(token: string): NotificationSocket {
  return io(buildNotificationsSocketUrl(), {
    transports: ['websocket', 'polling'],
    extraHeaders: {
      'x-tenant': TENANT,
      'x-company': TENANT,
      'X-Client': 'mobile',
    },
    auth: {
      token,
    },
  })
}

export function startUserNotificationsSocket(
  token: string,
  onNotification: (payload: NotificationPayload) => void,
): () => void {
  const socket = createNotificationsSocket(token)
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
