import { describe, expect, test } from 'vitest'
import tenantRoutingCases from '../../../shared/tenant-routing-cases.json'
import {
  getTenantBranding,
  isErpAdvancedListFiltersEnabled,
  resolveTenantFromHostname,
  resolveTenantFromSearch,
} from './tenantBranding'

describe('tenant branding integration', () => {
  test.each(tenantRoutingCases)('matches shared tenant routing case: $name', ({ hostname, fallback, expected }) => {
    expect(resolveTenantFromHostname(hostname, fallback)).toBe(expected)
  })

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
    expect(mg.companyName).toBe('MODERN GOLD JEWELRY MANUFACTURING')
    expect(mg.address).toMatch(/Namangan City/)
    expect(mg.logoImage).toBe('/logos/mg-logo.svg')
    expect(cg.logoImage).toBe('/logos/cg-logo.svg')
    expect(getTenantBranding('loopc').logoImage).toBe('/logos/loopc-logo.svg')
    expect(mg.enabledTabs).toContain('erp')
    expect(mg.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
  })

  test('enables advanced ERP list filters for LOOPC, MG, and CG', () => {
    expect(isErpAdvancedListFiltersEnabled('loopc')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('mg')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('cg')).toBe(true)
  })
})
