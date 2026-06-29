import { describe, it, expect, vi } from 'vitest'

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: {} },
    manifest2: null,
  },
}))

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}))

vi.mock('@/src/api/client', () => ({
  apiRequest: vi.fn(async () => ({ reports: [] })),
}))

vi.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { company: 'loopc' } }),
}))

vi.mock('@/src/context/TenantContext', () => ({
  useTenant: () => ({
    branding: { colors: { primary: '#000', background: '#fff', card: '#fff', text: '#000', muted: '#666' } },
  }),
}))

vi.mock('@/src/hooks/useTenantSessionReady', () => ({
  useTenantSessionReady: () => true,
}))

vi.mock('@/src/hooks/useTenantSessionKey', () => ({
  useTenantSessionKey: () => 'loopc',
}))

vi.mock('@/src/api/erpReports', () => ({
  fetchAccountsForLedger: vi.fn(async () => []),
  getAccountEnquiry: vi.fn(async () => ({})),
  getBalanceSheetReport: vi.fn(async () => ({})),
  getCustomerOutstandingReport: vi.fn(async () => ({})),
  getDayBookReport: vi.fn(async () => ({})),
  getForexGainLossReport: vi.fn(async () => ({})),
  getLedgerReport: vi.fn(async () => ({})),
  getProfitLossReport: vi.fn(async () => ({})),
  getTrialBalanceReport: vi.fn(async () => ({})),
  getVendorOutstandingReport: vi.fn(async () => ({})),
}))

describe('ErpReportsScreen smoke', () => {
  it('default export is a component function', async () => {
    const mod = await import('./ErpReportsScreen')
    expect(typeof mod.default).toBe('function')
  })
})
