import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchAllVendorsAggregated } from './useErpVendors'
import { filterActiveAccounts } from './accountDropdownHelpers'

export function useErpTransactions({
  token,
  canAccessTransactions,
  canAccessVouchers,
  canAccessFixingRegister,
  canViewCustomers,
  canAccessVendors,
  canAccessDirectDeals,
  canAccessInventory,
  canViewAccounts,
  canViewBalanceEnquiry,
  canViewLedger,
  canAccessReports,
  canAccessCurrencies,
  canAccessErpSettings,
  canViewMappings,
  transactionFilters,
  transactionMeta,
  setLoading,
  setTransactions,
  setTransactionSummary,
  setTransactionMeta,
  setCustomers,
  setVendors,
  setInventoryProducts,
  setMappings,
  setAccounts,
  setCurrencies,
  setError,
}) {
  const canLoadReferenceData = canViewAccounts
    || canAccessTransactions
    || canAccessVouchers
    || canAccessFixingRegister
    || canViewBalanceEnquiry
    || canViewLedger
    || canAccessReports
    || canAccessCurrencies
    || canAccessErpSettings
  const canLoadParties = canViewCustomers
    || canAccessVendors
    || canAccessTransactions
    || canAccessVouchers
    || canAccessFixingRegister
    || canAccessDirectDeals
  const canLoadInventoryData = canAccessInventory || canAccessFixingRegister

  const loadTransactions = useCallback(async (overrides = {}) => {
    if (!(canAccessTransactions || canAccessVouchers || canAccessFixingRegister)) return
    setLoading(true)
    try {
      const hasCursorOverride = Object.prototype.hasOwnProperty.call(overrides, 'cursor')
      const cursor = hasCursorOverride ? overrides.cursor : null
      const cursorHistory = Array.isArray(overrides.cursorHistory)
        ? overrides.cursorHistory
        : (cursor ? transactionMeta.cursorHistory || [] : [])
      const params = {
        limit: overrides.limit || transactionMeta.limit,
        ...(cursor ? { cursor } : {}),
        ...((overrides.search ?? transactionFilters.search) ? { search: overrides.search ?? transactionFilters.search } : {}),
        ...((overrides.status ?? transactionFilters.status) ? { status: overrides.status ?? transactionFilters.status } : {}),
        ...((overrides.type ?? transactionFilters.type) ? { type: overrides.type ?? transactionFilters.type } : {}),
        ...((overrides.startDate ?? transactionFilters.startDate) ? { startDate: overrides.startDate ?? transactionFilters.startDate } : {}),
        ...((overrides.endDate ?? transactionFilters.endDate) ? { endDate: overrides.endDate ?? transactionFilters.endDate } : {}),
      }
      if (!hasCursorOverride && overrides.page) {
        params.page = overrides.page
      }
      const [data, customerData, vendorData, inventoryData, mappingData, accountData, currencyData] = await Promise.all([
        erpAccountingAPI.getTransactions(token, params),
        canLoadParties ? erpAccountingAPI.getCustomers(token) : Promise.resolve(null),
        canLoadParties ? fetchAllVendorsAggregated(token, { includeInactive: false }) : Promise.resolve(null),
        canLoadInventoryData ? erpAccountingAPI.getInventoryProducts(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token, { page: 1, limit: 5000 }) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
      ])
      setTransactions(data.transactions || [])
      setTransactionSummary(data.summary || { totalCount: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, posted: 0, returned: 0, rejected: 0 })
      setTransactionMeta((prev) => ({
        ...prev,
        page: data.page || params.page || prev.page,
        limit: data.limit || params.limit || prev.limit,
        total: Number(data.total || 0),
        cursor: data.cursor || cursor || null,
        nextCursor: data.nextCursor || null,
        hasMore: Boolean(data.hasMore),
        cursorHistory,
      }))
      if (customerData) setCustomers(customerData.customers || [])
      if (vendorData) setVendors(vendorData.vendors || [])
      if (inventoryData) setInventoryProducts(inventoryData.products || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      if (accountData) setAccounts(filterActiveAccounts(accountData.accounts || []))
      if (currencyData) setCurrencies(currencyData.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load transactions')
    }
    setLoading(false)
  }, [
    token,
    canAccessTransactions,
    canAccessVouchers,
    canAccessFixingRegister,
    canLoadParties,
    canLoadInventoryData,
    canLoadReferenceData,
    canViewMappings,
    transactionFilters,
    transactionMeta,
    setLoading,
    setTransactions,
    setTransactionSummary,
    setTransactionMeta,
    setCustomers,
    setVendors,
    setInventoryProducts,
    setMappings,
    setAccounts,
    setCurrencies,
    setError,
  ])

  return { loadTransactions }
}
