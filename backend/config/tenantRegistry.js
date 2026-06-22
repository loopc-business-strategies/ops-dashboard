const fs = require('fs')
const path = require('path')

const CATALOG_PATH = path.join(__dirname, '../../shared/tenant-catalog.json')

function readBaseCatalog() {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      tenants: parsed.tenants || {},
      customDomains: parsed.customDomains || {},
    }
  } catch {
    return { tenants: {}, customDomains: {} }
  }
}

function readEnvRegistryOverlay() {
  const raw = String(process.env.TENANT_REGISTRY_JSON || '').trim()
  if (!raw) return { tenants: {}, customDomains: {} }
  try {
    const parsed = JSON.parse(raw)
    return {
      tenants: parsed.tenants || {},
      customDomains: parsed.customDomains || {},
    }
  } catch (err) {
    console.warn('[tenantRegistry] Invalid TENANT_REGISTRY_JSON:', err.message)
    return { tenants: {}, customDomains: {} }
  }
}

function mergeTenantCatalog() {
  const base = readBaseCatalog()
  const overlay = readEnvRegistryOverlay()
  const tenants = { ...base.tenants, ...overlay.tenants }
  const customDomains = { ...base.customDomains, ...overlay.customDomains }

  Object.values(tenants).forEach((tenant) => {
    const domains = Array.isArray(tenant?.customDomains) ? tenant.customDomains : []
    domains.forEach((host) => {
      const key = String(host || '').trim().toLowerCase()
      if (key) customDomains[key] = tenant.key
    })
  })

  return { tenants, customDomains }
}

let cachedCatalog = null

function getTenantCatalog() {
  if (!cachedCatalog) cachedCatalog = mergeTenantCatalog()
  return cachedCatalog
}

function resetTenantCatalogCache() {
  cachedCatalog = null
}

function getTenantKeys() {
  return Object.keys(getTenantCatalog().tenants).sort()
}

function getTenantConfig(tenant) {
  const key = normalizeTenantKey(tenant)
  if (!key) return null
  return getTenantCatalog().tenants[key] || null
}

function normalizeTenantKey(value) {
  const tenant = String(value || '').trim().toLowerCase()
  if (!tenant) return null
  if (!getTenantKeys().includes(tenant)) return null
  return tenant
}

function getDefaultTenant() {
  return normalizeTenantKey(process.env.DEFAULT_TENANT) || 'loopc'
}

function resolveTenantFromCustomDomain(hostname) {
  const rawHost = String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '')
  if (!rawHost) return null
  const { customDomains } = getTenantCatalog()
  return normalizeTenantKey(customDomains[rawHost])
}

function resolveTenantFromHost(hostname, fallbackTenant = getDefaultTenant()) {
  const fallback = normalizeTenantKey(fallbackTenant) || getDefaultTenant()
  const rawHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')

  if (!rawHost) return fallback

  const customMatch = resolveTenantFromCustomDomain(rawHost)
  if (customMatch) return customMatch

  const directMatch = normalizeTenantKey(rawHost)
  if (directMatch) return directMatch

  if (rawHost === 'localhost' || rawHost === '127.0.0.1' || rawHost === '::1') {
    return fallback
  }

  const [subdomain] = rawHost.split('.')
  return normalizeTenantKey(subdomain) || fallback
}

function getTenantUri(tenant) {
  const normalized = normalizeTenantKey(tenant)
  if (!normalized) return null
  const cfg = getTenantCatalog().tenants[normalized]
  if (!cfg?.envVar) return null
  return process.env[cfg.envVar] || null
}

function getTenantsForApi() {
  return getTenantKeys().map((key) => {
    const row = getTenantCatalog().tenants[key] || {}
    return {
      key,
      displayName: row.displayName || key.toUpperCase(),
      tagline: row.tagline || '',
      portalHost: row.portalHost || `${key}.loopcstrategies.com`,
    }
  })
}

function buildTenantsMapForLegacy() {
  const out = {}
  getTenantKeys().forEach((key) => {
    const row = getTenantCatalog().tenants[key] || {}
    out[key] = {
      key,
      name: row.displayName || key.toUpperCase(),
      envVar: row.envVar || `MONGO_URI_${key.toUpperCase()}`,
    }
  })
  return out
}

module.exports = {
  getTenantCatalog,
  resetTenantCatalogCache,
  getTenantKeys,
  getTenantConfig,
  normalizeTenantKey,
  getDefaultTenant,
  resolveTenantFromHost,
  resolveTenantFromCustomDomain,
  getTenantUri,
  getTenantsForApi,
  buildTenantsMapForLegacy,
}
