const { describe, expect, test, beforeEach } = require('@jest/globals')
const {
  getTenantKeys,
  normalizeTenantKey,
  resolveTenantFromHost,
  resolveTenantFromHostOrNull,
  resolveTenantFromCustomDomain,
  getTenantsForApi,
  resetTenantCatalogCache,
} = require('../config/tenantRegistry')

describe('tenantRegistry', () => {
  beforeEach(() => {
    resetTenantCatalogCache()
    delete process.env.TENANT_REGISTRY_JSON
  })

  test('lists built-in tenants from shared catalog', () => {
    const keys = getTenantKeys()
    expect(keys).toEqual(expect.arrayContaining(['mg', 'cg', 'loopc', 'vb']))
  })

  test('normalizes tenant keys case-insensitively', () => {
    expect(normalizeTenantKey('MG')).toBe('mg')
    expect(normalizeTenantKey(' unknown ')).toBeNull()
  })

  test('resolves subdomain hostnames to tenant keys', () => {
    expect(resolveTenantFromHost('mg.loopcstrategies.com')).toBe('mg')
    expect(resolveTenantFromHost('cg.loopcstrategies.com')).toBe('cg')
    expect(resolveTenantFromHost('vb.loopcstrategies.com')).toBe('vb')
    expect(resolveTenantFromHost('venusbullions.loopcstrategies.com')).toBe('vb')
    expect(resolveTenantFromHost('localhost', 'loopc')).toBe('loopc')
    expect(resolveTenantFromHost('api.loopcstrategies.com', 'mg')).toBe('mg')
    expect(resolveTenantFromHost('example.com', 'loopc')).toBeNull()
  })

  test('does not map the shared API host to a tenant without a fallback', () => {
    expect(resolveTenantFromHostOrNull('api.loopcstrategies.com')).toBeNull()
    expect(resolveTenantFromHost('api.loopcstrategies.com', 'vb')).toBe('vb')
  })

  test('resolves enterprise custom domains from catalog', () => {
    expect(resolveTenantFromCustomDomain('erp.enterprise-demo.com')).toBe('mg')
    expect(resolveTenantFromHost('erp.enterprise-demo.com')).toBe('mg')
  })

  test('merges TENANT_REGISTRY_JSON overlay', () => {
    process.env.TENANT_REGISTRY_JSON = JSON.stringify({
      tenants: {
        acme: {
          key: 'acme',
          displayName: 'Acme',
          portalHost: 'acme.loopcstrategies.com',
          envVar: 'MONGO_URI_ACME',
        },
      },
      customDomains: {
        'erp.acme.com': 'acme',
      },
    })
    resetTenantCatalogCache()

    expect(getTenantKeys()).toEqual(expect.arrayContaining(['acme']))
    expect(resolveTenantFromCustomDomain('erp.acme.com')).toBe('acme')
    expect(getTenantsForApi().find((row) => row.key === 'acme')).toMatchObject({
      displayName: 'Acme',
      portalHost: 'acme.loopcstrategies.com',
    })
  })
})
