const jwt = require('jsonwebtoken')
const {
  csrfCookieName,
  readSessionTokenFromCookieMap,
  sessionCookieName,
} = require('../utils/tenantSessionCookies')

describe('tenantSessionCookies', () => {
  const secret = 'test-secret'

  beforeAll(() => {
    process.env.JWT_SECRET = secret
  })

  test('names cookies per tenant', () => {
    expect(sessionCookieName('mg')).toBe('sessionToken_mg')
    expect(csrfCookieName('loopc')).toBe('csrfToken_loopc')
  })

  test('reads tenant-specific session cookie for portal tenant', () => {
    const token = jwt.sign({ id: '1', company: 'mg' }, secret)
    const value = readSessionTokenFromCookieMap(
      { sessionToken_mg: token },
      { hostname: 'api.loopcstrategies.com', headerTenant: 'mg' },
    )
    expect(value).toBe(token)
  })

  test('falls back to legacy sessionToken when tenant matches portal', () => {
    const token = jwt.sign({ id: '1', company: 'cg' }, secret)
    const value = readSessionTokenFromCookieMap(
      { sessionToken: token },
      { hostname: 'cg.loopcstrategies.com', headerTenant: 'cg' },
    )
    expect(value).toBe(token)
  })

  test('ignores legacy sessionToken when tenant does not match portal', () => {
    const token = jwt.sign({ id: '1', company: 'loopc' }, secret)
    const value = readSessionTokenFromCookieMap(
      { sessionToken: token, sessionToken_mg: jwt.sign({ id: '2', company: 'mg' }, secret) },
      { hostname: 'api.loopcstrategies.com', headerTenant: 'mg' },
    )
    expect(jwt.decode(value).company).toBe('mg')
  })
})
