import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useErpTransactions } from './useErpTransactions'

const getTransactions = vi.fn()

vi.mock('../../../api/erp-accounting', () => ({
  default: {
    getTransactions: (...args) => getTransactions(...args),
    getCustomers: vi.fn(),
    getInventoryProducts: vi.fn(),
    getMappings: vi.fn(),
    getAccounts: vi.fn(),
    getCurrencies: vi.fn(),
  },
}))

vi.mock('./useErpVendors', () => ({
  fetchAllVendorsAggregated: vi.fn(),
}))

describe('useErpTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTransactions.mockResolvedValue({
      transactions: [],
      summary: { totalCount: 0, totalAmount: 0 },
      total: 0,
      page: 1,
      limit: 25,
      hasMore: false,
      nextCursor: null,
      cursor: null,
    })
  })

  test('passes year and months filters in API params', async () => {
    const { result } = renderHook(() => useErpTransactions({
      token: 'token',
      canAccessTransactions: true,
      canAccessVouchers: false,
      canAccessFixingRegister: false,
      canLoadParties: false,
      canLoadInventoryData: false,
      canLoadReferenceData: false,
      canViewMappings: false,
      transactionFilters: { search: '', status: '', type: '', startDate: '', endDate: '', year: '2026', months: [6, 7] },
      transactionMeta: { limit: 25, cursorHistory: [], page: 1 },
      setLoading: vi.fn(),
      setTransactions: vi.fn(),
      setTransactionSummary: vi.fn(),
      setTransactionMeta: vi.fn(),
      setCustomers: vi.fn(),
      setVendors: vi.fn(),
      setInventoryProducts: vi.fn(),
      setMappings: vi.fn(),
      setAccounts: vi.fn(),
      setCurrencies: vi.fn(),
      setError: vi.fn(),
    }))

    await act(async () => {
      await result.current.loadTransactions({ cursor: null, cursorHistory: [] })
    })

    expect(getTransactions).toHaveBeenCalledWith('token', expect.objectContaining({
      year: '2026',
      months: '6,7',
    }))
  })
})
