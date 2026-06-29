const { getRouteErrorStatus, respondRouteError } = require('../utils/routeErrorHelpers')

function mockRes() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    res.body = body
    return res
  }
  return res
}

describe('routeErrorHelpers', () => {
  it('maps CastError to 400', () => {
    expect(getRouteErrorStatus({ name: 'CastError' })).toBe(400)
  })

  it('maps explicit status on err object', () => {
    expect(getRouteErrorStatus({ status: 404, message: 'missing' })).toBe(404)
  })

  it('returns safe 500 message without leaking stack', () => {
    const res = mockRes()
    respondRouteError(res, new Error('db connection exploded'), { tag: 'erp.test' })
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, message: 'Server error' })
  })

  it('returns workflow validation message for 400-class errors', () => {
    const res = mockRes()
    respondRouteError(res, new Error('Invalid account code'), { tag: 'erp.test' })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('Invalid account code')
  })
})
