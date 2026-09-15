const {
  reportCache,
  enquiryCache,
  summaryAccountsCache,
  invalidateErpReadCaches,
} = require('../utils/erpReadCaches')

describe('invalidateErpReadCaches', () => {
  beforeEach(() => {
    invalidateErpReadCaches('*')
  })

  test('blank tenant key is a no-op (does not wipe all caches)', () => {
    const key = reportCache.buildKey(['mg', 'probe'])
    reportCache.set(key, { ok: true })
    invalidateErpReadCaches('')
    invalidateErpReadCaches(null)
    invalidateErpReadCaches(undefined)
    expect(reportCache.get(key)).toEqual({ ok: true })
  })

  test('tenant prefix invalidates only that tenant', () => {
    const mgKey = enquiryCache.buildKey(['mg', 'enquiry'])
    const cgKey = enquiryCache.buildKey(['cg', 'enquiry'])
    enquiryCache.set(mgKey, { t: 'mg' })
    enquiryCache.set(cgKey, { t: 'cg' })
    invalidateErpReadCaches('mg')
    expect(enquiryCache.get(mgKey)).toBeNull()
    expect(enquiryCache.get(cgKey)).toEqual({ t: 'cg' })
  })

  test('* clears all process-local ERP caches', () => {
    const key = summaryAccountsCache.buildKey(['loopc', 'summary'])
    summaryAccountsCache.set(key, { n: 1 })
    invalidateErpReadCaches('*')
    expect(summaryAccountsCache.get(key)).toBeNull()
  })
})
