import { describe, it, expect, vi } from 'vitest'

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: {} },
    manifest2: null,
  },
}))

vi.mock('@/src/api/client', () => ({
  apiRequest: vi.fn(async () => ({ items: [], categories: [], total: 0 })),
}))

vi.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ token: 't' }),
}))

vi.mock('@/src/context/TenantContext', () => ({
  useTenant: () => ({
    branding: {
      colors: {
        primary: '#059669',
        background: '#fff',
        text: '#111',
        muted: '#666',
        success: '#059669',
      },
    },
  }),
}))

vi.mock('@/src/hooks/useTenantSessionReady', () => ({
  useTenantSessionReady: () => true,
}))

vi.mock('@/src/hooks/useTenantSessionKey', () => ({
  useTenantSessionKey: () => 'loopc',
}))

describe('ExpenseReportWidget smoke', () => {
  it('exports a component function', async () => {
    const mod = await import('./ExpenseReportWidget')
    expect(typeof mod.ExpenseReportWidget).toBe('function')
  })
})
