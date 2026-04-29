const jwt = require('jsonwebtoken')
const { normalizeTenant } = require('../config/tenants')

function getToken(req) {
  if (req.cookies?.sessionToken) return req.cookies.sessionToken
  if (req.headers.authorization?.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1]
  }
  return null
}

function requireTenantRouteReadiness(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return next()

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const tenant = normalizeTenant(decoded.company)

    // Allow migrated tenant-aware routes for all companies.
    // Remaining non-migrated routes stay blocked for non-LoopC to avoid cross-tenant leakage.
    const allowAllTenantPaths = ['/api/hr/employees']
    if (allowAllTenantPaths.includes(req.baseUrl)) {
      return next()
    }

    if (tenant && tenant !== 'loopc') {
      return res.status(403).json({
        success: false,
        message: 'Company workspace is created. Business modules for this company are being enabled. Use auth/setup endpoints for now.',
      })
    }

    next()
  } catch {
    next()
  }
}

module.exports = {
  requireTenantRouteReadiness,
}
