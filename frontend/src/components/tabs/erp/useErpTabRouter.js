import { useEffect } from 'react'
import { canViewErpSubTab } from '../../../utils/erpSubTabPermissions'
import { startERPRealtimeFeeds } from '../../../utils/realtimeSocket'

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
    if (activeTab === 'accounts') loadAccounts()
    else if (activeTab === 'customer-margin') loadCustomers({ limit: 200 })
    else if (activeTab === 'customers') loadCustomers()
    else if (activeTab === 'supplier-margin') loadVendors()
    else if (activeTab === 'transactions' && (canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) loadTransactions()
    else if (activeTab === 'vouchers') loadReportBranding()
    else if (activeTab === 'vendors') {
      Promise.all([
        loadVendors(),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ]).catch(() => {})
    } else if (activeTab === 'inventory') {
      loadInventory()
      loadStockLedger()
      loadVendors()
    } else if (activeTab === 'settings') {
      loadCurrencies()
      loadReportBranding()
    } else if (activeTab === 'currencies') {
      loadCurrencies()
      if (!accounts.length) loadAccounts()
    } else if (activeTab === 'enquiry') {
      loadAccounts({ scope: 'summary' })
      if (!currencies.length) loadCurrencies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token])

  const ledgerMonthsKey = Array.isArray(ledgerFilters.months) ? ledgerFilters.months.join(',') : ''

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'ledger') return
    loadLedger()
    loadAccounts({ scope: 'summary' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    token,
    ledgerFilters.startDate,
    ledgerFilters.endDate,
    ledgerFilters.department,
    ledgerFilters.referenceType,
    ledgerFilters.accountId,
    ledgerFilters.search,
    ledgerFilters.year,
    ledgerMonthsKey,
    ledgerVoucherTab,
  ])

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'mappings') return
    loadMappings(mappingFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, mappingFilters.department])

  useEffect(() => {
    if (!token || !canAccessERP) return undefined

    let stopRealtime = () => {}
    const tenantKey = user?.tenant || user?.company

    const timer = window.setTimeout(() => {
      stopRealtime = startERPRealtimeFeeds({
        token,
        tenant: tenantKey,
        onLedgerUpdate: () => {
          if (activeTabRef.current === 'ledger') {
            loadLedger({ cursor: null, cursorHistory: [] })
          }
        },
        onTransactionUpdate: () => {
          if (activeTabRef.current === 'transactions') {
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
  }, [token, user?.tenant, user?.company, canAccessERP])

  useEffect(() => {
    if (!token || !showEnquiryModal) return
    if (!currencies.length) loadCurrencies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showEnquiryModal, currencies.length])

  useEffect(() => {
    if (activeTab !== 'vouchers' || !token) return
    loadCustomers({ limit: 500 })
    loadVendors()
    if (!currencies.length) loadCurrencies()
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token])

  useEffect(() => {
    if (activeTab !== 'direct-deals' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!currencies.length) loadCurrencies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, customers.length, currencies.length])

  useEffect(() => {
    if (activeTab !== 'fixing-register' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!inventoryProducts.length) loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, customers.length, inventoryProducts.length])

  useEffect(() => {
    if (!fixingRegisterStockTypeOptions.length) return
    const fallbackMetalType = fixingRegisterStockTypeOptions[0]?.value || ''
    const hasSelected = fixingRegisterStockTypeOptions.some((option) => option.value === fixingRegFilter.metalType)
    if (!hasSelected) {
      setFixingRegFilter((prev) => (prev.metalType === fallbackMetalType ? prev : { ...prev, metalType: fallbackMetalType }))
    }
  }, [fixingRegisterStockTypeOptions, fixingRegFilter.metalType, setFixingRegFilter])
}
