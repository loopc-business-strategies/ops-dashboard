const request = require('supertest')
const createApp = require('../app')
const { resetLocalCoordinationForTests } = require('../utils/sharedCoordination')

describe('rate limiting', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    resetLocalCoordinationForTests()
  })

  test('login is not blocked by the global API rate limiter', async () => {
    process.env.NODE_ENV = 'production'
    process.env.RATE_LIMIT_MAX = '1'
    process.env.AUTH_RATE_LIMIT_MAX = '100'
    process.env.JWT_SECRET = 'test-secret'

    const app = createApp()

    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(429)

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('x-tenant', 'mg')
      .send({ name: 'Nan', password: 'wrong-password' })

    expect(loginRes.status).not.toBe(429)
    expect(loginRes.body.message).not.toBe('Too many requests. Please try again shortly.')
  })

  test('metal rates routes are excluded from the global API rate limiter', async () => {
    process.env.NODE_ENV = 'production'
    process.env.RATE_LIMIT_MAX = '1'
    process.env.JWT_SECRET = 'test-secret'

    const app = createApp()

    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/erp-accounting/metal-rates/live').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/erp-accounting/reports/market-prices').set('x-tenant', 'mg').expect(401)
  })

  test('global limiter keys requests by tenant and IP', async () => {
    process.env.NODE_ENV = 'production'
    process.env.RATE_LIMIT_MAX = '1'
    process.env.JWT_SECRET = 'test-secret'

    const app = createApp()

    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/auth/me').set('x-tenant', 'cg').expect(401)
  })

  test('global limiter uses shared rate-limit store (Redis when configured)', async () => {
    process.env.NODE_ENV = 'production'
    process.env.RATE_LIMIT_MAX = '2'
    process.env.JWT_SECRET = 'test-secret'
    delete process.env.REDIS_URL

    const app = createApp()

    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(401)
    await request(app).get('/api/auth/me').set('x-tenant', 'mg').expect(429)
  })
})
