const request = require('supertest')

const ORIGINAL_ENV = { ...process.env }

function preflight(app, origin) {
  return request(app)
    .options('/api/health')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'x-tenant,x-client')
}

function allowedHeaders(res) {
  return String(res.headers['access-control-allow-headers'] || '').toLowerCase().split(',')
}

describe('CORS X-Client header', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    jest.resetModules()
  })

  test('local development allows X-Client for Expo web testing', async () => {
    process.env.NODE_ENV = 'test'
    const app = require('../app')()
    const res = await preflight(app, 'http://localhost:5175')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5175')
    expect(allowedHeaders(res)).toContain('x-client')
  })

  test('production does not allow X-Client from browsers', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CLIENT_URLS = 'https://app.example.com'
    const app = require('../app')()
    const res = await preflight(app, 'https://app.example.com')
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com')
    expect(allowedHeaders(res)).not.toContain('x-client')
    expect(allowedHeaders(res)).toContain('x-tenant')
  })
})
