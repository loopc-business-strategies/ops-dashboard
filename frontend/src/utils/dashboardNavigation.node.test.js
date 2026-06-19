import { describe, expect, test } from 'vitest'
import {
  buildDashboardHref,
  buildDashboardTabParam,
  dashboardSearchFromState,
  isPrimaryNavClick,
  parseDashboardUrl,
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

  test('isPrimaryNavClick detects modifier keys', () => {
    expect(isPrimaryNavClick({ button: 0, metaKey: false, ctrlKey: false })).toBe(true)
    expect(isPrimaryNavClick({ button: 0, ctrlKey: true })).toBe(false)
    expect(isPrimaryNavClick({ button: 1 })).toBe(false)
  })
})
