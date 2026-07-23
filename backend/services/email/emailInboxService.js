const crypto = require('crypto')
const EmailConnection = require('../../models/EmailConnection')
const TenantEmailConnection = require('../../models/TenantEmailConnection')
const { encryptToken, decryptToken, isTokenEncryptionConfigured } = require('../../utils/tokenEncryption')
const { normalizeEmailMessage } = require('./emailProviderTypes')
const { getExpectedSharedInboxEmail, isTenantSharedInboxEnabled } = require('./tenantEmailConfig')
const { normalizeTenant } = require('../../config/tenants')
const { isHardenedDeployEnv } = require('../../utils/envValidation')
const { timingSafeEqualString } = require('../../utils/timingSafeEqualString')
const {
  isGmailConfigured,
  buildGmailAuthUrl,
  exchangeGmailCode,
  refreshGmailAccessToken,
  fetchGmailProfile,
  listGmailMessages,
  buildGmailQueryFromMessage,
  GMAIL_READONLY_SCOPE,
  getRedirectUri,
  getTenantRedirectUri,
} = require('./gmailProvider')

const fetchRateMap = new Map()
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

function getOAuthStateSecret() {
  const dedicated = String(process.env.EMAIL_OAUTH_STATE_SECRET || '').trim()
  const encryptionKey = String(process.env.EMAIL_TOKEN_ENCRYPTION_KEY || '').trim()
  if (dedicated) return dedicated
  if (encryptionKey) return encryptionKey

  if (isHardenedDeployEnv()) {
    throw new Error(
      'EMAIL_OAUTH_STATE_SECRET or EMAIL_TOKEN_ENCRYPTION_KEY is required in production/staging.',
    )
  }

  const jwtSecret = String(process.env.JWT_SECRET || '').trim()
  if (jwtSecret) return jwtSecret

  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()
  if (nodeEnv === 'development' || nodeEnv === 'test' || !nodeEnv) {
    return 'dev-email-oauth-state'
  }

  throw new Error('EMAIL_OAUTH_STATE_SECRET is not configured.')
}

function buildOAuthState(userId, tenant, scope = 'user') {
  const payload = {
    userId: String(userId),
    tenant: String(tenant || 'loopc'),
    scope: String(scope || 'user'),
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
  if (!timingSafeEqualString(sig, expected)) throw new Error('Invalid OAuth state signature.')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (Date.now() - Number(payload.ts) > OAUTH_STATE_TTL_MS) throw new Error('OAuth state expired.')
  return payload
}

function getFetchRateLimit() {
  return Number(process.env.EMAIL_FETCH_RATE_LIMIT || 10)
}

function checkFetchRateLimit(rateKey) {
  const key = String(rateKey)
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

function getGmailTenantConnectStartPath() {
  return '/api/email/oauth/gmail/tenant/start'
}

function getGmailConnectStartUrl() {
  const api = String(process.env.API_PUBLIC_URL || 'https://api.loopcstrategies.com').replace(/\/$/, '')
  return `${api}${getGmailConnectStartPath()}`
}

function getGmailTenantConnectStartUrl() {
  const api = String(process.env.API_PUBLIC_URL || 'https://api.loopcstrategies.com').replace(/\/$/, '')
  return `${api}${getGmailTenantConnectStartPath()}`
}

function resolveTenantKey(user, tenantKey) {
  return normalizeTenant(tenantKey || user?.company || user?.tenant || 'loopc')
}

async function getUserConnectionRecord(user) {
  if (!user?._id) return null
  return EmailConnection.findOne({ userId: user._id, provider: 'gmail' })
    .select('+accessTokenEnc +refreshTokenEnc')
    .lean()
}

async function getTenantConnectionRecord() {
  return TenantEmailConnection.findOne({ provider: 'gmail' })
    .select('+accessTokenEnc +refreshTokenEnc')
    .lean()
}

async function getValidAccessToken(record, Model) {
  let accessToken = decryptToken(record.accessTokenEnc)
  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0
  if (expiresAt > Date.now() + 60_000) return accessToken

  if (!record.refreshTokenEnc) throw new Error('Gmail connection expired. Please reconnect.')
  const refreshed = await refreshGmailAccessToken(decryptToken(record.refreshTokenEnc))
  accessToken = refreshed.accessToken
  await Model.updateOne(
    { _id: record._id },
    {
      accessTokenEnc: encryptToken(refreshed.accessToken),
      expiresAt: new Date(Date.now() + (Number(refreshed.expiresIn) || 3600) * 1000),
    },
  )
  return accessToken
}

async function getTenantConnectionStatus(tenantKey, user) {
  const tenant = resolveTenantKey(user, tenantKey)
  const gmailConfigured = isGmailConfigured() && isTokenEncryptionConfigured()
  const expectedEmail = getExpectedSharedInboxEmail(tenant)
  const record = await TenantEmailConnection.findOne({ provider: 'gmail' }).lean()
  const canManage = user?.role === 'super_admin'
  return {
    mode: 'tenant',
    gmailConfigured,
    sharedInboxEnabled: isTenantSharedInboxEnabled(tenant),
    expectedEmail,
    connected: Boolean(record?.email),
    provider: record?.provider || null,
    address: record?.email || null,
    connectUrl: gmailConfigured && canManage ? getGmailTenantConnectStartUrl() : null,
    canManage,
  }
}

async function getConnectionStatus(user, tenantKey) {
  const tenant = resolveTenantKey(user, tenantKey)
  if (isTenantSharedInboxEnabled(tenant)) {
    return getTenantConnectionStatus(tenant, user)
  }

  const gmailConfigured = isGmailConfigured() && isTokenEncryptionConfigured()
  const record = user?._id
    ? await EmailConnection.findOne({ userId: user._id, provider: 'gmail' }).lean()
    : null
  return {
    mode: 'user',
    gmailConfigured,
    sharedInboxEnabled: false,
    expectedEmail: '',
    connected: Boolean(record?.email),
    provider: record?.provider || null,
    address: record?.email || null,
    connectUrl: gmailConfigured ? getGmailConnectStartUrl() : null,
    canManage: true,
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

async function saveTenantGmailConnection(user, tokens, tenantKey) {
  if (!isTokenEncryptionConfigured()) {
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY is not configured on the server.')
  }
  const profile = await fetchGmailProfile(tokens.accessToken)
  const expectedEmail = getExpectedSharedInboxEmail(tenantKey)
  const connectedEmail = String(profile.email || '').trim().toLowerCase()
  if (expectedEmail && connectedEmail && connectedEmail !== expectedEmail) {
    console.warn(`[email] tenant connect expected ${expectedEmail} but got ${connectedEmail}`)
  }
  const expiresAt = new Date(Date.now() + (Number(tokens.expiresIn) || 3600) * 1000)
  const doc = {
    provider: 'gmail',
    email: connectedEmail || expectedEmail,
    scopes: [GMAIL_READONLY_SCOPE],
    accessTokenEnc: encryptToken(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : '',
    expiresAt,
    connectedBy: user._id,
    connectedAt: new Date(),
  }
  await TenantEmailConnection.findOneAndUpdate(
    { provider: 'gmail' },
    doc,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return doc.email
}

async function fetchInboxFromRecord(record, Model, rateKey, options = {}) {
  checkFetchRateLimit(rateKey)
  const accessToken = await getValidAccessToken(record, Model)
  const query = options.query || buildGmailQueryFromMessage(options.userMessage || '')
  const raw = await listGmailMessages(accessToken, {
    maxResults: options.maxResults || 15,
    query,
  })
  const messages = raw.map(normalizeEmailMessage)
  return { provider: 'gmail', email: record.email, query, messages, scope: options.scope || 'user' }
}

async function fetchTenantInbox(tenantKey, options = {}) {
  const record = await getTenantConnectionRecord()
  if (!record) {
    const err = new Error('No company email inbox connected.')
    err.code = 'EMAIL_NOT_CONNECTED'
    throw err
  }
  const inbox = await fetchInboxFromRecord(record, TenantEmailConnection, `tenant:${tenantKey}`, {
    ...options,
    scope: 'tenant',
  })
  console.info(`[sales-ai] tenant email fetch tenant=${tenantKey} count=${inbox.messages.length}`)
  return inbox
}

async function fetchRecentInbox(user, options = {}) {
  const tenantKey = resolveTenantKey(user, options.tenantKey)
  if (isTenantSharedInboxEnabled(tenantKey)) {
    return fetchTenantInbox(tenantKey, options)
  }

  const record = await getUserConnectionRecord(user)
  if (!record) {
    const err = new Error('No email account connected.')
    err.code = 'EMAIL_NOT_CONNECTED'
    throw err
  }
  const inbox = await fetchInboxFromRecord(record, EmailConnection, `user:${user._id}`, options)
  console.info(`[sales-ai] email fetch userId=${user._id} count=${inbox.messages.length}`)
  return inbox
}

async function disconnectEmail(user, provider = 'gmail') {
  await EmailConnection.deleteOne({ userId: user._id, provider })
}

async function disconnectTenantEmail(provider = 'gmail') {
  await TenantEmailConnection.deleteOne({ provider })
}

function clearFetchRateLimitForTests() {
  fetchRateMap.clear()
}

module.exports = {
  buildOAuthState,
  parseOAuthState,
  buildGmailAuthUrl,
  exchangeGmailCode,
  getConnectionStatus,
  getTenantConnectionStatus,
  saveGmailConnection,
  saveTenantGmailConnection,
  fetchRecentInbox,
  fetchTenantInbox,
  disconnectEmail,
  disconnectTenantEmail,
  getFrontendRedirectUrl,
  getGmailConnectStartUrl,
  getGmailTenantConnectStartUrl,
  getGmailConnectStartPath,
  getGmailTenantConnectStartPath,
  getRedirectUri,
  getTenantRedirectUri,
  buildGmailQueryFromMessage,
  isGmailConfigured,
  isTenantSharedInboxEnabled,
  getExpectedSharedInboxEmail,
  clearFetchRateLimitForTests,
}
