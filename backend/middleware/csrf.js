const nodeCrypto = require('crypto')

const CSRF_COOKIE_NAME = 'csrfToken'
const CSRF_HEADER_NAME = 'x-csrf-token'

const isMutatingMethod = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase())

const shouldBypassPath = (path = '') => {
  const p = String(path || '')
  // Login/setup are pre-auth flows and should not require an existing CSRF cookie.
  return p === '/auth/login' || p === '/auth/setup' || p === '/health'
}

const csrfCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: Number(process.env.COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
  path: '/',
}

function generateCsrfToken() {
  return nodeCrypto.randomBytes(32).toString('hex')
}

function setCsrfCookie(res, token = generateCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions)
  return token
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions, maxAge: undefined })
}

function enforceCsrfProtection(req, res, next) {
  if (!isMutatingMethod(req.method)) return next()
  if (shouldBypassPath(req.path)) return next()

  const hasSessionCookie = Boolean(req.cookies?.sessionToken)
  if (!hasSessionCookie) return next()

  const cookieToken = String(req.cookies?.[CSRF_COOKIE_NAME] || '')
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
}
