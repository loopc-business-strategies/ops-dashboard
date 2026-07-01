jest.mock('../services/email/emailInboxService', () => ({
  getConnectionStatus: jest.fn(),
  fetchRecentInbox: jest.fn(),
  buildGmailQueryFromMessage: jest.fn(() => 'newer_than:1d'),
}))

const {
  getConnectionStatus,
  fetchRecentInbox,
} = require('../services/email/emailInboxService')
const { runEmailInboxAgent } = require('../services/salesAi/agents/emailInboxAgent')

describe('emailInboxAgent', () => {
  const user = { _id: 'user1', name: 'Nan', email: 'nan@loopc.com' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns connect required when Gmail is not connected', async () => {
    getConnectionStatus.mockResolvedValue({
      connected: false,
      connectUrl: 'https://api.example.com/api/email/oauth/gmail/start',
    })

    const result = await runEmailInboxAgent(user, 'Check my email')
    expect(result.connectRequired).toBe(true)
    expect(result.connectUrl).toMatch(/gmail\/start/)
    expect(fetchRecentInbox).not.toHaveBeenCalled()
  })

  test('returns inbox messages when connected', async () => {
    getConnectionStatus.mockResolvedValue({ connected: true, address: 'nan@loopc.com' })
    fetchRecentInbox.mockResolvedValue({
      provider: 'gmail',
      email: 'nan@loopc.com',
      query: 'newer_than:1d',
      messages: [{
        id: '1',
        from: 'Client <client@acme.com>',
        subject: 'Quote request',
        date: new Date().toISOString(),
        snippet: 'Please send updated gold prices.',
      }],
    })

    const result = await runEmailInboxAgent(user, 'Check my email')
    expect(result.connectRequired).toBe(false)
    expect(result.messages).toHaveLength(1)
    expect(result.content).toMatch(/Quote request/)
  })
})
