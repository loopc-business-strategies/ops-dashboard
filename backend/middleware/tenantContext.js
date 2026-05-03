const jwt = require('jsonwebtoken')
const { normalizeTenant, resolveTenantFromHost } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')

function getToken(req) {
  if (req.cookies?.sessionToken) return req.cookies.sessionToken
  if (req.headers.authorization?.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1]
  }
  return null
}

async function bindTenantContext(req, res, next) {
  const token = getToken(req)
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const tenant = normalizeTenant(decoded.company)
    if (!tenant) return next()

    const hostTenant = resolveTenantFromHost(req.hostname, tenant)
    if (hostTenant !== tenant) {
      return res.status(401).json({ success: false, message: 'Session tenant does not match this company portal.' })
    }

    const connection = await connectTenant(tenant)
    registerAllOnConnection(connection)

    return runWithTenantConnection(connection, tenant, () => next())
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  bindTenantContext,
}
