/**
 * In-memory ERP catalog cache with in-flight request deduplication.
 * Safe for read-only reference data (accounts, customers, vendors, currencies, mappings).
 * Cache keys always include the active tenant so cookie-session tokens cannot leak across portals.
 */

const DEFAULT_TTL_MS = 3 * 60 * 1000

const cache = new Map()
const inflight = new Map()

function resolveCacheTenant(explicitTenant) {
  if (explicitTenant != null && String(explicitTenant).trim()) {
    return String(explicitTenant).trim().toLowerCase()
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('tenantCompany')
      if (stored) return String(stored).trim().toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return 'default'
}

/** Exported for tests — format: kind|tenant|tokenPrefix|paramsJson */
export function buildCatalogCacheKey(kind, token, params = {}, tenant) {
  const tokenKey = String(token || 'cookie').slice(0, 24)
  const tenantKey = resolveCacheTenant(tenant)
  const paramKey = JSON.stringify(params || {})
  return `${kind}|${tenantKey}|${tokenKey}|${paramKey}`
}

function buildKey(kind, token, params = {}, tenant) {
  return buildCatalogCacheKey(kind, token, params, tenant)
}

export function getCachedCatalog(kind, token, params = {}, tenant) {
  const key = buildKey(kind, token, params, tenant)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.savedAt > (entry.ttlMs || DEFAULT_TTL_MS)) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCachedCatalog(kind, token, params, data, ttlMs = DEFAULT_TTL_MS, tenant) {
  const key = buildKey(kind, token, params, tenant)
  cache.set(key, { data, savedAt: Date.now(), ttlMs })
}

export function invalidateCatalogCache(kindPrefix = null) {
  if (!kindPrefix) {
    cache.clear()
    inflight.clear()
    return
  }
  const prefix = String(kindPrefix)
  for (const key of cache.keys()) {
    if (key.startsWith(`${prefix}|`)) cache.delete(key)
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${prefix}|`)) inflight.delete(key)
  }
}

/**
 * Deduplicate concurrent identical fetches and cache the result.
 * @param {string} kind
 * @param {string} token
 * @param {object} params
 * @param {() => Promise<any>} fetcher
 * @param {number|{ ttlMs?: number, tenant?: string }} [ttlOrOptions]
 */
export async function fetchCatalogCached(kind, token, params, fetcher, ttlOrOptions = DEFAULT_TTL_MS) {
  const options = typeof ttlOrOptions === 'number'
    ? { ttlMs: ttlOrOptions }
    : (ttlOrOptions || {})
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const tenant = options.tenant

  const cached = getCachedCatalog(kind, token, params, tenant)
  if (cached != null) return cached

  const key = buildKey(kind, token, params, tenant)
  if (inflight.has(key)) return inflight.get(key)

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setCachedCatalog(kind, token, params, data, ttlMs, tenant)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

export const CATALOG_KINDS = {
  accounts: 'accounts',
  accountsSummary: 'accountsSummary',
  customers: 'customers',
  vendors: 'vendors',
  currencies: 'currencies',
  mappings: 'mappings',
  inventory: 'inventory',
}
