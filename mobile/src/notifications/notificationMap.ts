import type { NotificationPayload } from '@/src/realtime/notificationsSocket'

export type AppNotificationItem = {
  id: string
  title: string
  message: string
  createdAt: Date
  read: boolean
  type: string
  data: Record<string, unknown>
}

function voucherKindLabel(kind: string): string {
  const k = String(kind || '').trim().toLowerCase()
  if (!k) return 'Voucher'
  return `${k.charAt(0).toUpperCase()}${k.slice(1)}`
}

export function mapPayloadToItem(payload: NotificationPayload): AppNotificationItem {
  const data = (payload?.data || {}) as Record<string, unknown>
  const type = String(payload?.type || '').trim()
  const isTxnMention = type === 'transaction_chat_mention'
  const isChatMention = type === 'chat_mention'
  const isChatMessage = type === 'chat_message'
  const senderName = typeof data.senderName === 'string' ? data.senderName : ''
  const messageText = typeof data.message === 'string' ? data.message : ''
  const room = typeof data.room === 'string' ? data.room : ''
  const txKind = typeof data.type === 'string' ? data.type : ''

  let title: string
  if (isTxnMention) {
    title = 'Transaction chat mention'
  } else if (isChatMention) {
    title = 'Chat mention'
  } else if (isChatMessage) {
    const isDm = String(data.channelType || '') === 'dm'
    const who = senderName.trim() || 'Someone'
    title = isDm ? `Message from ${who}` : `Chat · ${room.trim() || 'Group'}`
  } else if (type === 'transaction_approved') {
    title = txKind ? `${voucherKindLabel(txKind)} approved` : 'Voucher approved'
  } else if (type === 'transaction_returned') {
    title = txKind ? `${voucherKindLabel(txKind)} returned` : 'Voucher returned'
  } else if (type === 'transaction_rejected') {
    title = txKind ? `${voucherKindLabel(txKind)} rejected` : 'Voucher rejected'
  } else if (type === 'account_balance_sign_changed') {
    title = 'Account crossed zero'
  } else {
    title = 'New notification'
  }

  let message: string
  if (isTxnMention || isChatMention) {
    message = `${senderName || 'Someone'} mentioned you${room ? ` in ${room}` : ''}: ${messageText || ''}`
  } else if (isChatMessage) {
    const isDm = String(data.channelType || '') === 'dm'
    const who = senderName.trim() || 'Someone'
    message = isDm ? (messageText || 'New direct message') : `${who}: ${messageText || 'New message'}`
  } else {
    message = messageText || type || 'Notification received'
  }

  return {
    id: `rt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    createdAt:
      payload?.timestamp instanceof Date
        ? payload.timestamp
        : new Date(payload?.timestamp ? String(payload.timestamp) : Date.now()),
    read: false,
    type,
    data,
  }
}
