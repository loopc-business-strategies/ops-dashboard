import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpLedger({
  token,
  canViewLedger,
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
        erpAccountingAPI.getAccounts(token),
        erpAccountingAPI.getCurrencies(token),
        erpAccountingAPI.getMappings(token),
      ])
      setLedger(ledgerData.entries || [])
      setLedgerMeta({
        cursor: ledgerData.cursor || cursor || null,
        nextCursor: ledgerData.nextCursor || null,
        hasMore: Boolean(ledgerData.hasMore),
        cursorHistory,
      })
      setAccounts(accountData.accounts || [])
      setCurrencies(currencyData.currencies || [])
      setMappings(mappingData.mappings || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger')
    }
    setLoading(false)
  }, [token, canViewLedger, ledgerFilters, ledgerVoucherTab, ledgerMeta, setLoading, setLedger, setLedgerMeta, setAccounts, setCurrencies, setMappings, setError])

  return { loadLedger }
}
