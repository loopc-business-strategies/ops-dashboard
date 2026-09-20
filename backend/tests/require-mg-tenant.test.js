const { requireMgTenant } = require('../middleware/requireMgTenant')

describe('requireMgTenant', () => {
  test('allows mg', () => {
    let nextCalled = false
    const req = { tenant: 'mg' }
    const res = { status() { return this }, json() { return this } }
    requireMgTenant(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })

  test('rejects cg', () => {
    let statusCode = 0
    let body = null
    const req = { tenant: 'cg', user: { company: 'cg' } }
    const res = {
      status(code) { statusCode = code; return this },
      json(payload) { body = payload; return this },
    }
    requireMgTenant(req, res, () => {})
    expect(statusCode).toBe(403)
    expect(body.code).toBe('MG_TENANT_REQUIRED')
  })
})
