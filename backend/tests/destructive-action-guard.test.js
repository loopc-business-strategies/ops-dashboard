const { requireDestructiveAdminGuard } = require('../middleware/destructiveAction')

function runGuard({ actionName = 'test-action', env = {}, headers = {}, body = {} } = {}) {
  const req = { headers, body }
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
  const next = jest.fn()

  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_DESTRUCTIVE_ADMIN_API: process.env.ENABLE_DESTRUCTIVE_ADMIN_API,
    ENABLE_PERMANENT_DELETE_API: process.env.ENABLE_PERMANENT_DELETE_API,
    DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN,
    CLEANUP_CONFIRM_TOKEN: process.env.CLEANUP_CONFIRM_TOKEN,
  }

  for (const key of Object.keys(previousEnv)) {
    if (Object.prototype.hasOwnProperty.call(env, key)) process.env[key] = env[key]
    else delete process.env[key]
  }

  requireDestructiveAdminGuard(actionName)(req, res, next)

  Object.entries(previousEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })

  return { req, res, next }
}

describe('destructive action guard', () => {
  test('blocks production when destructive API is disabled', () => {
    const { res, next } = runGuard({
      env: {
        NODE_ENV: 'production',
        ENABLE_DESTRUCTIVE_ADMIN_API: 'false',
        DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret',
      },
      headers: { 'x-destructive-token': 'secret' },
      body: { reason: 'valid reason' },
    })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.payload.message).toMatch(/disabled in production/i)
  })

  test('requires configured confirmation token', () => {
    const { res, next } = runGuard({
      env: { NODE_ENV: 'test' },
      body: { reason: 'valid reason' },
    })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
    expect(res.payload.message).toMatch(/token is not configured/i)
  })

  test('requires matching token and reason', () => {
    const missingReason = runGuard({
      env: { NODE_ENV: 'test', DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret' },
      headers: { 'x-destructive-token': 'secret' },
      body: { reason: 'short' },
    })

    expect(missingReason.next).not.toHaveBeenCalled()
    expect(missingReason.res.statusCode).toBe(400)

    const badToken = runGuard({
      env: { NODE_ENV: 'test', DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret' },
      headers: { 'x-destructive-token': 'wrong' },
      body: { reason: 'valid reason' },
    })

    expect(badToken.next).not.toHaveBeenCalled()
    expect(badToken.res.statusCode).toBe(403)
  })

  test('passes with enabled production gate, matching token, and reason', () => {
    const { req, res, next } = runGuard({
      env: {
        NODE_ENV: 'production',
        ENABLE_DESTRUCTIVE_ADMIN_API: 'true',
        DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret',
      },
      headers: { 'x-destructive-token': 'secret' },
      body: { reason: 'monthly admin cleanup' },
    })

    expect(res.payload).toBe(null)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.destructiveAction.reason).toBe('monthly admin cleanup')
  })

  test('blocks production permanent deletes unless separately enabled', () => {
    const { res, next } = runGuard({
      actionName: 'ledger-permanent-delete',
      env: {
        NODE_ENV: 'production',
        ENABLE_DESTRUCTIVE_ADMIN_API: 'true',
        DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret',
      },
      headers: { 'x-destructive-token': 'secret' },
      body: { reason: 'approved maintenance cleanup' },
    })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.payload.message).toMatch(/permanent delete api is disabled/i)
  })

  test('allows production permanent deletes only when permanent gate is enabled', () => {
    const { res, next } = runGuard({
      actionName: 'ledger-permanent-delete',
      env: {
        NODE_ENV: 'production',
        ENABLE_DESTRUCTIVE_ADMIN_API: 'true',
        ENABLE_PERMANENT_DELETE_API: 'true',
        DESTRUCTIVE_ADMIN_CONFIRM_TOKEN: 'secret',
      },
      headers: { 'x-destructive-token': 'secret' },
      body: { reason: 'approved maintenance cleanup' },
    })

    expect(res.payload).toBe(null)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
