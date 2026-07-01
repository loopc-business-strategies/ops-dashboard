const crypto = require('crypto')
const EmailConnection = require('../../models/EmailConnection')
const { encryptToken, decryptToken, isTokenEncryptionConfigured } = require('../../utils/tokenEncryption')
const { normalizeEmailMessage } = require('./emailProviderTypes')
const {
  isGmailConfigured,
  buildGmailAuthUrl,
  exchangeGmailCode,
  refreshGmailAccessToken,
  fetchGmailProfile,
  listGmailMessages,
  buildGmailQueryFromMessage,
  GMAIL_READONLY_SCOPE,
} = require('./gmailProvider')

const fetchRateMap = new Map()
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

function getOAuthStateSecret() {
  return String(
    process.env.EMAIL_OAUTH_STATE_SECRET
    || process.env.EMAIL_TOKEN_ENCRYPTION_KEY
    || process.env.JWT_SECRET
    || 'dev-email-oauth-state',
  )
}

function buildOAuthState(userId, tenant) {
  const payload = {
    userId: String(userId),
    tenant: String(tenant || 'loopc'),
    ts: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

function parseOAuthState(state) {
  const raw = String(state || '')
  const [body, sig] = raw.split('.')
  if (!body || !sig) throw new Error('Invalid OAuth state.')
  const expected = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url')
  if (sig !== expected) throw new Error('Invalid OAuth state signature.')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (Date.now() - Number(payload.ts) > OAUTH_STATE_TTL_MS) throw new Error('OAuth state expired.')
  return payload
}

function getFetchRateLimit() {
  return Number(process.env.EMAIL_FETCH_RATE_LIMIT || 10)
}

function checkFetchRateLimit(userId) {
  const key = String(userId)
  const windowMs = 60 * 60 * 1000
  const max = getFetchRateLimit()
  const now = Date.now()
  const entry = fetchRateMap.get(key) || { count: 0, resetAt: now + windowMs }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }
  if (entry.count >= max) {
    const err = new Error('Email fetch rate limit exceeded. Try again later.')
    err.statusCode = 429
    throw err
  }
  entry.count += 1
  fetchRateMap.set(key, entry)
}

function getFrontendRedirectUrl(tenant = 'loopc', query = '') {
  const raw = String(process.env.CLIENT_URLS || process.env.CLIENT_URL || '').split(',')
  const origins = raw.map((o) => o.trim()).filter(Boolean)
  const match = origins.find((o) => o.includes(`${tenant}.`)) || origins[0]
  const base = match || `https://${tenant}.loopcstrategies.com`
  return `${base.replace(/\/$/, '')}/dashboard${query ? `?${query}` : ''}`
}

function getGmailConnectStartPath() {
  return '/api/email/oauth/gmail/start'
}

function getGmailConnectStartUrl() {
  const api = String(process.env.API_PUBLIC_URL || 'https://api.loopcstrategies.com').replace(/\/$/, '')
  return `${api}${getGmailConnectStartPath()}`
}

async function getConnectionRecord(user) {
  if (!user?._id) return null
  return EmailConnection.findOne({ userId: user._id, provider: 'gmail' })
    .select('+accessTokenEnc +refreshTokenEnc')
    .lean()
}

async function getConnectionStatus(user) {
  const gmailConfigured = isGmailConfigured() && isTokenEncryptionConfigured()
  const record = user?._id
    ? await EmailConnection.findOne({ userId: user._id, provider: 'gmail' }).lean()
    : null
  return {
    gmailConfigured,
    connected: Boolean(record?.email),
    provider: record?.provider || null,
    address: record?.email || null,
    connectUrl: gmailConfigured ? getGmailConnectStartUrl() : null,
  }
}

async function saveGmailConnection(user, tokens) {
  if (!isTokenEncryptionConfigured()) {
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY is not configured on the server.')
  }
  const profile = await fetchGmailProfile(tokens.accessToken)
  const expiresAt = new Date(Date.now() + (Number(tokens.expiresIn) || 3600) * 1000)
  const doc = {
    userId: user._id,
    provider: 'gmail',
    email: profile.email || user.email || '',
    scopes: [GMAIL_READONLY_SCOPE],
    accessTokenEnc: encryptToken(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : '',
    expiresAt,
    connectedAt: new Date(),
  }
  await EmailConnection.findOneAndUpdate(
    { userId: user._id, provider: 'gmail' },
    doc,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return profile.email
}

async function getValidAccessToken(record) {
  let accessToken = decryptToken(record.accessTokenEnc)
  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0
  if (expiresAt > Date.now() + 60_000) return accessToken

  if (!record.refreshTokenEnc) throw new Error('Gmail connection expired. Please reconnect.')
  const refreshed = await refreshGmailAccessToken(decryptToken(record.refreshTokenEnc))
  accessToken = refreshed.accessToken
  await EmailConnection.updateOne(
    { _id: record._id },
    {
      accessTokenEnc: encryptToken(refreshed.accessToken),
      expiresAt: new Date(Date.now() + (Number(refreshed.expiresIn) || 3600) * 1000),
    },
  )
  return accessToken
}

async function fetchRecentInbox(user, options = {}) {
  checkFetchRateLimit(user._id)
  const record = await getConnectionRecord(user)
  if (!record) {
    const err = new Error('No email account connected.')
    err.code = 'EMAIL_NOT_CONNECTED'
    throw err
  }

  const accessToken = await getValidAccessToken(record)
  const query = options.query || buildGmailQueryFromMessage(options.userMessage || '')
  const raw = await listGmailMessages(accessToken, {
    maxResults: options.maxResults || 15,
    query,
  })
  const messages = raw.map(normalizeEmailMessage)
  console.info(`[sales-ai] email fetch userId=${user._id} count=${messages.length}`)
  return { provider: 'gmail', email: record.email, query, messages }
}

async function disconnectEmail(user, provider = 'gmail') {
  await EmailConnection.deleteOne({ userId: user._id, provider })
}

module.exports = {
  buildOAuthState,
  parseOAuthState,
  buildGmailAuthUrl,
  exchangeGmailCode,
  getConnectionStatus,
  saveGmailConnection,
  fetchRecentInbox,
  disconnectEmail,
  getFrontendRedirectUrl,
  getGmailConnectStartUrl,
  getGmailConnectStartPath,
  buildGmailQueryFromMessage,
  isGmailConfigured,
}
