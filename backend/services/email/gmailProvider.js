const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

function isGmailConfigured() {
  return Boolean(
    String(process.env.GOOGLE_CLIENT_ID || '').trim()
    && String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  )
}

function getRedirectUri() {
  return String(
    process.env.GOOGLE_OAUTH_REDIRECT_URI
    || `${String(process.env.API_PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/email/oauth/gmail/callback`,
  ).trim()
}

function getTenantRedirectUri() {
  return String(
    process.env.GOOGLE_OAUTH_TENANT_REDIRECT_URI
    || `${String(process.env.API_PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/email/oauth/gmail/tenant/callback`,
  ).trim()
}

function buildGmailAuthUrl(state, redirectUri) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured.')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri || getRedirectUri(),
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

async function exchangeGmailCode(code, redirectUri) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured.')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || ''),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Google token exchange failed (${res.status})`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: Number(data.expires_in) || 3600,
    scope: data.scope || GMAIL_READONLY_SCOPE,
  }
}

async function refreshGmailAccessToken(refreshToken) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: String(refreshToken || ''),
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Gmail token refresh failed')
  }
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
  }
}

function headerValue(headers = [], name) {
  const hit = headers.find((h) => String(h.name || '').toLowerCase() === name.toLowerCase())
  return hit?.value || ''
}

async function gmailApiGet(path, accessToken) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gmail API error (${res.status})`)
  }
  return data
}

async function fetchGmailProfile(accessToken) {
  const data = await gmailApiGet('/profile', accessToken)
  return { email: data.emailAddress || '' }
}

function getDefaultEmailFetchMax() {
  const raw = Number(process.env.EMAIL_FETCH_MAX_RESULTS)
  if (Number.isFinite(raw) && raw > 0) return Math.min(Math.floor(raw), 50)
  return 15
}

function wantsBroadInboxFetch(userMessage = '') {
  const msg = String(userMessage || '').toLowerCase()
  return /all\s+(my\s+)?emails?/.test(msg)
    || /everything\s+in\s+(my\s+)?(inbox|mailbox|email)/.test(msg)
    || /\b(analyze|summar|scan|review|read)\s+(my\s+)?(all\s+)?(the\s+)?(emails?|inbox|mail)/.test(msg)
}

function resolveEmailFetchMaxResults(userMessage = '') {
  return wantsBroadInboxFetch(userMessage) ? 50 : getDefaultEmailFetchMax()
}

async function listGmailMessages(accessToken, { maxResults = 15, query = '' } = {}) {
  const cap = Math.min(Math.max(1, Number(maxResults) || 15), 50)
  const params = new URLSearchParams({ maxResults: String(cap) })
  if (query) params.set('q', String(query).slice(0, 200))
  const list = await gmailApiGet(`/messages?${params.toString()}`, accessToken)
  const ids = (list.messages || []).map((m) => m.id).filter(Boolean)
  const messages = await Promise.all(ids.map(async (id) => {
    const msg = await gmailApiGet(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, accessToken)
    const headers = msg.payload?.headers || []
    return {
      id: msg.id,
      threadId: msg.threadId,
      from: headerValue(headers, 'From'),
      subject: headerValue(headers, 'Subject'),
      date: headerValue(headers, 'Date'),
      snippet: msg.snippet || '',
    }
  }))
  return messages
}

function buildGmailQueryFromMessage(userMessage = '') {
  const msg = String(userMessage || '')
  const parts = []
  if (/unread/i.test(msg)) parts.push('is:unread')

  const broad = wantsBroadInboxFetch(msg)
  if (!broad) {
    if (/24\s*h|last day|today/i.test(msg)) parts.push('newer_than:1d')
    else if (/week|7\s*day/i.test(msg)) parts.push('newer_than:7d')
    else parts.push('newer_than:7d')
  } else {
    parts.push('newer_than:30d')
  }

  const fromMatch = msg.match(/\bfrom\s+([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)
    || msg.match(/\bfrom\s+([A-Za-z0-9._-]{3,})\b/i)
  if (fromMatch && !/^(last|the|my|this|that)$/i.test(fromMatch[1])) {
    parts.push(`from:${fromMatch[1]}`)
  }

  return parts.join(' ')
}

module.exports = {
  GMAIL_READONLY_SCOPE,
  isGmailConfigured,
  getRedirectUri,
  getTenantRedirectUri,
  buildGmailAuthUrl,
  exchangeGmailCode,
  refreshGmailAccessToken,
  fetchGmailProfile,
  listGmailMessages,
  buildGmailQueryFromMessage,
  resolveEmailFetchMaxResults,
  wantsBroadInboxFetch,
  getDefaultEmailFetchMax,
}
