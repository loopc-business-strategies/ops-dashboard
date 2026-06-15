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

describe('tenant config (MG mobile API / tenant)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.extra = {}
    delete process.env.EXPO_PUBLIC_API_URL
  })

  it('defaults tenant to mg and API to production when extra is unset', async () => {
    const { TENANT, API_URL } = await import('./tenant')
    expect(TENANT).toBe('mg')
    expect(API_URL).toBe('https://api.loopcstrategies.com')
  })

  it('respects expo extra tenant and apiUrl when provided', async () => {
    mockState.extra = { tenant: 'mg', apiUrl: 'https://api.example.test' }
    const { TENANT, API_URL } = await import('./tenant')
    expect(TENANT).toBe('mg')
    expect(API_URL).toBe('https://api.example.test')
  })

  it('EXPO_PUBLIC_API_URL overrides default API when extra.apiUrl missing', async () => {
    mockState.extra = { tenant: 'mg' }
    process.env.EXPO_PUBLIC_API_URL = 'https://staging.example.test'
    const { API_URL } = await import('./tenant')
    expect(API_URL).toBe('https://staging.example.test')
  })
})
