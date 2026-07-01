jest.mock('../services/email/emailInboxService', () => ({
  getConnectionStatus: jest.fn(),
  fetchRecentInbox: jest.fn(),
  buildGmailQueryFromMessage: jest.fn(() => 'newer_than:1d'),
  getGmailTenantConnectStartUrl: jest.fn(() => 'https://api.example.com/api/email/oauth/gmail/tenant/start'),
  getGmailConnectStartUrl: jest.fn(() => 'https://api.example.com/api/email/oauth/gmail/start'),
}))

jest.mock('../services/email/gmailProvider', () => ({
  buildGmailQueryFromMessage: jest.fn(() => 'newer_than:1d'),
  resolveEmailFetchMaxResults: jest.fn(() => 15),
}))

const {
  getConnectionStatus,
  fetchRecentInbox,
} = require('../services/email/emailInboxService')
const { runEmailInboxAgent } = require('../services/salesAi/agents/emailInboxAgent')

describe('emailInboxAgent', () => {
  const user = { _id: 'user1', name: 'Nan', email: 'nan@loopc.com', role: 'super_admin' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns tenant connect required when company inbox is not connected', async () => {
    getConnectionStatus.mockResolvedValue({
      mode: 'tenant',
      connected: false,
      sharedInboxEnabled: true,
      expectedEmail: 'business@loopcstrategies.com',
      canManage: true,
      connectUrl: 'https://api.example.com/api/email/oauth/gmail/tenant/start',
    })

    const result = await runEmailInboxAgent(user, 'Check my email', 'loopc')
    expect(result.connectRequired).toBe(true)
    expect(result.tenantConnect).toBe(true)
    expect(result.expectedEmail).toBe('business@loopcstrategies.com')
    expect(fetchRecentInbox).not.toHaveBeenCalled()
  })

  test('returns inbox messages when tenant company inbox is connected', async () => {
    getConnectionStatus.mockResolvedValue({
      mode: 'tenant',
      connected: true,
      sharedInboxEnabled: true,
      expectedEmail: 'business@loopcstrategies.com',
      canManage: true,
    })
    fetchRecentInbox.mockResolvedValue({
      provider: 'gmail',
      email: 'business@loopcstrategies.com',
      query: 'newer_than:1d',
      scope: 'tenant',
      messages: [{
        id: '1',
        from: 'Client <client@acme.com>',
        subject: 'Quote request',
        date: new Date().toISOString(),
        snippet: 'Please send updated gold prices.',
      }],
    })

    const result = await runEmailInboxAgent(user, 'Check my email', 'loopc')
    expect(result.connectRequired).toBe(false)
    expect(result.tenantConnect).toBe(true)
    expect(result.messages).toHaveLength(1)
    expect(result.content).toMatch(/Company inbox/)
    expect(result.summary).toMatch(/sales-related|message/i)
  })
})
