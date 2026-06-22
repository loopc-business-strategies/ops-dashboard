const jwt = require('jsonwebtoken')
const { normalizeTenant, resolveTenantFromHost } = require('../config/tenants')

const LEGACY_SESSION_COOKIE = 'sessionToken'
const LEGACY_CSRF_COOKIE = 'csrfToken'

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
}

const csrfCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
}

function sessionCookieName(tenant) {
  const key = normalizeTenant(tenant)
  return key ? `sessionToken_${key}` : LEGACY_SESSION_COOKIE
}

function csrfCookieName(tenant) {
  const key = normalizeTenant(tenant)
  return key ? `csrfToken_${key}` : LEGACY_CSRF_COOKIE
}

function resolvePortalTenant(req, fallbackTenant) {
  const headerTenant = normalizeTenant(req?.headers?.['x-tenant'] || req?.headers?.['x-company'])
  const fallback = normalizeTenant(fallbackTenant) || headerTenant
  return resolveTenantFromHost(req?.hostname, fallback)
}

function decodeSessionTenant(token) {
  if (!token || !process.env.JWT_SECRET) return null
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return normalizeTenant(decoded.company)
  } catch {
    return null
  }
}

function readSessionToken(req, fallbackTenant) {
  const portalTenant = resolvePortalTenant(req, fallbackTenant)
  if (!portalTenant) return null

  const namedToken = String(req?.cookies?.[sessionCookieName(portalTenant)] || '').trim()
  if (namedToken) return namedToken

  const legacyToken = String(req?.cookies?.[LEGACY_SESSION_COOKIE] || '').trim()
  if (!legacyToken) return null

  const legacyTenant = decodeSessionTenant(legacyToken)
  if (legacyTenant && legacyTenant === portalTenant) return legacyToken

  return null
}

function readCsrfToken(req, tenant) {
  const portalTenant = normalizeTenant(tenant) || resolvePortalTenant(req)
  if (!portalTenant) {
    return String(req?.cookies?.[LEGACY_CSRF_COOKIE] || '').trim()
  }

  const named = String(req?.cookies?.[csrfCookieName(portalTenant)] || '').trim()
  if (named) return named

  return String(req?.cookies?.[LEGACY_CSRF_COOKIE] || '').trim()
}

function hasSessionCookie(req, tenant) {
  const portalTenant = normalizeTenant(tenant) || resolvePortalTenant(req)
  if (!portalTenant) return Boolean(req?.cookies?.[LEGACY_SESSION_COOKIE])
  if (req?.cookies?.[sessionCookieName(portalTenant)]) return true
  const legacy = String(req?.cookies?.[LEGACY_SESSION_COOKIE] || '').trim()
  if (!legacy) return false
  return decodeSessionTenant(legacy) === portalTenant
}

function buildSessionCookieOptions(maxAgeMs) {
  return {
    ...sessionCookieOptions,
    maxAge: maxAgeMs,
  }
}

function setTenantSessionCookie(res, tenant, token, maxAgeMs) {
  const key = normalizeTenant(tenant)
  if (!key || !token) return
  res.cookie(sessionCookieName(key), token, buildSessionCookieOptions(maxAgeMs))
}

function setTenantCsrfCookie(res, tenant, token) {
  const key = normalizeTenant(tenant)
  if (!key || !token) return
  res.cookie(csrfCookieName(key), token, {
    ...csrfCookieOptions,
    maxAge: Number(process.env.COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
  })
}

function clearLegacySessionCookies(res) {
  res.clearCookie(LEGACY_SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined })
  res.clearCookie(LEGACY_CSRF_COOKIE, { ...csrfCookieOptions, maxAge: undefined })
}

function clearTenantSessionCookies(res, tenant) {
  const key = normalizeTenant(tenant)
  if (!key) return
  res.clearCookie(sessionCookieName(key), { ...sessionCookieOptions, maxAge: undefined })
  res.clearCookie(csrfCookieName(key), { ...csrfCookieOptions, maxAge: undefined })
}

function setTenantSessionCookies(res, tenant, { token, csrfToken, maxAgeMs }) {
  const key = normalizeTenant(tenant)
  if (!key) return
  if (token) setTenantSessionCookie(res, key, token, maxAgeMs)
  if (csrfToken) setTenantCsrfCookie(res, key, csrfToken)
  clearLegacySessionCookies(res)
}

function readSessionTokenFromCookieMap(cookies = {}, { hostname, headerTenant, fallbackTenant } = {}) {
  const reqLike = {
    cookies,
    hostname,
    headers: {
      'x-tenant': headerTenant,
      'x-company': headerTenant,
    },
  }
  return readSessionToken(reqLike, fallbackTenant)
}

module.exports = {
  LEGACY_SESSION_COOKIE,
  LEGACY_CSRF_COOKIE,
  sessionCookieName,
  csrfCookieName,
  resolvePortalTenant,
  readSessionToken,
  readCsrfToken,
  hasSessionCookie,
  buildSessionCookieOptions,
  setTenantSessionCookie,
  setTenantCsrfCookie,
  setTenantSessionCookies,
  clearTenantSessionCookies,
  clearLegacySessionCookies,
  readSessionTokenFromCookieMap,
  sessionCookieOptions,
  csrfCookieOptions,
}
