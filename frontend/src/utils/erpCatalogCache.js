/**
 * In-memory ERP catalog cache with in-flight request deduplication.
 * Safe for read-only reference data (accounts, customers, vendors, currencies, mappings).
 */

const DEFAULT_TTL_MS = 3 * 60 * 1000

const cache = new Map()
const inflight = new Map()

function buildKey(kind, token, params = {}) {
  const tokenKey = String(token || 'cookie').slice(0, 24)
  const paramKey = JSON.stringify(params || {})
  return `${kind}|${tokenKey}|${paramKey}`
}

export function getCachedCatalog(kind, token, params = {}) {
  const key = buildKey(kind, token, params)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.savedAt > (entry.ttlMs || DEFAULT_TTL_MS)) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCachedCatalog(kind, token, params, data, ttlMs = DEFAULT_TTL_MS) {
  const key = buildKey(kind, token, params)
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
 * @param {number} [ttlMs]
 */
export async function fetchCatalogCached(kind, token, params, fetcher, ttlMs = DEFAULT_TTL_MS) {
  const cached = getCachedCatalog(kind, token, params)
  if (cached != null) return cached

  const key = buildKey(kind, token, params)
  if (inflight.has(key)) return inflight.get(key)

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setCachedCatalog(kind, token, params, data, ttlMs)
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
