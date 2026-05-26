import { describe, expect, test } from 'vitest'
import {
  canViewERPModule,
  canViewErpSubTab,
  getAllowedErpSubTabs,
  resolveAllowedErpSubTab,
} from './erpSubTabPermissions'

describe('erpSubTabPermissions', () => {
  test('super admin can view every ERP sub tab', () => {
    expect(canViewErpSubTab({ role: 'super_admin' }, 'transactions')).toBe(true)
    expect(canViewErpSubTab({ role: 'super_admin' }, 'fixing-register')).toBe(true)
  })

  test('granular ERP off blocks all ERP sub tabs even with legacy allowedModules', () => {
    const user = {
      role: 'management',
      allowedModules: ['erp'],
      modulePermissions: { erp: { on: false } },
    }
    expect(canViewERPModule(user)).toBe(false)
    expect(canViewErpSubTab(user, 'dashboard')).toBe(false)
    expect(canViewErpSubTab(user, 'transactions')).toBe(false)
  })

  test('granular ERP sub tabs only allow configured pages', () => {
    const user = {
      role: 'management',
      modulePermissions: {
        erp: {
          on: true,
          subs: {
            dashboard: { on: true },
            accounts: { on: true },
            customers: { on: true },
          },
        },
      },
    }

    expect(canViewErpSubTab(user, 'dashboard')).toBe(true)
    expect(canViewErpSubTab(user, 'accounts')).toBe(true)
    expect(canViewErpSubTab(user, 'customers')).toBe(true)
    expect(canViewErpSubTab(user, 'transactions')).toBe(false)
    expect(canViewErpSubTab(user, 'mappings')).toBe(false)
    expect(canViewErpSubTab(user, 'fixing-register')).toBe(false)
    expect(getAllowedErpSubTabs(user)).toEqual(['dashboard', 'accounts', 'customers'])
  })

  test('resolveAllowedErpSubTab falls back to first allowed tab', () => {
    const user = {
      role: 'external',
      modulePermissions: {
        erp: {
          on: true,
          subs: { inventory: { on: true } },
        },
      },
    }

    expect(resolveAllowedErpSubTab(user, 'transactions')).toBe('inventory')
    expect(resolveAllowedErpSubTab(user, 'inventory')).toBe('inventory')
  })
})
