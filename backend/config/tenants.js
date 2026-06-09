const TENANT_KEYS = ['mg', 'cg', 'loopc']

const TENANTS = {
  mg: {
    key: 'mg',
    name: 'MG',
    envVar: 'MONGO_URI_MG',
  },
  cg: {
    key: 'cg',
    name: 'CG',
    envVar: 'MONGO_URI_CG',
  },
  loopc: {
    key: 'loopc',
    name: 'LoopC',
    envVar: 'MONGO_URI_LOOPC',
  },
}

function normalizeTenant(value) {
  const tenant = String(value || '').trim().toLowerCase()
  if (!tenant) return null
  if (!TENANT_KEYS.includes(tenant)) return null
  return tenant
}

function getDefaultTenant() {
  return normalizeTenant(process.env.DEFAULT_TENANT) || 'loopc'
}

function resolveTenantFromHost(hostname, fallbackTenant = getDefaultTenant()) {
  const fallback = normalizeTenant(fallbackTenant) || getDefaultTenant()
  const rawHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')

  if (!rawHost) return fallback

  const directMatch = normalizeTenant(rawHost)
  if (directMatch) return directMatch

  if (rawHost === 'localhost' || rawHost === '127.0.0.1' || rawHost === '::1') {
    return fallback
  }

  const [subdomain] = rawHost.split('.')
  return normalizeTenant(subdomain) || fallback
}

function getTenantUri(tenant) {
  const normalized = normalizeTenant(tenant)
  if (!normalized) return null
  const cfg = TENANTS[normalized]
  const uri = process.env[cfg.envVar]
  return uri || null
}

/**
 * Tenant key for the current HTTP request (auth sets `req.tenant` as a string; some code used `req.tenant.key`).
 * Use for Socket.IO rooms, SSE publish tenant, and tenant-scoped ERP helpers.
 */
function resolveRequestTenantKey(req) {
  if (!req) return 'default'
  const raw = req.tenant?.key ?? req.tenant ?? req.user?.tenant
  return normalizeTenant(raw) || 'default'
}

module.exports = {
  TENANT_KEYS,
  TENANTS,
  normalizeTenant,
  getDefaultTenant,
  resolveTenantFromHost,
  getTenantUri,
  resolveRequestTenantKey,
}
