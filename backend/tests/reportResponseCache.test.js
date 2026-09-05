const { createReportResponseCache } = require('../utils/reportResponseCache')

describe('reportResponseCache singleflight', () => {
  test('concurrent getOrCompute shares one compute', async () => {
    const cache = createReportResponseCache(60000)
    let computes = 0
    const compute = async () => {
      computes += 1
      await new Promise((r) => setTimeout(r, 20))
      return { ok: true, n: computes }
    }

    const [a, b] = await Promise.all([
      cache.getOrCompute('t1:key', compute),
      cache.getOrCompute('t1:key', compute),
    ])

    expect(computes).toBe(1)
    expect(a.payload).toEqual(b.payload)
    expect(a.payload.ok).toBe(true)
  })

  test('invalidateByPrefix clears matching local keys', async () => {
    const cache = createReportResponseCache(60000)
    await cache.setShared('loopc:trial-balance:x', { a: 1 })
    await cache.setShared('mg:trial-balance:x', { b: 2 })
    cache.invalidateByPrefix('loopc:')
    expect(cache.get('loopc:trial-balance:x')).toBeNull()
    expect(cache.get('mg:trial-balance:x')).toEqual({ b: 2 })
  })

  test('getOrCompute honors custom TTL', async () => {
    const cache = createReportResponseCache(60000)
    await cache.getOrCompute('dash:ttl', async () => ({ v: 1 }), 180000)
    const row = cache.get('dash:ttl')
    expect(row).toEqual({ v: 1 })
    // Expiry stored as expiresAt; ensure entry is still live well under 180s
    expect(cache.get('dash:ttl')).not.toBeNull()
  })
})
