import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { readSummaryAccountsCache, writeSummaryAccountsCache } from '../../../utils/erpSummaryAccountsCache'
import { filterActiveAccounts } from './accountDropdownHelpers'

export function useErpAccounts({
  token,
  tenantKey = 'default',
  canViewAccounts,
  canViewBalanceEnquiry,
  canAccessTransactions,
  canAccessVouchers,
  canViewLedger,
  canAccessReports,
  canAccessCurrencies,
  canAccessErpSettings,
  canAccessFixingRegister,
  setLoading,
  setSummaryAccountsLoading,
  setAccounts,
  setSummaryAccounts,
  setError,
}) {
  const canLoadReferenceData = canViewAccounts
    || canAccessTransactions
    || canAccessVouchers
    || canViewBalanceEnquiry
    || canViewLedger
    || canAccessReports
    || canAccessCurrencies
    || canAccessErpSettings
    || canAccessFixingRegister

  const loadAccounts = useCallback(async (params = {}) => {
    const isSummaryScope = params.scope === 'summary'
    if (!canLoadReferenceData && !(isSummaryScope && canViewBalanceEnquiry)) return
    if (isSummaryScope) {
      const cached = readSummaryAccountsCache(tenantKey)
      if (Array.isArray(cached) && cached.length) {
        const normalized = filterActiveAccounts(cached)
          .filter((item) => item?._id && String(item?.accountCode || '').trim())
          .map((item) => ({ ...item, accountCode: String(item.accountCode).trim() }))
        setSummaryAccounts(normalized)
        setSummaryAccountsLoading(false)
      } else {
        setSummaryAccountsLoading(true)
      }
    } else {
      setLoading(true)
    }
    try {
      if (isSummaryScope) {
        const data = await erpAccountingAPI.getAccounts(token, { ...params, page: 1, limit: 5000 })
        const rows = filterActiveAccounts(data.accounts || [])
        const uniqueById = new Map()
        rows.forEach((item) => {
          const code = String(item?.accountCode || '').trim()
          if (item?._id && code) uniqueById.set(item._id, { ...item, accountCode: code })
        })
        const next = Array.from(uniqueById.values())
        setSummaryAccounts(next)
        writeSummaryAccountsCache(tenantKey, next)
      } else {
        const pageSize = 500
        let page = 1
        let total = Number.POSITIVE_INFINITY
        let collected = []
        while (collected.length < total) {
          const data = await erpAccountingAPI.getAccounts(token, { ...params, page, limit: pageSize })
          const rows = data.accounts || []
          collected = collected.concat(rows)
          total = Number(data.total || collected.length)
          if (!rows.length) break
          page += 1
        }
        setAccounts(filterActiveAccounts(collected))
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${isSummaryScope ? 'account summary options' : 'accounts'}`)
    }
    if (isSummaryScope) setSummaryAccountsLoading(false)
    else setLoading(false)
  }, [
    token,
    tenantKey,
    canLoadReferenceData,
    canViewBalanceEnquiry,
    setLoading,
    setSummaryAccountsLoading,
    setAccounts,
    setSummaryAccounts,
    setError,
  ])

  return { loadAccounts }
}
