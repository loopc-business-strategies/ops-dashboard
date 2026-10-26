import { describe, expect, test } from 'vitest'
import tenantRoutingCases from '../../../shared/tenant-routing-cases.json'
import {
  applyTenantDocumentMeta,
  getTenantBranding,
  isAccountingPeriodClosingEnabled,
  isDepartmentsComingSoonEnabled,
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
    expect(vb.displayName).toBe('Venus Bullion')
    expect(mg.controlSystem).toBe('MG Business Control System')
    expect(mg.tagline).toBe('MG Business Control System')
    expect(cg.controlSystem).toBe('Business Control System')
    expect(cg.tagline).toBe('Business Control System')
    expect(getTenantBranding('loopc').controlSystem).toBe('Business Control System')
    expect(getTenantBranding('loopc').tagline).toBe('Business Control System')
    expect(vb.controlSystem).toBe('Business Control System')
    expect(vb.favicon).toBe('/logos/vb-logo.png')
    expect(mg.favicon).toBe('/logos/mg-icon-64.png')
    expect(mg.appleTouchIcon).toBe('/logos/mg-icon.png')
    expect(mg.companyName).toBe('MODERN GOLD JEWELRY MANUFACTURING')
    expect(vb.companyName).toBe('Venus Bullion Gold Trading L.L.C')
    expect(vb.address).toMatch(/Al Dhagaya Gold Souq/)
    expect(vb.phone).toBe('+971 4 286 8222')
    expect(mg.address).toMatch(/Namangan City/)
    expect(mg.logoImage).toBe('/logos/mg-logo.png')
    expect(cg.logoImage).toBe('/logos/cg-logo.svg')
    expect(getTenantBranding('loopc').logoImage).toBe('/logos/loopc-logo.svg')
    expect(vb.logoImage).toBe('/logos/vb-logo.png')
    expect(vb.logoUrl).toBe('/logos/vb-logo.png')
    expect(vb.colors.sidebarLogoPlate).toBe('transparent')
    expect(mg.enabledTabs).toContain('erp')
    expect(vb.enabledTabs).toContain('erp')
    expect(vb.enabledTabs).toContain('departments')
    expect(vb.enabledTabs).toContain('chat')
    expect(vb.enabledTabs).toContain('operations')
    expect(vb.enabledTabs).toContain('production-new')
    expect(vb.enabledTabs).not.toContain('hr')
    expect(vb.featureFlags.departmentsComingSoon).toBe(true)
    expect(isDepartmentsComingSoonEnabled('vb')).toBe(true)
    expect(isDepartmentsComingSoonEnabled('mg')).toBe(false)
    expect(mg.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
    expect(vb.enabledErpSubTabs).toEqual(expect.arrayContaining(['accounts', 'transactions', 'vouchers']))
  })

  test('applyTenantDocumentMeta sets MG title and square favicon mark', () => {
    document.title = 'Ops Dashboard'
    let icon = document.querySelector("link[rel='icon']")
    if (!icon) {
      icon = document.createElement('link')
      icon.setAttribute('rel', 'icon')
      icon.setAttribute('href', '/favicon.svg')
      icon.setAttribute('type', 'image/svg+xml')
      document.head.appendChild(icon)
    } else {
      icon.setAttribute('href', '/favicon.svg')
      icon.setAttribute('type', 'image/svg+xml')
    }

    const restore = applyTenantDocumentMeta(getTenantBranding('mg'))
    expect(document.title).toBe('MG')
    const next = document.querySelector("link[rel='icon']")
    expect(next?.getAttribute('href')).toBe('/logos/mg-icon-64.png')
    expect(next?.getAttribute('type')).toBe('image/png')
    expect(next?.getAttribute('sizes')).toBe('64x64')
    expect(document.querySelector("link[rel='apple-touch-icon']")?.getAttribute('href')).toBe('/logos/mg-icon.png')
    restore()
  })

  test('applyTenantDocumentMeta sets Venus Bullion title and favicon', () => {
    document.title = 'Ops Dashboard'
    let icon = document.querySelector("link[rel='icon']")
    if (!icon) {
      icon = document.createElement('link')
      icon.setAttribute('rel', 'icon')
      icon.setAttribute('href', '/favicon.svg')
      icon.setAttribute('type', 'image/svg+xml')
      document.head.appendChild(icon)
    } else {
      icon.setAttribute('href', '/favicon.svg')
      icon.setAttribute('type', 'image/svg+xml')
    }

    const restore = applyTenantDocumentMeta(getTenantBranding('vb'))
    expect(document.title).toBe('Venus Bullion')
    const next = document.querySelector("link[rel='icon']")
    expect(next?.getAttribute('href')).toBe('/logos/vb-logo.png')
    expect(next?.getAttribute('type')).toBe('image/png')
    restore()
    expect(document.title).toBe('Ops Dashboard')
  })

  test('applies MG orange, CG green, LoopC blue, and VB black/gold tenant palettes', () => {
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
    // Venus Bullion site tokens: --black2 / --gold-dk / --gold / --black
    expect(getTenantBranding('vb').colors.brandPrimary).toBe('#0E0E0E')
    expect(getTenantBranding('vb').colors.brandAccent).toBe('#D8A84F')
    expect(getTenantBranding('vb').colors.brandSoftBg).toBe('#FBF8F1')
    expect(getTenantBranding('vb').colors.bgTopbar).toBe('#070707')
    expect(getTenantBranding('vb').colors.brandButtonBg).toBe('#9B6B1F')
    expect(getTenantBranding('vb').colors.brandButtonHover).toBe('#7A5418')
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
