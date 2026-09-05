import { describe, expect, test } from 'vitest'
import tenantRoutingCases from '../../../shared/tenant-routing-cases.json'
import {
  getTenantBranding,
  isErpAdvancedListFiltersEnabled,
  isVoucherKeyboardNavEnabled,
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
    expect(mg.logoImage).toBe('/logos/mg-logo.png')
    expect(cg.logoImage).toBe('/logos/cg-logo.svg')
    expect(getTenantBranding('loopc').logoImage).toBe('/logos/loopc-logo.svg')
    expect(mg.enabledTabs).toContain('erp')
    expect(mg.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
  })

  test('applies MG orange, CG green, and LoopC blue tenant palettes', () => {
    expect(getTenantBranding('mg').colors.brandPrimary).toBe('#EA580C')
    expect(getTenantBranding('mg').colors.bgTopbar).toBe('#431407')
    expect(getTenantBranding('cg').colors.brandPrimary).toBe('#16A34A')
    expect(getTenantBranding('cg').colors.bgTopbar).toBe('#052E16')
    expect(getTenantBranding('loopc').colors.brandPrimary).toBe('#2563EB')
    expect(getTenantBranding('loopc').colors.bgTopbar).toBe('#172554')
  })

  test('enables advanced ERP list filters for LOOPC, MG, and CG', () => {
    expect(isErpAdvancedListFiltersEnabled('loopc')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('mg')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('cg')).toBe(true)
  })

  test('enables voucher keyboard nav for LoopC, MG, and CG', () => {
    expect(isVoucherKeyboardNavEnabled('loopc')).toBe(true)
    expect(isVoucherKeyboardNavEnabled('mg')).toBe(true)
    expect(isVoucherKeyboardNavEnabled('cg')).toBe(true)
  })
})
