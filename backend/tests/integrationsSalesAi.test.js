const { integrationProtect, parseIntegrationKeys } = require('../middleware/integrationAuth')

function mockReqRes(headers = {}) {
  const req = { headers, query: {} }
  let statusCode = 200
  let body = null
  const res = {
    status(code) { statusCode = code; return res },
    json(payload) { body = payload; return res },
  }
  const next = jest.fn()
  return { req, res, next, getStatus: () => statusCode, getBody: () => body }
}

describe('integrationAuth middleware', () => {
  const original = process.env.INTEGRATION_API_KEYS

  beforeAll(() => {
    process.env.INTEGRATION_API_KEYS = 'loopc:test-key-abcdef123456'
  })

  afterAll(() => {
    process.env.INTEGRATION_API_KEYS = original
  })

  test('parseIntegrationKeys maps keys to tenants', () => {
    const map = parseIntegrationKeys()
    expect(map.get('test-key-abcdef123456')).toBe('loopc')
  })

  test('rejects missing key', () => {
    const { req, res, next, getStatus } = mockReqRes()
    integrationProtect(req, res, next)
    expect(getStatus()).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('accepts valid key and sets tenant', () => {
    const { req, res, next } = mockReqRes({
      'x-integration-key': 'test-key-abcdef123456',
      'x-tenant': 'loopc',
    })
    integrationProtect(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.integrationTenant).toBe('loopc')
  })

  test('rejects tenant mismatch', () => {
    const { req, res, next, getStatus } = mockReqRes({
      'x-integration-key': 'test-key-abcdef123456',
      'x-tenant': 'mg',
    })
    integrationProtect(req, res, next)
    expect(getStatus()).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })
})
