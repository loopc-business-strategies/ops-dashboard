import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useErpTabRouter } from './useErpTabRouter'

vi.mock('../../../utils/erpSubTabPermissions', () => ({
  canViewErpSubTab: () => true,
}))

vi.mock('../../../utils/realtimeSocket', () => ({
  startERPRealtimeFeeds: () => () => {},
}))

const buildRouterProps = (overrides = {}) => {
  const loadCurrencies = vi.fn()
  const loadAccounts = vi.fn()
  return {
    activeTab: 'dashboard',
    activeTabRef: { current: 'dashboard' },
    token: 'test-token',
    user: { company: 'loopc' },
    canAccessERP: true,
    canAccessTransactions: true,
    canAccessVouchers: true,
    canAccessFixingRegister: true,
    showEnquiryModal: false,
    accounts: [],
    customers: [],
    currencies: [],
    inventoryProducts: [],
    fixingRegisterStockTypeOptions: [],
    fixingRegFilter: { metalType: '' },
    setFixingRegFilter: vi.fn(),
    ledgerFilters: {},
    ledgerVoucherTab: '',
    mappingFilters: {},
    selectedTransactionId: '',
    selectedVendorId: '',
    transactions: [],
    setError: vi.fn(),
    setSelectedTransactionId: vi.fn(),
    setSelectedTransactionIds: vi.fn(),
    loadAccounts,
    loadCustomers: vi.fn(),
    loadVendors: vi.fn(),
    loadVendorDetails: vi.fn(),
    loadVendorPaymentCalendar: vi.fn(),
    loadVendorComplianceSummary: vi.fn(),
    loadVendorOverdueQueue: vi.fn(),
    loadTransactions: vi.fn(),
    loadReportBranding: vi.fn(),
    loadInventory: vi.fn(),
    loadStockLedger: vi.fn(),
    loadCurrencies,
    loadLedger: vi.fn(),
    loadMappings: vi.fn(),
    ...overrides,
  }
}

describe('useErpTabRouter currency loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads currencies when enquiry tab activates', () => {
    const props = buildRouterProps({ activeTab: 'enquiry' })
    renderHook(() => useErpTabRouter(props))

    expect(props.loadAccounts).toHaveBeenCalledWith({ scope: 'summary' })
    expect(props.loadCurrencies).toHaveBeenCalled()
  })

  it('loads currencies when account enquiry modal opens', () => {
    const props = buildRouterProps({ activeTab: 'customer-margin', showEnquiryModal: true })
    renderHook(() => useErpTabRouter(props))

    expect(props.loadCurrencies).toHaveBeenCalled()
  })

  it('skips currency reload when currencies are already loaded', () => {
    const props = buildRouterProps({
      activeTab: 'enquiry',
      currencies: [{ code: 'USD' }, { code: 'EUR' }],
    })
    renderHook(() => useErpTabRouter(props))

    expect(props.loadAccounts).toHaveBeenCalledWith({ scope: 'summary' })
    expect(props.loadCurrencies).not.toHaveBeenCalled()
  })
})
