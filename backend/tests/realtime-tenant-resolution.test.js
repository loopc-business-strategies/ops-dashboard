/**
 * Automated checks for mg/cg/loopc realtime tenant routing (Socket + SSE).
 * Mirrors auth middleware: req.tenant is a string tenant key.
 */

const { resolveRequestTenantKey } = require('../config/tenants')
const { publishRealtimeEvent, bus } = require('../utils/realtimeBus')

describe('resolveRequestTenantKey', () => {
  test('uses string req.tenant (auth middleware shape)', () => {
    expect(resolveRequestTenantKey({ tenant: 'mg', user: {} })).toBe('mg')
    expect(resolveRequestTenantKey({ tenant: 'CG', user: {} })).toBe('cg')
    expect(resolveRequestTenantKey({ tenant: 'loopc' })).toBe('loopc')
  })

  test('supports object req.tenant.key for forward compatibility', () => {
    expect(resolveRequestTenantKey({ tenant: { key: 'mg' } })).toBe('mg')
  })

  test('falls back to req.user.tenant when normalized', () => {
    expect(resolveRequestTenantKey({ user: { tenant: 'loopc' } })).toBe('loopc')
  })

  test('returns default when tenant cannot be resolved', () => {
    expect(resolveRequestTenantKey(null)).toBe('default')
    expect(resolveRequestTenantKey({})).toBe('default')
    expect(resolveRequestTenantKey({ tenant: 'unknown' })).toBe('default')
  })
})

describe('realtimeBus tenant filtering contract', () => {
  test('publishRealtimeEvent normalizes tenant for SSE consumers', (done) => {
    const received = []
    const handler = (event) => {
      received.push(event)
    }
    bus.on('event', handler)
    publishRealtimeEvent({
      type: 'message.created',
      tenant: 'MG',
      data: { id: 'x' },
    })
    setImmediate(() => {
      bus.off('event', handler)
      expect(received).toHaveLength(1)
      expect(received[0].tenant).toBe('mg')
      expect(received[0].type).toBe('message.created')
      done()
    })
  })
})
