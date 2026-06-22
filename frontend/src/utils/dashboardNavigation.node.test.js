import { describe, expect, test } from 'vitest'
import {
  buildDashboardHref,
  buildDashboardSearchParams,
  buildDashboardTabParam,
  buildEnquiryHref,
  dashboardSearchFromState,
  enquiryDeepLinkKey,
  isPrimaryNavClick,
  parseDashboardUrl,
  parseEnquiryDeepLink,
} from './dashboardNavigation'

const superAdmin = { role: 'super_admin' }

describe('dashboardNavigation', () => {
  test('buildDashboardTabParam encodes ERP sub-tabs', () => {
    expect(buildDashboardTabParam({ tabId: 'erp', erpSub: 'supplier-margin' })).toBe('erp-supplier-margin')
    expect(buildDashboardTabParam({ tabId: 'hr' })).toBe('hr')
  })

  test('buildDashboardHref round-trips ERP and department tabs', () => {
    expect(buildDashboardHref({ tabId: 'erp', erpSub: 'enquiry' })).toBe('/dashboard?tab=erp-enquiry')
    expect(buildDashboardHref({ tabId: 'hr', sub: 'labour_law' })).toBe('/dashboard?tab=hr&sub=labour_law')
    expect(buildDashboardHref({ tabId: 'overview', company: 'mg', includeCompany: true }))
      .toBe('/dashboard?tab=overview&company=mg')
    expect(buildDashboardHref({ tabId: 'admin', sub: 'permissions' })).toBe('/dashboard?tab=admin&sub=permissions')
    expect(buildDashboardHref({ tabId: 'admin', sub: 'settings' })).toBe('/dashboard?tab=admin&sub=settings')
  })

  test('parseDashboardUrl resolves ERP and module sub tabs', () => {
    expect(parseDashboardUrl('?tab=erp-supplier-margin', superAdmin)).toEqual({
      activeTab: 'erp',
      erpSubTab: 'supplier-margin',
      moduleSubTab: null,
    })
    expect(parseDashboardUrl('?tab=hr&sub=labour_law', superAdmin)).toEqual({
      activeTab: 'hr',
      erpSubTab: 'dashboard',
      moduleSubTab: 'labour_law',
    })
    expect(parseDashboardUrl('?tab=admin&sub=settings', superAdmin)).toEqual({
      activeTab: 'admin',
      erpSubTab: 'dashboard',
      moduleSubTab: 'settings',
    })
    expect(parseDashboardUrl('', superAdmin).activeTab).toBe('overview')
  })

  test('dashboardSearchFromState omits sub for ERP tabs', () => {
    const params = dashboardSearchFromState({
      activeTab: 'erp',
      erpSubTab: 'ledger',
      moduleSubTab: 'ignored',
    })
    expect(params.get('tab')).toBe('erp-ledger')
    expect(params.get('sub')).toBeNull()
  })

  test('buildEnquiryHref encodes account summary deep links', () => {
    expect(buildEnquiryHref({ account: '1000' })).toBe('/dashboard?tab=erp-enquiry&account=1000')
    expect(buildEnquiryHref({ account: '2100', view: 'statement', company: 'mg', includeCompany: true }))
      .toBe('/dashboard?tab=erp-enquiry&account=2100&view=statement&company=mg')
  })

  test('parseEnquiryDeepLink reads account summary params', () => {
    expect(parseEnquiryDeepLink('?tab=erp-enquiry&account=1000&view=statement')).toEqual({
      account: '1000',
      view: 'statement',
    })
    expect(parseEnquiryDeepLink('?tab=erp-ledger')).toEqual({ account: null, view: null })
  })

  test('buildDashboardSearchParams preserves enquiry params when re-opening Account Summary', () => {
    const preserveFrom = '?tab=erp-enquiry&account=1000&view=statement&company=mg'
    const params = buildDashboardSearchParams({
      activeTab: 'erp',
      erpSubTab: 'enquiry',
      preserveFrom,
      company: 'mg',
      includeCompany: true,
    })
    expect(params.get('tab')).toBe('erp-enquiry')
    expect(params.get('account')).toBe('1000')
    expect(params.get('view')).toBe('statement')
    expect(params.get('company')).toBe('mg')
  })

  test('buildDashboardSearchParams clears enquiry params when leaving Account Summary', () => {
    const preserveFrom = '?tab=erp-enquiry&account=1000&view=statement'
    const params = buildDashboardSearchParams({
      activeTab: 'erp',
      erpSubTab: 'ledger',
      preserveFrom,
    })
    expect(params.get('tab')).toBe('erp-ledger')
    expect(params.get('account')).toBeNull()
    expect(params.get('view')).toBeNull()
  })

  test('buildDashboardHref preserves enquiry account for sidebar open-in-new-tab', () => {
    const href = buildDashboardHref({
      tabId: 'erp',
      erpSub: 'enquiry',
      account: '1000',
      view: 'statement',
    })
    expect(href).toBe('/dashboard?tab=erp-enquiry&account=1000&view=statement')
  })

  test('enquiryDeepLinkKey dedupes account summary loads', () => {
    expect(enquiryDeepLinkKey({ account: '1000' })).toBe('1000|')
    expect(enquiryDeepLinkKey({ account: '1000', view: 'statement' })).toBe('1000|statement')
    expect(enquiryDeepLinkKey({ account: '' })).toBe('')
  })
})
