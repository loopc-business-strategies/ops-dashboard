import { describe, expect, test } from 'vitest'
import tenantRoutingCases from '../../../shared/tenant-routing-cases.json'
import {
  getTenantBranding,
  isAccountingPeriodClosingEnabled,
  isErpAdvancedListFiltersEnabled,
  isVoucher24HourLockEnabled,
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
    expect(resolveTenantFromHostname('vb.loopcstrategies.com')).toBe('vb')
    expect(resolveTenantFromHostname('venusbullions.loopcstrategies.com')).toBe('vb')
    expect(resolveTenantFromHostname('localhost', 'loopc')).toBe('loopc')
    expect(resolveTenantFromSearch('?tenant=mg', 'loopc')).toBe('mg')
    expect(resolveTenantFromSearch('?company=cg', 'loopc')).toBe('cg')
    expect(resolveTenantFromSearch('?company=vb', 'loopc')).toBe('vb')
  })

  test('returns tenant-specific visible branding and enabled ERP tabs', () => {
    const mg = getTenantBranding('mg')
    const cg = getTenantBranding('cg')
    const vb = getTenantBranding('vb')

    expect(mg.displayName).toBe('MG')
    expect(cg.displayName).toBe('CG')
    expect(vb.displayName).toBe('Venus Bullions')
    expect(mg.companyName).toBe('MODERN GOLD JEWELRY MANUFACTURING')
    expect(vb.companyName).toBe('Venus Bullions')
    expect(mg.address).toMatch(/Namangan City/)
    expect(mg.logoImage).toBe('/logos/mg-logo.png')
    expect(cg.logoImage).toBe('/logos/cg-logo.svg')
    expect(getTenantBranding('loopc').logoImage).toBe('/logos/loopc-logo.svg')
    expect(vb.logoImage).toBe('/logos/vb-logo.svg')
    expect(mg.enabledTabs).toContain('erp')
    expect(vb.enabledTabs).toContain('erp')
    expect(mg.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
    expect(vb.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
  })

  test('applies MG orange, CG green, LoopC blue, and VB amber tenant palettes', () => {
    expect(getTenantBranding('mg').colors.brandPrimary).toBe('#EA580C')
    expect(getTenantBranding('mg').colors.bgTopbar).toBe('#431407')
    expect(getTenantBranding('mg').colors.brandButtonBg).toBe('#9A3412')
    expect(getTenantBranding('mg').colors.brandButtonHover).toBe('#7C2D12')
    expect(getTenantBranding('cg').colors.brandPrimary).toBe('#16A34A')
    expect(getTenantBranding('cg').colors.bgTopbar).toBe('#052E16')
    expect(getTenantBranding('cg').colors.brandButtonBg).toBe('#166534')
    expect(getTenantBranding('cg').colors.brandButtonHover).toBe('#14532D')
    expect(getTenantBranding('loopc').colors.brandPrimary).toBe('#2563EB')
    expect(getTenantBranding('loopc').colors.bgTopbar).toBe('#172554')
    expect(getTenantBranding('loopc').colors.brandButtonBg).toBe('#1E3A8A')
    expect(getTenantBranding('loopc').colors.brandButtonHover).toBe('#172554')
    expect(getTenantBranding('vb').colors.brandPrimary).toBe('#B45309')
    expect(getTenantBranding('vb').colors.bgTopbar).toBe('#1C1917')
    expect(getTenantBranding('vb').colors.brandButtonBg).toBe('#78350F')
    expect(getTenantBranding('vb').colors.brandButtonHover).toBe('#451A03')
  })

  test('enables advanced ERP list filters for LOOPC, MG, CG, and VB', () => {
    expect(isErpAdvancedListFiltersEnabled('loopc')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('mg')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('cg')).toBe(true)
    expect(isErpAdvancedListFiltersEnabled('vb')).toBe(true)
  })

  test('enables voucher keyboard nav for LoopC, MG, CG, and VB', () => {
    expect(isVoucherKeyboardNavEnabled('loopc')).toBe(true)
    expect(isVoucherKeyboardNavEnabled('mg')).toBe(true)
    expect(isVoucherKeyboardNavEnabled('cg')).toBe(true)
    expect(isVoucherKeyboardNavEnabled('vb')).toBe(true)
  })

  test('enables period closing and 24h voucher lock for LoopC, MG, CG, and VB', () => {
    expect(isAccountingPeriodClosingEnabled('vb')).toBe(true)
    expect(isVoucher24HourLockEnabled('vb')).toBe(true)
    expect(isAccountingPeriodClosingEnabled('mg')).toBe(true)
    expect(isVoucher24HourLockEnabled('loopc')).toBe(true)
  })
})
