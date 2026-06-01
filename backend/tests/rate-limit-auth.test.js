const request = require('supertest')
const createApp = require('../app')

describe('rate limiting', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
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
})
