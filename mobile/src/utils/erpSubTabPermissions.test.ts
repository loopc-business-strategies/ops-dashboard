import { describe, expect, it } from 'vitest'
import { canAccessErpReports, canViewErpSubTab, hasGranularModulePermissions } from './erpSubTabPermissions'

/**
 * Regression tests for MG mobile ERP tab access (must stay aligned with
 * frontend/src/utils/erpSubTabPermissions.js canViewErpSubTab for subTab "reports").
 */
describe('erpSubTabPermissions (mobile ERP Reports tab)', () => {
  it('super_admin can access reports regardless of modulePermissions', () => {
    expect(canAccessErpReports({ role: 'super_admin', modulePermissions: { erp: { on: false } } })).toBe(true)
    expect(canAccessErpReports({ role: 'SUPER_ADMIN' })).toBe(true)
  })

  it('signed-out / empty user cannot access reports', () => {
    expect(canAccessErpReports(null)).toBe(false)
    expect(canAccessErpReports(undefined)).toBe(false)
    expect(canAccessErpReports({})).toBe(false)
  })

  it('allowedModules includes erp without granular permissions => reports allowed', () => {
    expect(canAccessErpReports({ allowedModules: ['erp'] })).toBe(true)
  })

  it('granular permissions but no explicit erp key: allowedModules erp => reports allowed', () => {
    expect(
      canAccessErpReports({
        allowedModules: ['erp'],
        modulePermissions: { finance: { on: true } },
      }),
    ).toBe(true)
  })

  it('granular + explicit erp but erp.on false => reports denied', () => {
    expect(
      canAccessErpReports({
        allowedModules: ['erp'],
        modulePermissions: { erp: { on: false, subs: { reports: { on: true } } } },
      }),
    ).toBe(false)
  })

  it('erp.on true and no subs => all ERP subs including reports', () => {
    expect(canAccessErpReports({ modulePermissions: { erp: { on: true } } })).toBe(true)
  })

  it('erp.on true with subs: only reports on => allowed', () => {
    expect(
      canAccessErpReports({
        modulePermissions: { erp: { on: true, subs: { reports: { on: true }, ledger: { on: false } } } },
      }),
    ).toBe(true)
  })

  it('erp.on true with subs: reports off => denied', () => {
    expect(
      canAccessErpReports({
        modulePermissions: { erp: { on: true, subs: { reports: { on: false }, ledger: { on: true } } } },
      }),
    ).toBe(false)
  })

  it('canViewErpSubTab mirrors reports-only for other subs (sanity)', () => {
    const user = {
      modulePermissions: { erp: { on: true, subs: { ledger: { on: true }, reports: { on: false } } } },
    }
    expect(canViewErpSubTab(user, 'ledger')).toBe(true)
    expect(canViewErpSubTab(user, 'reports')).toBe(false)
  })

  it('hasGranularModulePermissions detects non-empty modulePermissions', () => {
    expect(hasGranularModulePermissions({ modulePermissions: {} })).toBe(false)
    expect(hasGranularModulePermissions({ modulePermissions: { erp: { on: true } } })).toBe(true)
  })
})
