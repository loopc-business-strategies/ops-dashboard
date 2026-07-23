import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = { extra: {} as Record<string, string | undefined> }
const secureStore = {
  companyCode: null as string | null,
  sessionToken: null as string | null,
  legacySessionToken: null as string | null,
}

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      get extra() {
        return { ...mockState.extra }
      },
    },
  },
}))

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => {
    if (key === 'nexa_company_code') return secureStore.companyCode
    if (key === 'nexa_session_token') return secureStore.sessionToken
    if (key === 'mg_ops_session_token') return secureStore.legacySessionToken
    return null
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (key === 'nexa_company_code') secureStore.companyCode = value
    if (key === 'nexa_session_token') secureStore.sessionToken = value
    if (key === 'mg_ops_session_token') secureStore.legacySessionToken = value
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    if (key === 'nexa_company_code') secureStore.companyCode = null
    if (key === 'nexa_session_token') secureStore.sessionToken = null
    if (key === 'mg_ops_session_token') secureStore.legacySessionToken = null
  }),
}))

function jwtWithCompany(company: string) {
  const payload = Buffer.from(JSON.stringify({ company })).toString('base64url')
  return `header.${payload}.signature`
}

describe('tenant config (Nexa mobile API / tenant)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.extra = {}
    secureStore.companyCode = null
    secureStore.sessionToken = null
    secureStore.legacySessionToken = null
    delete process.env.EXPO_PUBLIC_API_URL
    delete process.env.EAS_BUILD_PROFILE
  })

  it('throws when API URL is missing outside production', async () => {
    mockState.extra = { tenant: 'loopc' }
    await expect(import('./tenant')).rejects.toThrow(/Missing API URL/)
  })

  it('allows production profile fallback to prod API when extra/env unset', async () => {
    mockState.extra = { tenant: 'loopc', easBuildProfile: 'production' }
    const { getTenant, API_URL } = await import('./tenant')
    expect(getTenant()).toBe('loopc')
    expect(API_URL).toBe('https://api.loopcstrategies.com')
  })

  it('respects expo extra tenant and apiUrl when provided', async () => {
    mockState.extra = { tenant: 'cg', apiUrl: 'https://api.example.test' }
    const { getTenant, API_URL } = await import('./tenant')
    expect(getTenant()).toBe('cg')
    expect(API_URL).toBe('https://api.example.test')
  })

  it('setTenant normalizes and validates company codes', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    const { setTenant, getTenant } = await import('./tenant')
    expect(setTenant('LOOPC')).toBe('loopc')
    expect(getTenant()).toBe('loopc')
    expect(() => setTenant('invalid')).toThrow(/Invalid company code/)
  })

  it('EXPO_PUBLIC_API_URL overrides default API when extra.apiUrl missing', async () => {
    mockState.extra = { tenant: 'mg' }
    process.env.EXPO_PUBLIC_API_URL = 'https://staging.example.test'
    const { API_URL } = await import('./tenant')
    expect(API_URL).toBe('https://staging.example.test')
  })

  it('decodeTenantFromJwt reads company from JWT payload', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    const { decodeTenantFromJwt } = await import('./tenant')
    expect(decodeTenantFromJwt(jwtWithCompany('cg'))).toBe('cg')
    expect(decodeTenantFromJwt(jwtWithCompany('LOOPC'))).toBe('loopc')
    expect(decodeTenantFromJwt('not-a-jwt')).toBeNull()
    expect(decodeTenantFromJwt(null)).toBeNull()
  })

  it('bootstrapTenantFromStorage prefers JWT company over stored company code', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    secureStore.companyCode = 'mg'
    secureStore.sessionToken = jwtWithCompany('cg')
    const { bootstrapTenantFromStorage, getTenant } = await import('./tenant')
    await expect(bootstrapTenantFromStorage()).resolves.toBe('cg')
    expect(getTenant()).toBe('cg')
  })

  it('bootstrapTenantFromStorage falls back to stored company code when JWT has no company', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    secureStore.companyCode = 'loopc'
    secureStore.sessionToken = jwtWithCompany('')
    const { bootstrapTenantFromStorage, getTenant } = await import('./tenant')
    await expect(bootstrapTenantFromStorage()).resolves.toBe('loopc')
    expect(getTenant()).toBe('loopc')
  })

  it('readSessionTokenFromSecureStore migrates legacy session key', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    secureStore.legacySessionToken = 'legacy-jwt'
    const { readSessionTokenFromSecureStore } = await import('./tenant')
    await expect(readSessionTokenFromSecureStore()).resolves.toBe('legacy-jwt')
    expect(secureStore.sessionToken).toBe('legacy-jwt')
    expect(secureStore.legacySessionToken).toBeNull()
  })

  it('syncTenantFromJwt updates active tenant from JWT company', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    const { syncTenantFromJwt, getTenant } = await import('./tenant')
    expect(syncTenantFromJwt(jwtWithCompany('cg'))).toBe('cg')
    expect(getTenant()).toBe('cg')
  })

  it('resetTenantSession clears stored company code and resets default tenant', async () => {
    mockState.extra = { apiUrl: 'https://api.example.test' }
    secureStore.companyCode = 'cg'
    const { setTenant, resetTenantSession, getTenant } = await import('./tenant')
    setTenant('cg')
    await expect(resetTenantSession()).resolves.toBe('loopc')
    expect(getTenant()).toBe('loopc')
    expect(secureStore.companyCode).toBeNull()
  })
})
