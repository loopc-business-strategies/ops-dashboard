jest.mock('../models/TenantEmailConnection', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
}))

jest.mock('../models/EmailConnection', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
}))

jest.mock('../services/email/gmailProvider', () => ({
  isGmailConfigured: jest.fn(() => true),
  buildGmailAuthUrl: jest.fn(),
  exchangeGmailCode: jest.fn(),
  refreshGmailAccessToken: jest.fn(),
  fetchGmailProfile: jest.fn(),
  listGmailMessages: jest.fn(),
  buildGmailQueryFromMessage: jest.fn(() => 'newer_than:7d'),
  GMAIL_READONLY_SCOPE: 'scope',
  getRedirectUri: jest.fn(),
  getTenantRedirectUri: jest.fn(),
}))

jest.mock('../utils/tokenEncryption', () => ({
  encryptToken: jest.fn((v) => `enc:${v}`),
  decryptToken: jest.fn((v) => String(v).replace(/^enc:/, '')),
  isTokenEncryptionConfigured: jest.fn(() => true),
}))

const TenantEmailConnection = require('../models/TenantEmailConnection')
const {
  getTenantConnectionStatus,
  saveTenantGmailConnection,
  fetchRecentInbox,
  clearFetchRateLimitForTests,
} = require('../services/email/emailInboxService')
const { fetchGmailProfile, listGmailMessages } = require('../services/email/gmailProvider')

function mockFindOneLean(result) {
  return { lean: jest.fn().mockResolvedValue(result) }
}

function mockFindOneSelectLean(result) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
    }),
  }
}

describe('tenant shared email inbox', () => {
  const superAdmin = { _id: 'admin1', role: 'super_admin', company: 'loopc' }
  const rep = { _id: 'rep1', role: 'department_user', company: 'loopc' }

  beforeEach(() => {
    clearFetchRateLimitForTests()
    jest.clearAllMocks()
    fetchGmailProfile.mockResolvedValue({ email: 'business@loopcstrategies.com' })
    TenantEmailConnection.findOne.mockReturnValue(mockFindOneLean(null))
  })

  test('getTenantConnectionStatus returns expected LoopC business email', async () => {
    const status = await getTenantConnectionStatus('loopc', superAdmin)
    expect(status.mode).toBe('tenant')
    expect(status.sharedInboxEnabled).toBe(true)
    expect(status.expectedEmail).toBe('business@loopcstrategies.com')
    expect(status.canManage).toBe(true)
    expect(status.connected).toBe(false)
  })

  test('non-admin cannot manage tenant inbox connect URL', async () => {
    const status = await getTenantConnectionStatus('loopc', rep)
    expect(status.canManage).toBe(false)
    expect(status.connectUrl).toBeNull()
  })

  test('saveTenantGmailConnection upserts tenant record', async () => {
    TenantEmailConnection.findOneAndUpdate.mockResolvedValue({})
    const email = await saveTenantGmailConnection(superAdmin, {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    }, 'loopc')
    expect(email).toBe('business@loopcstrategies.com')
    expect(TenantEmailConnection.findOneAndUpdate).toHaveBeenCalled()
  })

  test('fetchRecentInbox uses tenant connection for loopc', async () => {
    const future = new Date(Date.now() + 3600_000)
    TenantEmailConnection.findOne.mockReturnValue(mockFindOneSelectLean({
      _id: 't1',
      email: 'business@loopcstrategies.com',
      accessTokenEnc: 'enc:token',
      refreshTokenEnc: 'enc:refresh',
      expiresAt: future,
    }))
    listGmailMessages.mockResolvedValue([{
      id: 'm1',
      from: 'Client <client@acme.com>',
      subject: 'Quote',
      date: new Date().toISOString(),
      snippet: 'Please quote gold bars',
    }])

    const inbox = await fetchRecentInbox(rep, { tenantKey: 'loopc', userMessage: 'check email' })
    expect(inbox.email).toBe('business@loopcstrategies.com')
    expect(inbox.scope).toBe('tenant')
    expect(inbox.messages).toHaveLength(1)
  })
})
