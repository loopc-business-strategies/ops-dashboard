const {
  getTenantKeys,
  normalizeTenantKey,
  getDefaultTenant,
  resolveTenantFromHost,
  getTenantUri,
  buildTenantsMapForLegacy,
} = require('./tenantRegistry')

const TENANT_KEYS = getTenantKeys()
const TENANTS = buildTenantsMapForLegacy()

function resolveRequestTenantKey(req) {
  if (!req) return 'default'
  const raw = req.tenant?.key ?? req.tenant ?? req.user?.tenant
  return normalizeTenantKey(raw) || 'default'
}

module.exports = {
  TENANT_KEYS,
  TENANTS,
  normalizeTenant: normalizeTenantKey,
  getDefaultTenant,
  resolveTenantFromHost,
  getTenantUri,
  resolveRequestTenantKey,
}
