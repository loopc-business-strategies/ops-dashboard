import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = { extra: {} as Record<string, string | undefined> }

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
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}))

describe('tenant config (Nexa mobile API / tenant)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.extra = {}
    delete process.env.EXPO_PUBLIC_API_URL
  })

  it('defaults tenant to mg and API to production when extra is unset', async () => {
    const { getTenant, API_URL } = await import('./tenant')
    expect(getTenant()).toBe('mg')
    expect(API_URL).toBe('https://api.loopcstrategies.com')
  })

  it('respects expo extra tenant and apiUrl when provided', async () => {
    mockState.extra = { tenant: 'cg', apiUrl: 'https://api.example.test' }
    const { getTenant, API_URL } = await import('./tenant')
    expect(getTenant()).toBe('cg')
    expect(API_URL).toBe('https://api.example.test')
  })

  it('setTenant normalizes and validates company codes', async () => {
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
})
