const { createReportResponseCache } = require('../utils/reportResponseCache')
const { createSharedRateLimitStore } = require('../utils/sharedRateLimitStore')
const { setOnce } = require('../utils/sharedCoordination')

describe('shared coordination fallbacks', () => {
  test('report response cache supports shared async get/set', async () => {
    const cache = createReportResponseCache(1000)
    const key = `test-report:${Date.now()}:a`
    const payload = { success: true, rows: [{ id: 1 }] }

    await cache.setShared(key, payload, 1000)

    expect(await cache.getShared(key)).toEqual(payload)
  })

  test('setOnce prevents duplicate work for the ttl window', async () => {
    const key = `test-once:${Date.now()}:a`

    await expect(setOnce(key, 1000)).resolves.toBe(true)
    await expect(setOnce(key, 1000)).resolves.toBe(false)
  })

  test('shared rate-limit store increments within one fixed window', async () => {
    const store = createSharedRateLimitStore(`test-rate:${Date.now()}`)
    store.init({ windowMs: 1000 })

    const first = await store.increment('tenant:user')
    const second = await store.increment('tenant:user')

    expect(first.totalHits).toBe(1)
    expect(second.totalHits).toBe(2)
    expect(second.resetTime).toBeInstanceOf(Date)
  })
})
