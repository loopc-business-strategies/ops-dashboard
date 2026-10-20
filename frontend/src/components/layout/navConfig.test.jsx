import { describe, expect, test } from 'vitest'
import { getNavItems } from './navConfig'

const t = (key) => key

function perms({ modules = [], canApproveMgFloor = false } = {}) {
  return {
    canViewModule: (module) => modules.includes(module),
    canViewAdmin: false,
    canViewERP: false,
    canApproveMgFloor,
  }
}

const ids = (items) => items.map((item) => item.id)

describe('getNavItems — Operations visibility', () => {
  test('MG Floor approvers see Operations even without the Operations module', () => {
    const items = getNavItems(perms({ modules: ['production'], canApproveMgFloor: true }), t)
    expect(ids(items)).toEqual(expect.arrayContaining(['production-new', 'operations']))
  })

  test('users without the module or approve rights do not see Operations', () => {
    const items = getNavItems(perms({ modules: ['production'] }), t)
    expect(ids(items)).not.toContain('operations')
  })

  test('the tenant branding still decides whether Operations exists at all', () => {
    const branding = { enabledTabs: ['production-new', 'master-settings'], enabledErpSubTabs: [], featureFlags: {} }
    const items = getNavItems(perms({ modules: ['production'], canApproveMgFloor: true }), t, 0, branding)
    expect(ids(items)).not.toContain('operations')
  })

  test('VB coming-soon mode locks Overview, Chat, Master Settings, Departments, Operations, and Production', () => {
    const branding = {
      enabledTabs: ['overview', 'chat', 'master-settings', 'departments', 'operations', 'production-new', 'erp'],
      enabledErpSubTabs: [],
      featureFlags: { departmentsComingSoon: true },
    }
    const items = getNavItems(perms({ modules: ['overview'] }), t, 3, branding)
    expect(ids(items)).toEqual(expect.arrayContaining([
      'overview',
      'chat',
      'master-settings',
      'departments',
      'operations',
      'production-new',
    ]))
    expect(items.find((item) => item.id === 'chat')?.badge).toBeNull()
    expect(items.find((item) => item.id === 'overview')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'chat')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'master-settings')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'departments')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'operations')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'production-new')?.comingSoon).toBe(true)
    expect(items.find((item) => item.id === 'production-new')?.openInNewTab).toBe(false)
    expect(ids(items)).not.toContain('hr')
  })
})
