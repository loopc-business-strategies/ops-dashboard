const request = require('supertest')

const createApp = require('../app')

describe('push routes', () => {
  const app = createApp()

  test('GET /api/push/web-config returns configured false when unset', async () => {
    const prev = process.env.WEB_PUSH_PUBLIC_KEY
    delete process.env.WEB_PUSH_PUBLIC_KEY

    const res = await request(app).get('/api/push/web-config')
    expect(res.status).toBe(200)
    expect(res.body.configured).toBe(false)
    expect(res.body.publicKey).toBeNull()

    if (prev) process.env.WEB_PUSH_PUBLIC_KEY = prev
  })

  test('GET /api/push/web-config returns public key when set', async () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'test-vapid-public-key'

    const res = await request(app).get('/api/push/web-config')
    expect(res.status).toBe(200)
    expect(res.body.configured).toBe(true)
    expect(res.body.publicKey).toBe('test-vapid-public-key')

    delete process.env.WEB_PUSH_PUBLIC_KEY
  })
})
