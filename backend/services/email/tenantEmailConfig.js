const { getTenantCatalog } = require('../../config/tenantRegistry')
const { normalizeTenant } = require('../../config/tenants')

function getExpectedSharedInboxEmail(tenantKey) {
  const key = normalizeTenant(tenantKey)
  if (!key) return ''
  const catalog = getTenantCatalog()
  const entry = catalog?.tenants?.[key]
  return String(entry?.sharedInboxEmail || '').trim().toLowerCase()
}

function isTenantSharedInboxEnabled(tenantKey) {
  return Boolean(getExpectedSharedInboxEmail(tenantKey))
}

module.exports = {
  getExpectedSharedInboxEmail,
  isTenantSharedInboxEnabled,
}
