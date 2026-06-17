const {
  mergeNotificationPreferences,
  isTopicEnabled,
  normalizeTopicKey,
} = require('../services/notificationPreferences')
const {
  setNotificationRealtimeServer,
  notifyUsers,
  buildVoucherNotificationData,
} = require('../services/notificationDispatch')

jest.mock('../models/User', () => ({
  getTenantModel: jest.fn(),
}))

const User = require('../models/User')

describe('notificationPreferences', () => {
  test('mergeNotificationPreferences defaults all topics on', () => {
    const merged = mergeNotificationPreferences({})
    expect(merged.topics.voucher_posted).toBe(true)
    expect(merged.reportDigest.timeLocal).toBe('08:00')
  })

  test('normalizeTopicKey maps legacy transaction types', () => {
    expect(normalizeTopicKey('transaction_posted')).toBe('voucher_posted')
  })

  test('isTopicEnabled returns false when topic disabled', () => {
    const prefs = mergeNotificationPreferences({ topics: { jv_posted: false } })
    expect(isTopicEnabled(prefs, 'jv_posted')).toBe(false)
    expect(isTopicEnabled(prefs, 'transaction_posted')).toBe(true)
  })
})

describe('notificationDispatch', () => {
  const sent = []

  beforeEach(() => {
    sent.length = 0
    setNotificationRealtimeServer({
      sendUserNotification(userId, type, data, tenant) {
        sent.push({ userId, type, data, tenant })
      },
    })
    User.getTenantModel.mockResolvedValue({
      find: () => ({
        select: () => ({
          lean: async () => [
            { _id: 'u1', notificationPreferences: { topics: { voucher_posted: true } }, isActive: true, isDeleted: false },
            { _id: 'u2', notificationPreferences: { topics: { voucher_posted: false } }, isActive: true, isDeleted: false },
          ],
        }),
      }),
    })
  })

  test('notifyUsers skips users with topic disabled', async () => {
    const result = await notifyUsers('mg', ['u1', 'u2'], 'voucher_posted', { message: 'Posted' })
    expect(result.sent).toBe(1)
    expect(result.skipped).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0].userId).toBe('u1')
  })

  test('buildVoucherNotificationData includes vocNo and amount', () => {
    const data = buildVoucherNotificationData({
      _id: 'tx1',
      type: 'payment',
      amount: 100,
      currency: 'USD',
      status: 'posted',
      voucherMeta: { vocNo: 'Pay/2026/0001', partyName: 'Acme' },
    }, { message: 'test' })
    expect(data.vocNo).toBe('Pay/2026/0001')
    expect(data.amount).toBe(100)
    expect(data.message).toBe('test')
  })
})
