const {
  buildCopy,
  buildExpoMessage,
  isLikelyExpoPushToken,
} = require('../services/expoPushNotifications')

describe('expoPushNotifications', () => {
  test('isLikelyExpoPushToken accepts Exponent and Expo token formats', () => {
    expect(isLikelyExpoPushToken('ExponentPushToken[abc]')).toBe(true)
    expect(isLikelyExpoPushToken('ExpoPushToken[abc]')).toBe(true)
    expect(isLikelyExpoPushToken('not-a-token')).toBe(false)
  })

  test('buildCopy formats chat messages', () => {
    const copy = buildCopy('chat_message', { senderName: 'Alex', message: 'Hello', channelType: 'dm' })
    expect(copy.title).toContain('Alex')
    expect(copy.body).toBe('Hello')
  })

  test('buildExpoMessage includes Android channel and high priority', () => {
    const message = buildExpoMessage(
      'ExponentPushToken[test]',
      'transaction_approved',
      { transactionId: '1' },
      'Voucher approved',
      'Your voucher was approved.',
    )
    expect(message.channelId).toBe('default')
    expect(message.priority).toBe('high')
    expect(message.data.type).toBe('transaction_approved')
  })
})
