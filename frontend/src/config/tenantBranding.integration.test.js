import { describe, expect, test } from 'vitest'
import { getTenantBranding, resolveTenantFromHostname, resolveTenantFromSearch } from './tenantBranding'

describe('tenant branding integration', () => {
  test('resolves tenant from production-style subdomains and query overrides', () => {
    expect(resolveTenantFromHostname('mg.loopcstrategies.com')).toBe('mg')
    expect(resolveTenantFromHostname('cg.loopcstrategies.com')).toBe('cg')
    expect(resolveTenantFromHostname('localhost', 'loopc')).toBe('loopc')
    expect(resolveTenantFromSearch('?tenant=mg', 'loopc')).toBe('mg')
    expect(resolveTenantFromSearch('?company=cg', 'loopc')).toBe('cg')
  })

  test('returns tenant-specific visible branding and enabled ERP tabs', () => {
    const mg = getTenantBranding('mg')
    const cg = getTenantBranding('cg')

    expect(mg.displayName).toBe('MG')
    expect(cg.displayName).toBe('CG')
    expect(mg.enabledTabs).toContain('erp')
    expect(mg.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
  })
})
