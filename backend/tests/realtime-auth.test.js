const jwt = require('jsonwebtoken')

jest.mock('../models/User', () => ({
  getTenantModel: jest.fn(),
}))

const User = require('../models/User')
const {
  authenticateSocket,
  getSocketToken,
  resolveSocketTenantSubscription,
  handleDashboardMetricsSubscribe,
} = require('../realtime/RealtimeServer')

const buildSocket = ({ token, cookie, host = 'api.loopcstrategies.com', tenant = 'loopc' } = {}) => ({
  handshake: {
    auth: token ? { token } : { token: 'browser-session' },
    headers: {
      host,
      cookie: cookie || '',
      'x-tenant': tenant,
      'x-company': tenant,
    },
  },
})

describe('realtime socket authentication', () => {
  const originalJwtSecret = process.env.JWT_SECRET
  const userId = '507f1f77bcf86cd799439011'

  beforeEach(() => {
    process.env.JWT_SECRET = 'socket-test-secret'
    User.getTenantModel.mockReset()
  })

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
  })

  test('extracts tenant session cookie when browser-session marker is used', () => {
    const token = jwt.sign({ id: userId, company: 'loopc' }, process.env.JWT_SECRET)
    const socket = buildSocket({
      cookie: `csrfToken=abc; sessionToken_loopc=${encodeURIComponent(token)}`,
      tenant: 'loopc',
    })

    expect(getSocketToken(socket)).toBe(token)
  })

  test('extracts legacy session cookie when JWT tenant matches portal', () => {
    const token = jwt.sign({ id: userId, company: 'loopc' }, process.env.JWT_SECRET)
    const socket = buildSocket({
      cookie: `csrfToken=abc; sessionToken=${encodeURIComponent(token)}`,
      tenant: 'loopc',
      host: 'loopc.loopcstrategies.com',
    })

    expect(getSocketToken(socket)).toBe(token)
  })

  test('authenticates a valid socket token against the tenant user model', async () => {
    const token = jwt.sign({ id: userId, company: 'mg' }, process.env.JWT_SECRET)
    const select = jest.fn().mockResolvedValue({
      _id: userId,
      name: 'Realtime User',
      role: 'super_admin',
      isActive: true,
      isDeleted: false,
    })
    const findById = jest.fn(() => ({ select }))
    User.getTenantModel.mockResolvedValue({ findById })

    const socket = buildSocket({ token, tenant: 'mg' })
    await authenticateSocket(socket)

    expect(User.getTenantModel).toHaveBeenCalledWith('mg')
    expect(findById).toHaveBeenCalledWith(userId)
    expect(socket.userId).toBe(userId)
    expect(socket.tenant).toBe('mg')
    expect(socket.userRole).toBe('super_admin')
  })

  test('rejects tenant mismatch between token and requested tenant', async () => {
    const token = jwt.sign({ id: userId, company: 'loopc' }, process.env.JWT_SECRET)
    const socket = buildSocket({ token, tenant: 'mg', host: 'api.loopcstrategies.com' })

    await expect(authenticateSocket(socket)).rejects.toThrow(/tenant does not match/i)
    expect(User.getTenantModel).not.toHaveBeenCalled()
  })

  test('uses authenticated tenant for realtime room subscriptions', () => {
    expect(resolveSocketTenantSubscription({ tenant: 'mg' }, 'mg')).toBe('mg')
    expect(resolveSocketTenantSubscription({ tenant: 'mg' }, '')).toBe('mg')
    expect(resolveSocketTenantSubscription({ tenant: 'mg' }, undefined)).toBe('mg')
    expect(() => resolveSocketTenantSubscription({ tenant: 'mg' }, 'cg')).toThrow(/does not match/i)
    expect(() => resolveSocketTenantSubscription({}, 'mg')).toThrow(/Authenticated tenant is missing/i)
  })

  test('dashboard metrics subscribe resolves room from authenticated tenant only', () => {
    const ok = handleDashboardMetricsSubscribe({ tenant: 'loopc' }, 'loopc')
    expect(ok).toEqual({ ok: true, tenant: 'loopc', room: 'dashboard:metrics:loopc' })

    const omitted = handleDashboardMetricsSubscribe({ tenant: 'mg' }, '')
    expect(omitted).toEqual({ ok: true, tenant: 'mg', room: 'dashboard:metrics:mg' })

    const denied = handleDashboardMetricsSubscribe({ tenant: 'mg' }, 'cg')
    expect(denied.ok).toBe(false)
    expect(denied.error).toBeInstanceOf(Error)
  })
})
