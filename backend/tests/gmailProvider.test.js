const {
  buildGmailQueryFromMessage,
  isGmailConfigured,
} = require('../services/email/gmailProvider')

describe('gmailProvider', () => {
  test('buildGmailQueryFromMessage adds unread and time filters', () => {
    const q = buildGmailQueryFromMessage('Check my unread email from last 24 hours')
    expect(q).toMatch(/is:unread/)
    expect(q).toMatch(/newer_than:1d/)
  })

  test('buildGmailQueryFromMessage extracts from filter', () => {
    const q = buildGmailQueryFromMessage('Any messages from acme@example.com this week?')
    expect(q).toMatch(/from:acme@example.com/)
    expect(q).toMatch(/newer_than:7d/)
  })

  test('isGmailConfigured reflects env vars', () => {
    const prevId = process.env.GOOGLE_CLIENT_ID
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET
    process.env.GOOGLE_CLIENT_ID = 'id'
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    expect(isGmailConfigured()).toBe(true)
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(isGmailConfigured()).toBe(false)
    process.env.GOOGLE_CLIENT_ID = prevId
    process.env.GOOGLE_CLIENT_SECRET = prevSecret
  })
})
