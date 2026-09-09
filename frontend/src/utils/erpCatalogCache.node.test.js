import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import {
  buildCatalogCacheKey,
  fetchCatalogCached,
  getCachedCatalog,
  invalidateCatalogCache,
  CATALOG_KINDS,
} from './erpCatalogCache.js'

function stubLocalStorage() {
  const store = new Map()
  const api = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index) => [...store.keys()][index] || null,
    get length() { return store.size },
  }
  vi.stubGlobal('localStorage', api)
  return api
}

describe('erpCatalogCache tenant isolation', () => {
  beforeEach(() => {
    invalidateCatalogCache()
    stubLocalStorage()
  })

  afterEach(() => {
    invalidateCatalogCache()
    vi.unstubAllGlobals()
  })

  test('buildCatalogCacheKey includes tenant so cookie-session keys do not collide', () => {
    const mgKey = buildCatalogCacheKey(CATALOG_KINDS.accounts, 'cookie-session', { page: 1 }, 'mg')
    const vbKey = buildCatalogCacheKey(CATALOG_KINDS.accounts, 'cookie-session', { page: 1 }, 'vb')
    expect(mgKey).toContain('|mg|')
    expect(vbKey).toContain('|vb|')
    expect(mgKey).not.toBe(vbKey)
  })

  test('resolves tenant from localStorage when explicit tenant omitted', () => {
    localStorage.setItem('tenantCompany', 'vb')
    const key = buildCatalogCacheKey(CATALOG_KINDS.currencies, 'cookie-session', {})
    expect(key).toContain('|vb|')
  })

  test('fetchCatalogCached isolates data across tenants with the same cookie token', async () => {
    localStorage.setItem('tenantCompany', 'mg')
    await fetchCatalogCached(CATALOG_KINDS.accounts, 'cookie-session', {}, async () => ({ accounts: ['mg-a'] }))
    expect(getCachedCatalog(CATALOG_KINDS.accounts, 'cookie-session', {})).toEqual({ accounts: ['mg-a'] })

    localStorage.setItem('tenantCompany', 'vb')
    expect(getCachedCatalog(CATALOG_KINDS.accounts, 'cookie-session', {})).toBeNull()
    await fetchCatalogCached(CATALOG_KINDS.accounts, 'cookie-session', {}, async () => ({ accounts: ['vb-a'] }))
    expect(getCachedCatalog(CATALOG_KINDS.accounts, 'cookie-session', {})).toEqual({ accounts: ['vb-a'] })

    localStorage.setItem('tenantCompany', 'mg')
    expect(getCachedCatalog(CATALOG_KINDS.accounts, 'cookie-session', {})).toEqual({ accounts: ['mg-a'] })
  })
})
