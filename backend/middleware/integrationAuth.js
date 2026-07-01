const { normalizeTenant } = require('../config/tenants')

function parseIntegrationKeys() {
  const map = new Map()
  const raw = String(process.env.INTEGRATION_API_KEYS || '').trim()
  if (!raw) return map

  for (const pair of raw.split(',')) {
    const [tenantPart, keyPart] = pair.split(':')
    const tenant = normalizeTenant(String(tenantPart || '').trim())
    const key = String(keyPart || '').trim()
    if (tenant && key) map.set(key, tenant)
  }
  return map
}

function integrationProtect(req, res, next) {
  const apiKey = String(
    req.headers['x-integration-key']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    || '',
  ).trim()

  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'Integration API key required.' })
  }

  const keyMap = parseIntegrationKeys()
  const tenantFromKey = keyMap.get(apiKey)
  if (!tenantFromKey) {
    return res.status(401).json({ success: false, message: 'Invalid integration API key.' })
  }

  const headerTenant = normalizeTenant(req.headers['x-tenant'] || req.query?.tenant)
  if (headerTenant && headerTenant !== tenantFromKey) {
    return res.status(403).json({ success: false, message: 'API key does not match requested tenant.' })
  }

  req.integrationTenant = tenantFromKey
  req.integrationScopes = ['read:crm', 'read:inbox', 'read:metals']
  next()
}

module.exports = {
  integrationProtect,
  parseIntegrationKeys,
}
