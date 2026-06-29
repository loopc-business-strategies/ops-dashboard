import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { filterActiveAccounts } from './accountDropdownHelpers'

export function useErpLedger({
  token,
  canViewLedger,
  canLoadReferenceData,
  canViewMappings,
  ledgerFilters,
  ledgerVoucherTab,
  ledgerMeta,
  setLoading,
  setLedger,
  setLedgerMeta,
  setAccounts,
  setCurrencies,
  setMappings,
  setError,
}) {
  const loadLedger = useCallback(async (options = {}) => {
    if (!canViewLedger) return
    setLoading(true)
    try {
      const hasCursorOverride = Object.prototype.hasOwnProperty.call(options, 'cursor')
      const cursor = hasCursorOverride ? options.cursor : null
      const cursorHistory = Array.isArray(options.cursorHistory) ? options.cursorHistory : (cursor ? ledgerMeta.cursorHistory || [] : [])
      const ledgerQuery = {
        limit: 100,
        ...ledgerFilters,
        referenceType: ledgerFilters.referenceType || ledgerVoucherTab,
        ...(cursor ? { cursor } : {}),
      }
      const [ledgerData, accountData, currencyData, mappingData] = await Promise.all([
        erpAccountingAPI.getLedger(token, ledgerQuery),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
        canLoadReferenceData ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
        canViewMappings ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
      ])
      setLedger(ledgerData.entries || [])
      setLedgerMeta({
        cursor: ledgerData.cursor || cursor || null,
        nextCursor: ledgerData.nextCursor || null,
        hasMore: Boolean(ledgerData.hasMore),
        cursorHistory,
      })
      if (accountData) setAccounts(filterActiveAccounts(accountData.accounts || []))
      if (currencyData) setCurrencies(currencyData.currencies || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger')
    }
    setLoading(false)
  }, [
    token,
    canViewLedger,
    canLoadReferenceData,
    canViewMappings,
    ledgerFilters,
    ledgerVoucherTab,
    ledgerMeta,
    setLoading,
    setLedger,
    setLedgerMeta,
    setAccounts,
    setCurrencies,
    setMappings,
    setError,
  ])

  return { loadLedger }
}
