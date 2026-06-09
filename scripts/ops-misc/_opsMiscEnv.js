/**
 * Shared config for scripts/ops-misc HTTPS helpers.
 *
 * WARNING: Do not commit real credentials. Set variables in your shell or in
 * backend/.env / .env.local (loaded when dotenv is available).
 *
 * See scripts/ops-misc/README.md for variable names.
 */
'use strict'

const path = require('path')
const https = require('https')

function tryLoadDotenv() {
  const candidates = [
    path.join(__dirname, '../../backend/node_modules/dotenv'),
    path.join(__dirname, '../../node_modules/dotenv'),
  ]
  for (const modPath of candidates) {
    try {
      const dotenv = require(modPath)
      dotenv.config({ path: path.join(__dirname, '../../backend/.env') })
      dotenv.config({ path: path.join(__dirname, '../../.env.local') })
      return
    } catch {
      // next candidate
    }
  }
}

tryLoadDotenv()

function trim(v) {
  return String(v ?? '').trim()
}

function getOpsMiscApiOrigin() {
  const raw = trim(
    process.env.OPS_MISC_API_BASE
      || process.env.SMOKE_API_BASE
      || process.env.OPS_MISC_API_ORIGIN
      || '',
  )
  if (raw) {
    try {
      const withProto = raw.includes('://') ? raw : `https://${raw}`
      return new URL(withProto).origin
    } catch {
      console.warn('[ops-misc] Invalid OPS_MISC_API_BASE / SMOKE_API_BASE; falling back to default origin.')
    }
  }
  return 'https://api.loopcstrategies.com'
}

function getOpsMiscTenantId() {
  return trim(process.env.OPS_MISC_TENANT_ID || process.env.X_TENANT_ID || 'mg') || 'mg'
}

function buildHttpsRequestOptions(method, pathname, extraHeaders = {}) {
  const origin = getOpsMiscApiOrigin()
  const base = origin.endsWith('/') ? origin : `${origin}/`
  const url = new URL(pathname.startsWith('/') ? pathname : `/${pathname}`, base)
  return {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': getOpsMiscTenantId(),
      ...extraHeaders,
    },
  }
}

function getOpsMiscLoginBody() {
  const password = trim(process.env.OPS_MISC_LOGIN_PASSWORD)
  const name = trim(process.env.OPS_MISC_LOGIN_NAME || process.env.OPS_MISC_LOGIN_USERNAME)
  const username = trim(process.env.OPS_MISC_LOGIN_USERNAME || process.env.OPS_MISC_LOGIN_NAME)
  return { password, name, username }
}

function assertLoginConfigured() {
  const { password, name, username } = getOpsMiscLoginBody()
  if (!password) {
    console.error('[ops-misc] Missing OPS_MISC_LOGIN_PASSWORD. See scripts/ops-misc/README.md')
    process.exit(1)
  }
  if (!name && !username) {
    console.error('[ops-misc] Missing OPS_MISC_LOGIN_NAME (or OPS_MISC_LOGIN_USERNAME). See scripts/ops-misc/README.md')
    process.exit(1)
  }
}

/** Payload for POST /api/auth/login (name or username field, depending on env). */
function loginPayloadForApi() {
  const { password, name, username } = getOpsMiscLoginBody()
  const useUserField = trim(process.env.OPS_MISC_LOGIN_USE_USERNAME_FIELD)
  if (useUserField === '1' || useUserField.toLowerCase() === 'true') {
    return { username: username || name, password }
  }
  if (username && !name) return { username, password }
  return { name: name || username, password }
}

function createMakeRequest() {
  return (method, pathname, data = null, extraHeaders = {}) => new Promise((resolve, reject) => {
    const options = buildHttpsRequestOptions(method, pathname, extraHeaders)
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })
    req.on('error', reject)
    if (data != null) req.write(JSON.stringify(data))
    req.end()
  })
}

module.exports = {
  getOpsMiscApiOrigin,
  getOpsMiscTenantId,
  buildHttpsRequestOptions,
  assertLoginConfigured,
  loginPayloadForApi,
  createMakeRequest,
  getOpsMiscLoginBody,
}
