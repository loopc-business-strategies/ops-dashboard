const nodeCrypto = require('crypto')
const {
  csrfCookieName,
  hasSessionCookie,
  readCsrfToken,
  resolvePortalTenant,
  csrfCookieOptions,
} = require('../utils/tenantSessionCookies')

const CSRF_COOKIE_NAME = 'csrfToken'
const CSRF_HEADER_NAME = 'x-csrf-token'

const isMutatingMethod = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase())

const shouldBypassPath = (path = '') => {
  const p = String(path || '')
  // Login/setup are pre-auth flows and should not require an existing CSRF cookie.
  return p === '/auth/login' || p === '/auth/setup' || p === '/health' || p === '/ready'
}

function generateCsrfToken() {
  return nodeCrypto.randomBytes(32).toString('hex')
}

function setCsrfCookie(res, token = generateCsrfToken(), tenant) {
  const value = token || generateCsrfToken()
  const key = tenant ? csrfCookieName(tenant) : CSRF_COOKIE_NAME
  res.cookie(key, value, {
    ...csrfCookieOptions,
    maxAge: Number(process.env.COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
  })
  return value
}

function clearCsrfCookie(res, tenant) {
  if (tenant) {
    res.clearCookie(csrfCookieName(tenant), { ...csrfCookieOptions, maxAge: undefined })
    return
  }
  res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions, maxAge: undefined })
}

function hasBearerCredential(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || '').trim()
  return /^Bearer\s+\S+/i.test(auth)
}

function enforceCsrfProtection(req, res, next) {
  if (!isMutatingMethod(req.method)) return next()
  if (shouldBypassPath(req.path)) return next()
  // API clients using Authorization Bearer are not subject to cookie-forging CSRF the same way.
  if (hasBearerCredential(req)) return next()

  const portalTenant = resolvePortalTenant(req)
  if (!hasSessionCookie(req, portalTenant)) return next()

  const cookieToken = readCsrfToken(req, portalTenant)
  const headerToken = String(req.headers[CSRF_HEADER_NAME] || req.headers['x-xsrf-token'] || '')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'CSRF validation failed.' })
  }

  return next()
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfCookieOptions,
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  enforceCsrfProtection,
  hasBearerCredential,
}
