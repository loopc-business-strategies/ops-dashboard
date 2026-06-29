import { describe, it, expect, vi } from 'vitest'

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}))

vi.mock('@/src/api/client', () => ({
  apiRequest: vi.fn(),
  setAuthToken: vi.fn(),
  API_ORIGIN: 'https://api.example.com',
}))

vi.mock('@/src/api/sessionEvents', () => ({
  registerUnauthorizedHandler: vi.fn(),
}))

vi.mock('@/src/api/auth', () => ({
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('@/src/config/tenant', () => ({
  readSessionTokenFromSecureStore: vi.fn(async () => null),
  writeSessionTokenToSecureStore: vi.fn(async () => undefined),
}))

vi.mock('@/src/context/TenantContext', () => ({
  useTenant: () => ({
    isReady: true,
    companyCode: 'loopc',
    syncTenantFromSession: vi.fn(),
    resetForLogout: vi.fn(),
  }),
}))

vi.mock('@/src/services/expoPushRegistration', () => ({
  registerExpoPushAndPost: vi.fn(async () => undefined),
  unregisterExpoPushFromBackend: vi.fn(async () => undefined),
  attachExpoPushReregistration: vi.fn(),
}))

describe('AuthContext smoke', () => {
  it('exports AuthProvider and useAuth', async () => {
    const mod = await import('./AuthContext')
    expect(typeof mod.AuthProvider).toBe('function')
    expect(typeof mod.useAuth).toBe('function')
  })
})
