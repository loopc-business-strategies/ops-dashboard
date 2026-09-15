const { createReportResponseCache } = require('./reportResponseCache')

/** Process-local report caches — invalidate local entries after ledger/tx writes. */
const reportCache = createReportResponseCache(60000)
const enquiryCache = createReportResponseCache(180000)
const summaryAccountsCache = createReportResponseCache(120000)

/**
 * Invalidate ERP read caches for one tenant.
 * Blank / missing tenantKey is a no-op (never wipe all tenants).
 * Pass tenantKey === '*' to intentionally clear all process-local ERP caches.
 */
function invalidateErpReadCaches(tenantKey) {
  const raw = String(tenantKey ?? '').trim()
  if (!raw) return
  if (raw === '*') {
    reportCache.invalidateByPrefix('')
    enquiryCache.invalidateByPrefix('')
    summaryAccountsCache.invalidateByPrefix('')
    return
  }
  reportCache.invalidateByPrefix(`${raw}:`)
  enquiryCache.invalidateByPrefix(`${raw}:`)
  summaryAccountsCache.invalidateByPrefix(`${raw}:`)
}

module.exports = {
  reportCache,
  enquiryCache,
  summaryAccountsCache,
  invalidateErpReadCaches,
}
