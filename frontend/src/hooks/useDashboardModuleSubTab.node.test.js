import { describe, expect, test } from 'vitest'
import { resolveModuleSubTabFromUrl } from './useDashboardModuleSubTab'

const ADMIN_SUBS = ['users', 'permissions', 'tenants', 'settings']

describe('resolveModuleSubTabFromUrl', () => {
  test('reads sub from URL when tab matches module', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'admin',
      subFromUrl: 'permissions',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: true,
    })).toBe('permissions')
  })

  test('falls back to default when sub is missing or invalid', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'admin',
      subFromUrl: null,
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: true,
    })).toBe('users')

    expect(resolveModuleSubTabFromUrl({
      tabParam: 'admin',
      subFromUrl: 'unknown',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: true,
    })).toBe('users')
  })

  test('does not reset to default when module is active but URL tab is wrong', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'overview',
      subFromUrl: 'settings',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: true,
    })).toBeUndefined()
  })

  test('returns default when module is inactive and URL tab is wrong', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'overview',
      subFromUrl: 'settings',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: false,
    })).toBe('users')
  })

  test('allows tenants sub for LoopC platform admin allowlist', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'admin',
      subFromUrl: 'tenants',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
      isModuleActive: true,
    })).toBe('tenants')

    expect(resolveModuleSubTabFromUrl({
      tabParam: 'admin',
      subFromUrl: 'tenants',
      moduleTabId: 'admin',
      allowedSubIds: ['users', 'permissions', 'settings'],
      defaultSub: 'users',
      isModuleActive: true,
    })).toBe('users')
  })
})
