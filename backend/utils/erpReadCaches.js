const { createReportResponseCache } = require('./reportResponseCache')
const sharedCoordination = require('./sharedCoordination')

/** ERP report caches — local copy plus a shared (Redis) copy under `report-cache:<tenant>:…`. */
const reportCache = createReportResponseCache(60000)
const enquiryCache = createReportResponseCache(180000)
const summaryAccountsCache = createReportResponseCache(120000)

/**
 * Invalidate ERP read caches for one tenant, locally and in the shared store.
 * Blank / missing tenantKey is a no-op (never wipe all tenants).
 * Pass tenantKey === '*' to intentionally clear all ERP caches.
 * Resolves once the shared entries are gone; never rejects.
 */
function invalidateErpReadCaches(tenantKey) {
  const raw = String(tenantKey ?? '').trim()
  if (!raw) return Promise.resolve()
  const prefix = raw === '*' ? '' : `${raw}:`
  reportCache.invalidateByPrefix(prefix)
  enquiryCache.invalidateByPrefix(prefix)
  summaryAccountsCache.invalidateByPrefix(prefix)
  return sharedCoordination.deleteByPrefix(`report-cache:${prefix}`)
    .then(() => undefined)
    .catch((err) => {
      console.warn('[erpReadCaches] shared invalidation failed', err?.message || err)
    })
}

module.exports = {
  reportCache,
  enquiryCache,
  summaryAccountsCache,
  invalidateErpReadCaches,
}
