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

function jwtWithCompany(company: string) {
  const payload = Buffer.from(JSON.stringify({ company })).toString('base64url')
  return `header.${payload}.signature`
}

describe('api client tenant headers', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.extra = {}
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch
  })

  it('setAuthToken syncs x-tenant header to JWT company on apiRequest', async () => {
    const { setAuthToken, apiRequest } = await import('./client')
    setAuthToken(jwtWithCompany('loopc'))
    await apiRequest('/api/auth/me')
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-tenant']).toBe('loopc')
    expect(headers['x-company']).toBe('loopc')
  })
})

describe('api client unauthorized handling', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.extra = {}
  })

  it('notifies unauthorized handler on 401 except login', async () => {
    const { registerUnauthorizedHandler } = await import('./sessionEvents')
    const handler = vi.fn()
    registerUnauthorizedHandler(handler)

    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid session' }),
    })) as unknown as typeof fetch

    const { apiRequest } = await import('./client')
    await expect(apiRequest('/api/auth/me')).rejects.toThrow('Invalid session')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not notify unauthorized handler on login 401', async () => {
    const { registerUnauthorizedHandler } = await import('./sessionEvents')
    const handler = vi.fn()
    registerUnauthorizedHandler(handler)

    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    })) as unknown as typeof fetch

    const { apiRequest } = await import('./client')
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: {} })).rejects.toThrow('Invalid credentials')
    expect(handler).not.toHaveBeenCalled()
  })
})
