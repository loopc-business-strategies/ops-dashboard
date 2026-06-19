import type { AppNotificationItem } from '@/src/notifications/notificationMap'

export type MobileNotificationRoute =
  | { screen: 'chat'; chatId: string }
  | { screen: 'erp'; account?: string; view?: string; erpSubTab?: string }
  | null

function resolveChatTargetId(data: Record<string, unknown>, type: string): string | null {
  if (type !== 'chat_message' && type !== 'chat_mention') return null

  const ch = String(data.channelType || '').toLowerCase()
  const isDm = ch === 'dm' || ch === 'direct'
  const isGroup = ch === 'group' || ch === 'channel'

  const senderId = String(data.senderId || '').trim()
  const groupId = String(data.groupId || '').trim()
  const room = String(data.room || '').trim()
  const department = String(data.department || '').trim()

  if (isDm) {
    return /^[a-f\d]{24}$/i.test(senderId) ? `d:${senderId}` : null
  }

  if (/^[a-f\d]{24}$/i.test(groupId)) return `g:${groupId}`

  if (isGroup) {
    const synthetic = room || department || 'Team'
    return `g:${synthetic}`
  }

  return null
}

/** Aligns with web Dashboard bell routing (`Dashboard.jsx` resolveRealtimeBellErpFields). */
export function resolveMobileNotificationRoute(item: AppNotificationItem): MobileNotificationRoute {
  const type = String(item.type || '').trim()
  const data = item.data || {}
  const txId = String(data.transactionId || '').trim()
  const validTx = /^[a-f\d]{24}$/i.test(txId)
  const accountCode = String(data.accountCode || '').trim()

  const chatId = resolveChatTargetId(data, type)
  if (chatId) return { screen: 'chat', chatId }

  if (type === 'transaction_chat_mention' && validTx) {
    return { screen: 'erp', erpSubTab: 'transactions' }
  }

  if (
    [
      'transaction_approved',
      'transaction_returned',
      'transaction_rejected',
      'voucher_approved',
      'voucher_returned',
      'voucher_rejected',
      'voucher_submitted',
      'voucher_posted',
      'transaction_submitted',
      'transaction_posted',
    ].includes(type)
    && validTx
  ) {
    return { screen: 'erp', erpSubTab: 'vouchers' }
  }

  if (type === 'account_balance_sign_changed' && accountCode) {
    return { screen: 'erp', erpSubTab: 'enquiry', account: accountCode }
  }

  return null
}
