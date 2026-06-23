import { useEffect, useRef } from 'react'
import { canViewErpSubTab } from '../../../utils/erpSubTabPermissions'
import { startERPRealtimeFeeds } from '../../../utils/realtimeSocket'

const ERP_SUBTAB_TTL_MS = 45_000

export function useErpTabRouter({
  activeTab,
  activeTabRef,
  token,
  user,
  canAccessERP,
  canAccessTransactions,
  canAccessVouchers,
  canAccessFixingRegister,
  showEnquiryModal = false,
  accounts,
  customers,
  currencies,
  inventoryProducts,
  fixingRegisterStockTypeOptions,
  fixingRegFilter,
  setFixingRegFilter,
  ledgerFilters,
  ledgerVoucherTab,
  mappingFilters,
  selectedTransactionId,
  selectedVendorId,
  transactions,
  setError,
  setSelectedTransactionId,
  setSelectedTransactionIds,
  loadAccounts,
  loadCustomers,
  loadVendors,
  loadVendorsQuick,
  loadVendorDetails,
  loadVendorPaymentCalendar,
  loadVendorComplianceSummary,
  loadVendorOverdueQueue,
  loadTransactions,
  loadReportBranding,
  loadInventory,
  loadStockLedger,
  loadCurrencies,
  loadLedger,
  loadMappings,
}) {
  const subTabFetchedAtRef = useRef({})
  /** One-shot per tab visit — avoids re-fetch storms when `.length` deps change mid-bootstrap. */
  const erpTabBootstrapRef = useRef({ vouchers: false, 'direct-deals': false, 'fixing-register': false })

  const shouldRefreshSubTab = (key, { force = false } = {}) => {
    if (force) return true
    const last = subTabFetchedAtRef.current[key] || 0
    return Date.now() - last > ERP_SUBTAB_TTL_MS
  }

  const markSubTabFetched = (key) => {
    subTabFetchedAtRef.current[key] = Date.now()
  }

  useEffect(() => {
    setSelectedTransactionIds((prev) => {
      const next = prev.filter((id) => transactions.some((tx) => tx._id === id))
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev
      }
      return next
    })
    if (selectedTransactionId && !transactions.some((tx) => tx._id === selectedTransactionId)) {
      setSelectedTransactionId('')
    }
  }, [transactions, selectedTransactionId, setSelectedTransactionId, setSelectedTransactionIds])

  useEffect(() => {
    if (activeTab !== 'transactions' || !selectedTransactionId || !transactions.length) return
    const target = document.getElementById(`erp-transaction-row-${selectedTransactionId}`)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeTab, selectedTransactionId, transactions])

  useEffect(() => {
    if (activeTab !== 'vendors' || !selectedVendorId) return
    loadVendorDetails(selectedVendorId)
  }, [activeTab, selectedVendorId, loadVendorDetails])

  useEffect(() => {
    setError((prev) => (prev ? '' : prev))
  }, [activeTab, setError])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab, activeTabRef])

  useEffect(() => {
    if (!canAccessERP || !token) {
      setError('You do not have access to the ERP Accounting module.')
      return
    }
    if (!canViewErpSubTab(user, activeTab)) return

    const refresh = (key, run, { force = false } = {}) => {
      if (!shouldRefreshSubTab(key, { force })) return
      Promise.resolve(run()).then(() => markSubTabFetched(key)).catch(() => {})
    }

    if (activeTab === 'accounts') refresh('accounts', () => loadAccounts())
    else if (activeTab === 'customer-margin') refresh('customer-margin', () => loadCustomers({ limit: 200 }))
    else if (activeTab === 'customers') refresh('customers', () => loadCustomers())
    else if (activeTab === 'supplier-margin') refresh('supplier-margin', () => loadVendors())
    else if (activeTab === 'transactions' && (canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) {
      refresh('transactions', () => loadTransactions(), { force: transactions.length === 0 })
    } else if (activeTab === 'vouchers') refresh('vouchers-branding', () => loadReportBranding())
    else if (activeTab === 'vendors') {
      refresh('vendors', () => Promise.all([
        loadVendors(),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ]))
    } else if (activeTab === 'inventory') {
      refresh('inventory', () => {
        loadInventory()
        loadStockLedger()
        loadVendors()
      })
    } else if (activeTab === 'settings') {
      refresh('settings', () => {
        loadCurrencies()
        loadReportBranding()
      })
    } else if (activeTab === 'currencies') {
      refresh('currencies', () => {
        loadCurrencies()
        if (!accounts.length) loadAccounts()
      })
    } else if (activeTab === 'enquiry') {
      refresh('enquiry', () => {
        loadAccounts({ scope: 'summary' })
        if (!currencies.length) loadCurrencies()
        loadReportBranding()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token])

  const ledgerMonthsKey = Array.isArray(ledgerFilters.months) ? ledgerFilters.months.join(',') : ''
  const ledgerSearchTerm = String(ledgerFilters.search || '').trim()
  const ledgerSearchHydratedRef = useRef(false)

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'ledger') return
    loadLedger()
    markSubTabFetched('ledger')
    // Accounts for ledger filters come from loadLedger catalog cache (same key as page/limit 5000).
    // Do not also hit loadAccounts({ scope: 'summary' }) — that is a separate cache key / destination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    token,
    ledgerFilters.startDate,
    ledgerFilters.endDate,
    ledgerFilters.department,
    ledgerFilters.referenceType,
    ledgerFilters.accountId,
    ledgerFilters.year,
    ledgerMonthsKey,
    ledgerVoucherTab,
  ])

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'ledger') {
      ledgerSearchHydratedRef.current = false
      return undefined
    }
    if (!ledgerSearchHydratedRef.current) {
      ledgerSearchHydratedRef.current = true
      return undefined
    }
    const timer = window.setTimeout(() => {
      loadLedger({ cursor: null, cursorHistory: [] })
    }, 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerSearchTerm, activeTab, canAccessERP, token])

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'mappings') return
    loadMappings(mappingFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, mappingFilters.department])

  useEffect(() => {
    if (!token || !canAccessERP) return undefined
    if (activeTab !== 'ledger' && activeTab !== 'transactions') return undefined

    let stopRealtime = () => {}
    const tenantKey = user?.tenant || user?.company

    const timer = window.setTimeout(() => {
      stopRealtime = startERPRealtimeFeeds({
        token,
        tenant: tenantKey,
        enableLedger: activeTab === 'ledger',
        enableTransactions: activeTab === 'transactions',
        onLedgerUpdate: () => {
          if (activeTabRef.current === 'ledger') {
            subTabFetchedAtRef.current.ledger = 0
            loadLedger({ cursor: null, cursorHistory: [] })
          }
        },
        onTransactionUpdate: () => {
          if (activeTabRef.current === 'transactions') {
            subTabFetchedAtRef.current.transactions = 0
            loadTransactions({ cursor: null, cursorHistory: [] })
          }
        },
      })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      stopRealtime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.tenant, user?.company, canAccessERP, activeTab])

  useEffect(() => {
    if (!token || !showEnquiryModal) return
    if (!currencies.length) loadCurrencies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showEnquiryModal, currencies.length])

  useEffect(() => {
    if (activeTab !== 'vouchers' && erpTabBootstrapRef.current.vouchers) {
      erpTabBootstrapRef.current.vouchers = false
    }
    if (activeTab !== 'direct-deals' && erpTabBootstrapRef.current['direct-deals']) {
      erpTabBootstrapRef.current['direct-deals'] = false
    }
    if (activeTab !== 'fixing-register' && erpTabBootstrapRef.current['fixing-register']) {
      erpTabBootstrapRef.current['fixing-register'] = false
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'vouchers' || !token || erpTabBootstrapRef.current.vouchers) return
    erpTabBootstrapRef.current.vouchers = true
    // Party Account combobox needs chart of accounts; currencies for FX headers.
    const tasks = []
    if (!currencies.length) tasks.push(loadCurrencies())
    if (!accounts.length) tasks.push(loadAccounts())
    if (tasks.length) void Promise.all(tasks).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap per vouchers visit
  }, [activeTab, token])

  useEffect(() => {
    if (activeTab !== 'direct-deals' || !token || erpTabBootstrapRef.current['direct-deals']) return
    erpTabBootstrapRef.current['direct-deals'] = true
    const tasks = []
    if (!customers.length) tasks.push(loadCustomers({ limit: 200 }))
    if (!currencies.length) tasks.push(loadCurrencies())
    if (tasks.length) void Promise.all(tasks).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap per direct-deals visit
  }, [activeTab, token])

  useEffect(() => {
    if (activeTab !== 'fixing-register' || !token || erpTabBootstrapRef.current['fixing-register']) return
    erpTabBootstrapRef.current['fixing-register'] = true
    const tasks = []
    if (!customers.length) tasks.push(loadCustomers({ limit: 200 }))
    if (!inventoryProducts.length) tasks.push(loadInventory())
    if (tasks.length) void Promise.all(tasks).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap per fixing-register visit
  }, [activeTab, token])

  useEffect(() => {
    if (!fixingRegisterStockTypeOptions.length) return
    const fallbackMetalType = fixingRegisterStockTypeOptions[0]?.value || ''
    const hasSelected = fixingRegisterStockTypeOptions.some((option) => option.value === fixingRegFilter.metalType)
    if (!hasSelected) {
      setFixingRegFilter((prev) => (prev.metalType === fallbackMetalType ? prev : { ...prev, metalType: fallbackMetalType }))
    }
  }, [fixingRegisterStockTypeOptions, fixingRegFilter.metalType, setFixingRegFilter])
}
