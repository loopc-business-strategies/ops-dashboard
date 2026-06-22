import { describe, expect, test } from 'vitest'
import {
  resolveModuleSubTabFromUrl,
  shouldSyncSubTabFromUrl,
} from './useDashboardModuleSubTab'

const ADMIN_SUBS = ['users', 'permissions', 'tenants', 'settings']
const HR_SUBS = ['employee_list', 'labour_law', 'current_updates']

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

  test('defaults isModuleActive to true when URL tab is wrong', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'overview',
      subFromUrl: 'settings',
      moduleTabId: 'admin',
      allowedSubIds: ADMIN_SUBS,
      defaultSub: 'users',
    })).toBeUndefined()
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

  test('reads HR subs from URL', () => {
    expect(resolveModuleSubTabFromUrl({
      tabParam: 'hr',
      subFromUrl: 'labour_law',
      moduleTabId: 'hr',
      allowedSubIds: HR_SUBS,
      defaultSub: 'employee_list',
    })).toBe('labour_law')

    expect(resolveModuleSubTabFromUrl({
      tabParam: 'hr',
      subFromUrl: 'employee_list',
      moduleTabId: 'hr',
      allowedSubIds: HR_SUBS,
      defaultSub: 'employee_list',
    })).toBe('employee_list')
  })
})

describe('shouldSyncSubTabFromUrl', () => {
  test('syncs when tab or sub changes in URL', () => {
    expect(shouldSyncSubTabFromUrl('admin', 'users', 'admin', 'settings')).toBe(true)
    expect(shouldSyncSubTabFromUrl('admin', 'users', 'hr', 'users')).toBe(true)
    expect(shouldSyncSubTabFromUrl('hr', 'employee_list', 'hr', 'labour_law')).toBe(true)
  })

  test('does not sync when URL tab and sub are unchanged (optimistic click before router updates)', () => {
    expect(shouldSyncSubTabFromUrl('admin', 'users', 'admin', 'users')).toBe(false)
    expect(shouldSyncSubTabFromUrl('hr', 'labour_law', 'hr', 'labour_law')).toBe(false)
  })

  test('initial sync when prev tab/sub are undefined', () => {
    expect(shouldSyncSubTabFromUrl(undefined, undefined, 'admin', 'permissions')).toBe(true)
    expect(shouldSyncSubTabFromUrl(undefined, undefined, 'hr', 'employee_list')).toBe(true)
  })
})
