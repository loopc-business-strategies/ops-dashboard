const { normalizeTenant } = require('../../config/tenants')

function getAllowedTenants() {
  const raw = String(process.env.SALES_AI_ALLOWED_TENANTS || 'loopc')
  return raw.split(',').map((t) => normalizeTenant(t.trim())).filter(Boolean)
}

function isSalesAiEnabledForTenant(tenantKey) {
  const key = normalizeTenant(tenantKey)
  if (!key) return false
  return getAllowedTenants().includes(key)
}

function assertSalesAiAccess(req) {
  const tenant = normalizeTenant(
    req.user?.company || req.user?.tenant || req.tenant || req.headers['x-tenant'],
  )
  if (!isSalesAiEnabledForTenant(tenant)) {
    const err = new Error('Sales Manager AI is not enabled for this tenant.')
    err.statusCode = 403
    throw err
  }
  return tenant
}

module.exports = {
  getAllowedTenants,
  isSalesAiEnabledForTenant,
  assertSalesAiAccess,
}
