const { describe, expect, test, beforeEach } = require('@jest/globals')
const { resetTenantCatalogCache, getTenantPortalOrigins } = require('../config/tenantRegistry')
const { resolveTenantFromRequest } = require('../utils/requestTenant')

describe('resolveTenantFromRequest', () => {
  beforeEach(() => {
    resetTenantCatalogCache()
    delete process.env.TENANT_REGISTRY_JSON
  })

  test('uses VB portal Origin when Host is the shared API domain', () => {
    const tenant = resolveTenantFromRequest({
      hostname: 'api.loopcstrategies.com',
      headers: {
        host: 'api.loopcstrategies.com',
        origin: 'https://vb.loopcstrategies.com',
      },
      query: {},
    })
    expect(tenant).toBe('vb')
  })

  test('uses venusbullions brand alias Origin', () => {
    const tenant = resolveTenantFromRequest({
      hostname: 'api.loopcstrategies.com',
      headers: {
        origin: 'https://venusbullions.loopcstrategies.com',
      },
      query: {},
    })
    expect(tenant).toBe('vb')
  })

  test('uses X-Forwarded-Host from the tenant portal rewrite', () => {
    const tenant = resolveTenantFromRequest({
      hostname: 'api.loopcstrategies.com',
      headers: {
        host: 'api.loopcstrategies.com',
        'x-forwarded-host': 'vb.loopcstrategies.com',
      },
      query: {},
    })
    expect(tenant).toBe('vb')
  })

  test('falls back to x-tenant when the request is server-to-server on the API host', () => {
    const tenant = resolveTenantFromRequest({
      hostname: 'api.loopcstrategies.com',
      headers: {
        host: 'api.loopcstrategies.com',
        'x-tenant': 'vb',
      },
      query: {},
    })
    expect(tenant).toBe('vb')
  })

  test('does not treat api subdomain as LoopC', () => {
    const tenant = resolveTenantFromRequest({
      hostname: 'api.loopcstrategies.com',
      headers: { host: 'api.loopcstrategies.com' },
      query: { company: 'vb' },
    })
    expect(tenant).toBe('vb')
  })
})

describe('getTenantPortalOrigins', () => {
  test('includes Venus Bullions portal and brand alias', () => {
    const origins = getTenantPortalOrigins()
    expect(origins).toEqual(expect.arrayContaining([
      'https://vb.loopcstrategies.com',
      'https://venusbullions.loopcstrategies.com',
      'https://mg.loopcstrategies.com',
    ]))
  })
})
