import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import {
  startUserNotificationsSocket,
  type NotificationPayload,
} from '@/src/realtime/notificationsSocket'
import { mapPayloadToItem, type AppNotificationItem } from '@/src/notifications/notificationMap'

export type { AppNotificationItem }

const MAX_ITEMS = 50

function normalizePushData(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

/** Map Expo push / response payload to the same shape as Socket.IO `notification` events. */
export function expoNotificationToPayload(n: Notifications.Notification): NotificationPayload {
  const content = n.request?.content
  const data = normalizePushData(content?.data)
  const topType = String(data.type || '').trim()
  const body = String(content?.body || '').trim()
  const merged: Record<string, unknown> = { ...data }
  if (body && typeof merged.message !== 'string') merged.message = body
  return {
    type: topType,
    timestamp: new Date(n.date),
    data: merged,
  }
}

type NotificationsContextValue = {
  items: AppNotificationItem[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const { companyCode } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const [items, setItems] = useState<AppNotificationItem[]>([])
  const seenPushIdsRef = useRef<Set<string>>(new Set())
  const pushBootstrapRef = useRef(false)

  const appendPayload = useCallback((payload: NotificationPayload) => {
    setItems((prev) => {
      const next = [mapPayloadToItem(payload), ...prev]
      return next.slice(0, MAX_ITEMS)
    })
  }, [])

  useEffect(() => {
    if (!token || !user || !sessionReady) {
      setItems([])
      return undefined
    }

    const stop = startUserNotificationsSocket(token, companyCode, (payload: NotificationPayload) => {
      appendPayload(payload)
    })

    return stop
  }, [token, user, sessionReady, companyCode, appendPayload])

  /** OS push (e.g. voucher approved) also appears in the header bell — same as web bell + badge. */
  useEffect(() => {
    if (!token || !user || !sessionReady) return undefined

    const ingestExpo = (n: Notifications.Notification, dedupePrefix: string) => {
      const id = `${dedupePrefix}:${n.request.identifier}`
      if (seenPushIdsRef.current.has(id)) return
      seenPushIdsRef.current.add(id)
      if (seenPushIdsRef.current.size > 120) seenPushIdsRef.current.clear()
      appendPayload(expoNotificationToPayload(n))
    }

    const subReceived = Notifications.addNotificationReceivedListener((notification) => {
      ingestExpo(notification, 'recv')
    })

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      ingestExpo(response.notification, 'resp')
    })

    if (Platform.OS !== 'web' && !pushBootstrapRef.current) {
      pushBootstrapRef.current = true
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response?.notification) return
        ingestExpo(response.notification, 'cold')
      })
    }

    return () => {
      subReceived.remove()
      subResponse.remove()
    }
  }, [token, user, sessionReady, companyCode, appendPayload])

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      markRead,
      markAllRead,
    }),
    [items, unreadCount, markRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}
