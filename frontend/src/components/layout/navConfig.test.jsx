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
})
