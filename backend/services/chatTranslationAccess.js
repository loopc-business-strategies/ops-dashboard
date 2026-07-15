const { normalizeTenant } = require('../config/tenants')

function getAllowedTenants() {
  const raw = String(process.env.CHAT_TRANSLATION_ALLOWED_TENANTS || 'loopc,mg,cg')
  return raw.split(',').map((t) => normalizeTenant(t.trim())).filter(Boolean)
}

function isChatTranslationEnabledForTenant(tenantKey) {
  const key = normalizeTenant(tenantKey)
  if (!key) return false
  return getAllowedTenants().includes(key)
}

function assertChatTranslationAccess(req) {
  const tenant = normalizeTenant(
    req.user?.company || req.user?.tenant || req.tenant || req.headers['x-tenant'],
  )
  if (!isChatTranslationEnabledForTenant(tenant)) {
    const err = new Error('Chat translation is not enabled for this tenant.')
    err.statusCode = 403
    throw err
  }
  return tenant
}

module.exports = {
  getAllowedTenants,
  isChatTranslationEnabledForTenant,
  assertChatTranslationAccess,
}
