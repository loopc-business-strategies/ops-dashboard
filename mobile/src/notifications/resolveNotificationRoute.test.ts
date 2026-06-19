import { describe, expect, it } from 'vitest'
import { resolveMobileNotificationRoute } from './resolveNotificationRoute'
import type { AppNotificationItem } from './notificationMap'

const baseItem = (overrides: Partial<AppNotificationItem> = {}): AppNotificationItem => ({
  id: 'n1',
  title: 'Test',
  message: 'Body',
  createdAt: new Date(),
  read: false,
  type: '',
  data: {},
  ...overrides,
})

describe('resolveMobileNotificationRoute', () => {
  it('routes chat_message DM to chat screen', () => {
    const senderId = '507f1f77bcf86cd799439012'
    expect(resolveMobileNotificationRoute(baseItem({
      type: 'chat_message',
      data: { channelType: 'dm', senderId },
    }))).toEqual({ screen: 'chat', chatId: `d:${senderId}` })
  })

  it('routes voucher approval to ERP tab', () => {
    expect(resolveMobileNotificationRoute(baseItem({
      type: 'transaction_approved',
      data: { transactionId: '507f1f77bcf86cd799439099', type: 'payment' },
    }))).toEqual({ screen: 'erp' })
  })

  it('routes account balance alert to ERP tab', () => {
    expect(resolveMobileNotificationRoute(baseItem({
      type: 'account_balance_sign_changed',
      data: { accountCode: '1000' },
    }))).toEqual({ screen: 'erp' })
  })

  it('returns null for unknown notification types', () => {
    expect(resolveMobileNotificationRoute(baseItem({ type: 'report_digest' }))).toBeNull()
  })
})
