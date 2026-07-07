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
  if (k === 'metal_receipt') return 'Metal receipt'
  if (k === 'metal_payment') return 'Metal payment'
  return `${k.charAt(0).toUpperCase()}${k.slice(1)}`
}

function voucherActionTitle(notificationType: string, voucherType: string): string {
  const kind = voucherKindLabel(voucherType)
  const type = String(notificationType || '').trim().toLowerCase()

  if (type === 'voucher_submitted' || type === 'transaction_submitted') return `${kind} submitted`
  if (type === 'voucher_approved' || type === 'transaction_approved') return `${kind} approved`
  if (type === 'voucher_posted' || type === 'transaction_posted') return `${kind} posted`
  if (type === 'voucher_returned' || type === 'transaction_returned') return `${kind} returned`
  if (type === 'voucher_rejected' || type === 'transaction_rejected') return `${kind} rejected`
  if (type === 'jv_posted') return 'Journal posted'
  return ''
}

function fallbackVoucherMessage(data: Record<string, unknown>): string {
  const message = typeof data.message === 'string' ? data.message.trim() : ''
  if (message) return message

  const parts: string[] = []
  const vocNo = typeof data.vocNo === 'string' ? data.vocNo.trim() : ''
  const formattedAmount = typeof data.formattedAmount === 'string' ? data.formattedAmount.trim() : ''
  const partyLabel = typeof data.partyLabel === 'string' ? data.partyLabel.trim() : ''
  const debitAccountName = typeof data.debitAccountName === 'string' ? data.debitAccountName.trim() : ''
  const creditAccountName = typeof data.creditAccountName === 'string' ? data.creditAccountName.trim() : ''

  if (vocNo) parts.push(vocNo)
  if (formattedAmount) parts.push(formattedAmount)
  if (partyLabel) parts.push(partyLabel)
  if (debitAccountName && creditAccountName) parts.push(`${debitAccountName} → ${creditAccountName}`)
  else if (debitAccountName) parts.push(debitAccountName)
  else if (creditAccountName) parts.push(creditAccountName)

  return parts.join(' · ') || 'Notification received'
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

  const voucherTypes = new Set([
    'transaction_submitted',
    'transaction_approved',
    'transaction_posted',
    'transaction_returned',
    'transaction_rejected',
    'voucher_submitted',
    'voucher_approved',
    'voucher_posted',
    'voucher_returned',
    'voucher_rejected',
    'jv_posted',
  ])
  const isVoucherNotification = voucherTypes.has(type)

  let title: string
  if (isTxnMention) {
    title = 'Transaction chat mention'
  } else if (isChatMention) {
    title = 'Chat mention'
  } else if (isChatMessage) {
    const isDm = String(data.channelType || '') === 'dm'
    const who = senderName.trim() || 'Someone'
    title = isDm ? `Message from ${who}` : `Chat · ${room.trim() || 'Group'}`
  } else if (isVoucherNotification) {
    title = voucherActionTitle(type, txKind) || 'Voucher update'
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
  } else if (isVoucherNotification) {
    message = fallbackVoucherMessage(data)
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
