import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchCatalogCached, CATALOG_KINDS } from '../../../utils/erpCatalogCache'
import { filterActiveAccounts } from './accountDropdownHelpers'
import { normalizeFilterMonths, normalizeFilterYear, toMonthCsv } from './erpListFilters'

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
  const referenceLoadedRef = useRef(false)

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
        ...(ledgerFilters.search ? { search: ledgerFilters.search } : {}),
        ...(normalizeFilterYear(ledgerFilters.year) ? { year: normalizeFilterYear(ledgerFilters.year) } : {}),
        ...(normalizeFilterMonths(ledgerFilters.months).length ? { months: toMonthCsv(ledgerFilters.months) } : {}),
        ...(cursor ? { cursor } : {}),
      }
      const needReference = canLoadReferenceData && !referenceLoadedRef.current
      const needMappings = canViewMappings && !referenceLoadedRef.current
      const [ledgerData, accountData, currencyData, mappingData] = await Promise.all([
        erpAccountingAPI.getLedger(token, ledgerQuery),
        needReference
          ? fetchCatalogCached(CATALOG_KINDS.accounts, token, { page: 1, limit: 5000 }, () =>
            erpAccountingAPI.getAccounts(token, { page: 1, limit: 5000 }))
          : Promise.resolve(null),
        needReference
          ? fetchCatalogCached(CATALOG_KINDS.currencies, token, {}, () =>
            erpAccountingAPI.getCurrencies(token))
          : Promise.resolve(null),
        needMappings
          ? fetchCatalogCached(CATALOG_KINDS.mappings, token, {}, () =>
            erpAccountingAPI.getMappings(token))
          : Promise.resolve(null),
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
      if (needReference || needMappings) referenceLoadedRef.current = true
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
