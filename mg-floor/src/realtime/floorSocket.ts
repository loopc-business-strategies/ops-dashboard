import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/src/config/env'
import { getAuthToken } from '@/src/api/client'
import { getTenant } from '@/src/config/tenant'

export type SocketConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'ERROR'

type StatusListener = (status: SocketConnectionStatus, error?: string | null) => void

let socket: Socket | null = null
let refCount = 0
let connectionStatus: SocketConnectionStatus = 'DISCONNECTED'
let lastError: string | null = null
const statusListeners = new Set<StatusListener>()

function emitStatus(status: SocketConnectionStatus, error: string | null = null) {
  connectionStatus = status
  lastError = error
  statusListeners.forEach((fn) => {
    try {
      fn(status, error)
    } catch {
      // ignore
    }
  })
}

function attachSocketHandlers(s: Socket) {
  s.on('connect', () => emitStatus('CONNECTED', null))
  s.on('disconnect', () => emitStatus('DISCONNECTED', null))
  s.on('connect_error', (err) => emitStatus('ERROR', err?.message || 'Connection error'))
  s.io.on('reconnect_attempt', () => emitStatus('RECONNECTING', null))
  s.io.on('reconnect', () => emitStatus('CONNECTED', null))
  s.io.on('reconnect_failed', () => emitStatus('ERROR', 'Reconnect failed'))
}

function ensureSocket(): Socket | null {
  const token = getAuthToken()
  if (!token) {
    emitStatus('DISCONNECTED', 'Not signed in')
    return null
  }
  if (socket?.connected) return socket
  if (socket) return socket

  emitStatus('CONNECTING', null)
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    extraHeaders: { 'x-tenant': getTenant() },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })
  attachSocketHandlers(socket)
  return socket
}

export function acquireFloorSocket(): Socket | null {
  refCount += 1
  return ensureSocket()
}

export function releaseFloorSocket() {
  refCount = Math.max(0, refCount - 1)
  if (refCount === 0 && socket) {
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    socket = null
    emitStatus('DISCONNECTED', null)
  }
}

export function reconnectFloorSocket() {
  if (socket) {
    emitStatus('RECONNECTING', null)
    socket.connect()
    return socket
  }
  return ensureSocket()
}

export function getFloorSocketStatus() {
  return { status: connectionStatus, error: lastError }
}

export function subscribeFloorSocketStatus(listener: StatusListener) {
  statusListeners.add(listener)
  listener(connectionStatus, lastError)
  return () => {
    statusListeners.delete(listener)
  }
}

export function getFloorSocket() {
  return socket
}
