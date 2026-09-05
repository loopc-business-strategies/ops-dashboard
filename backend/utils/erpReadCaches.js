const { createReportResponseCache } = require('./reportResponseCache')

/** Process-local report caches — invalidate local entries after ledger/tx writes. */
const reportCache = createReportResponseCache(60000)
const enquiryCache = createReportResponseCache(180000)
const summaryAccountsCache = createReportResponseCache(120000)

function invalidateErpReadCaches(tenantKey) {
  const prefix = String(tenantKey || '').trim()
  if (!prefix) {
    reportCache.invalidateByPrefix('')
    enquiryCache.invalidateByPrefix('')
    summaryAccountsCache.invalidateByPrefix('')
    return
  }
  reportCache.invalidateByPrefix(`${prefix}:`)
  enquiryCache.invalidateByPrefix(`${prefix}:`)
  summaryAccountsCache.invalidateByPrefix(`${prefix}:`)
}

module.exports = {
  reportCache,
  enquiryCache,
  summaryAccountsCache,
  invalidateErpReadCaches,
}
