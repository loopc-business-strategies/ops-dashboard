import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchAllVendorsAggregated } from './useErpVendors'
import { filterActiveAccounts } from './accountDropdownHelpers'
import { normalizeFilterMonths, normalizeFilterYear, toMonthCsv } from './erpListFilters'

export function useErpTransactions({
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
}) {
  const transactionReferenceLoadedRef = useRef(false)

  const loadTransactionReferenceData = useCallback(async () => {
    if (transactionReferenceLoadedRef.current) return
    transactionReferenceLoadedRef.current = true
    try {
      const [customerData, vendorData, inventoryData, mappingData, accountData, currencyData] = await Promise.all([
        canLoadParties ? erpAccountingAPI.getCustomers(token) : Promise.resolve(null),
        canLoadParties ? fetchAllVendorsAggregated(token, { includeInactive: false }) : Promise.resolve(null),
        canLoadInventoryData ? erpAccountingAPI.getInventoryProducts(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token, { page: 1, limit: 5000 }) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
      ])
      if (customerData) setCustomers(customerData.customers || [])
      if (vendorData) setVendors(vendorData.vendors || [])
      if (inventoryData) setInventoryProducts(inventoryData.products || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      if (accountData) setAccounts(filterActiveAccounts(accountData.accounts || []))
      if (currencyData) setCurrencies(currencyData.currencies || [])
    } catch {
      transactionReferenceLoadedRef.current = false
    }
  }, [
    token,
    canLoadParties,
    canLoadInventoryData,
    canViewMappings,
    canLoadReferenceData,
    setCustomers,
    setVendors,
    setInventoryProducts,
    setMappings,
    setAccounts,
    setCurrencies,
  ])

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
        ...(normalizeFilterYear(overrides.year ?? transactionFilters.year) ? { year: normalizeFilterYear(overrides.year ?? transactionFilters.year) } : {}),
        ...(normalizeFilterMonths(overrides.months ?? transactionFilters.months).length ? { months: toMonthCsv(overrides.months ?? transactionFilters.months) } : {}),
      }
      if (!hasCursorOverride && overrides.page) {
        params.page = overrides.page
      }
      const data = await erpAccountingAPI.getTransactions(token, params)
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
      setError('')
      void loadTransactionReferenceData()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load transactions')
    }
    setLoading(false)
  }, [
    token,
    canAccessTransactions,
    canAccessVouchers,
    canAccessFixingRegister,
    transactionFilters,
    transactionMeta,
    setLoading,
    setTransactions,
    setTransactionSummary,
    setTransactionMeta,
    setError,
    loadTransactionReferenceData,
  ])

  return { loadTransactions, loadTransactionReferenceData }
}
