const { resolveRequestTenantKey } = require('../config/tenants')
const { invalidateErpReadCaches } = require('../utils/erpReadCaches')

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * After any successful ERP accounting write, drop the tenant's cached statements and reports
 * so the next read reflects the change instead of waiting out the cache TTL.
 */
function invalidateErpReadCachesAfterWrites(req, res, next) {
  if (!WRITE_METHODS.has(String(req.method || '').toUpperCase())) return next()
  res.on('finish', () => {
    if (res.statusCode >= 400) return
    const tenantKey = String(resolveRequestTenantKey(req) || '').trim()
    if (tenantKey) void invalidateErpReadCaches(tenantKey)
  })
  return next()
}

module.exports = { invalidateErpReadCachesAfterWrites }
