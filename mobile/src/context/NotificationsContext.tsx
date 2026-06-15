import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/src/context/AuthContext'
import {
  startUserNotificationsSocket,
  type NotificationPayload,
} from '@/src/realtime/notificationsSocket'

const MAX_ITEMS = 50

export type AppNotificationItem = {
  id: string
  title: string
  message: string
  createdAt: Date
  read: boolean
}

function mapPayloadToItem(payload: NotificationPayload): AppNotificationItem {
  const data = (payload?.data || {}) as Record<string, unknown>
  const type = String(payload?.type || '')
  const isTxnMention = type === 'transaction_chat_mention'
  const isChatMention = type === 'chat_mention'
  const senderName = typeof data.senderName === 'string' ? data.senderName : ''
  const messageText = typeof data.message === 'string' ? data.message : ''
  const room = typeof data.room === 'string' ? data.room : ''
  const title = isTxnMention
    ? 'Transaction chat mention'
    : isChatMention
      ? 'Chat mention'
      : type === 'chat_message'
        ? 'Team chat'
        : type === 'transaction_approved'
        ? 'Voucher approved'
        : type === 'transaction_returned'
          ? 'Voucher returned'
          : type === 'transaction_rejected'
            ? 'Voucher rejected'
            : 'New notification'
  const message = isTxnMention || isChatMention
    ? `${senderName || 'Someone'} mentioned you${room ? ` in ${room}` : ''}: ${messageText || ''}`
    : messageText || type || 'Notification received'
  return {
    id: `rt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    createdAt:
      payload?.timestamp instanceof Date
        ? payload.timestamp
        : new Date(payload?.timestamp ? String(payload.timestamp) : Date.now()),
    read: false,
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
  const [items, setItems] = useState<AppNotificationItem[]>([])

  useEffect(() => {
    if (!token || !user) {
      setItems([])
      return undefined
    }

    const stop = startUserNotificationsSocket(token, (payload: NotificationPayload) => {
      setItems((prev) => {
        const next = [mapPayloadToItem(payload), ...prev]
        return next.slice(0, MAX_ITEMS)
      })
    })

    return stop
  }, [token, user])

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
