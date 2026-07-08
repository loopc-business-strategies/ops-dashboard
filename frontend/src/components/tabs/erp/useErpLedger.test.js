import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useErpLedger } from './useErpLedger'

const getLedger = vi.fn()
const getAccounts = vi.fn()
const getCurrencies = vi.fn()
const getMappings = vi.fn()

vi.mock('../../../api/erp-accounting', () => ({
  default: {
    getLedger: (...args) => getLedger(...args),
    getAccounts: (...args) => getAccounts(...args),
    getCurrencies: (...args) => getCurrencies(...args),
    getMappings: (...args) => getMappings(...args),
  },
}))

describe('useErpLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLedger.mockResolvedValue({ entries: [], hasMore: false, nextCursor: null, cursor: null })
    getAccounts.mockResolvedValue({ accounts: [] })
    getCurrencies.mockResolvedValue({ currencies: [] })
    getMappings.mockResolvedValue({ mappings: [] })
  })

  test('passes search/year/month query params', async () => {
    const { result } = renderHook(() => useErpLedger({
      token: 'token',
      canViewLedger: true,
      canLoadReferenceData: false,
      canViewMappings: false,
      ledgerFilters: { startDate: '', endDate: '', department: '', referenceType: '', accountId: '', search: 'rec', year: '2026', months: [7, 8] },
      ledgerVoucherTab: 'journal',
      ledgerMeta: { cursorHistory: [] },
      setLoading: vi.fn(),
      setLedger: vi.fn(),
      setLedgerMeta: vi.fn(),
      setAccounts: vi.fn(),
      setCurrencies: vi.fn(),
      setMappings: vi.fn(),
      setError: vi.fn(),
    }))

    await act(async () => {
      await result.current.loadLedger()
    })

    expect(getLedger).toHaveBeenCalledWith('token', expect.objectContaining({
      search: 'rec',
      year: '2026',
      months: '7,8',
    }))
  })
})
