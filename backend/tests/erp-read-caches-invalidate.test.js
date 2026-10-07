const {
  reportCache,
  enquiryCache,
  summaryAccountsCache,
  invalidateErpReadCaches,
} = require('../utils/erpReadCaches')

describe('invalidateErpReadCaches', () => {
  beforeEach(() => invalidateErpReadCaches('*'))

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

  test('also drops the shared copy, so getShared no longer serves the stale statement', async () => {
    const mgKey = enquiryCache.buildKey(['mg', 'enquiry', '1316'])
    const cgKey = enquiryCache.buildKey(['cg', 'enquiry', '1316'])
    await enquiryCache.setShared(mgKey, { balance: 322.78 })
    await enquiryCache.setShared(cgKey, { balance: 1 })

    await invalidateErpReadCaches('mg')

    expect(await enquiryCache.getShared(mgKey)).toBeNull()
    expect(await enquiryCache.getShared(cgKey)).toEqual({ balance: 1 })
  })
})

describe('invalidateErpReadCachesAfterWrites', () => {
  const EventEmitter = require('events')
  const { invalidateErpReadCachesAfterWrites } = require('../middleware/erpReadCacheInvalidation')

  const run = async ({ method, statusCode }) => {
    const key = enquiryCache.buildKey(['mg', 'enquiry', 'mw'])
    await enquiryCache.setShared(key, { stale: true })
    const req = { method, headers: { 'x-tenant': 'mg' }, tenant: 'mg', hostname: 'mg.localhost' }
    const res = new EventEmitter()
    res.statusCode = statusCode
    const next = jest.fn()
    invalidateErpReadCachesAfterWrites(req, res, next)
    expect(next).toHaveBeenCalled()
    res.emit('finish')
    await new Promise((resolve) => setImmediate(resolve))
    return enquiryCache.getShared(key)
  }

  test('a successful write clears the tenant cache', async () => {
    expect(await run({ method: 'PUT', statusCode: 200 })).toBeNull()
  })

  test('reads and failed writes leave it alone', async () => {
    expect(await run({ method: 'GET', statusCode: 200 })).toEqual({ stale: true })
    expect(await run({ method: 'POST', statusCode: 409 })).toEqual({ stale: true })
  })
})
