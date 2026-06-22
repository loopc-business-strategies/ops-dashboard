const jwt = require('jsonwebtoken')
const { normalizeTenant, resolveTenantFromHost } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const {
  clearLegacySessionCookies,
  clearTenantSessionCookies,
  readSessionToken,
  resolvePortalTenant,
} = require('../utils/tenantSessionCookies')

function getToken(req) {
  return readSessionToken(req)
}

async function bindTenantContext(req, res, next) {
  const token = getToken(req)
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const tenant = normalizeTenant(decoded.company)
    if (!tenant) return next()

    // Prefer hostname resolution; fall back to x-tenant header (needed when
    // all subdomains proxy through a single API domain like api.loopcstrategies.com)
    const headerTenant = normalizeTenant(req.headers['x-tenant'] || req.headers['x-company'])
    const hostTenant = resolveTenantFromHost(req.hostname, headerTenant || tenant)
    if (hostTenant !== tenant) {
      // Let users switch tenant portals by logging in again.
      // Without this, a stale session cookie from another tenant blocks /auth/login.
      const path = String(req.path || '')
      const isAuthTenantSwitchRoute = path === '/auth/login' || path === '/auth/setup'
      if (isAuthTenantSwitchRoute) {
        clearTenantSessionCookies(res, resolvePortalTenant(req, hostTenant))
        return next()
      }
      return res.status(401).json({ success: false, message: 'Session tenant does not match this company portal.' })
    }

    const connection = await connectTenant(tenant)
    registerAllOnConnection(connection)

    return runWithTenantConnection(connection, tenant, () => next())
  } catch (err) {
    const jwtErrorNames = new Set(['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'])
    if (jwtErrorNames.has(String(err?.name || ''))) {
      clearTenantSessionCookies(res, resolvePortalTenant(req))
      clearLegacySessionCookies(res)
      return next()
    }

    return next(err)
  }
}

module.exports = {
  bindTenantContext,
}
