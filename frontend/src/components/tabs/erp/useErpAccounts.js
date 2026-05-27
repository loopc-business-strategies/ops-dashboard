import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpAccounts({
  token,
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
    if (isSummaryScope) setSummaryAccountsLoading(true)
    else setLoading(true)
    try {
      if (isSummaryScope) {
        const data = await erpAccountingAPI.getAccounts(token, { ...params, page: 1, limit: 5000 })
        const rows = data.accounts || []
        const uniqueById = new Map()
        rows.forEach((item) => {
          if (item?._id) uniqueById.set(item._id, item)
        })
        setSummaryAccounts(Array.from(uniqueById.values()))
      } else {
        const data = await erpAccountingAPI.getAccounts(token, params)
        setAccounts(data.accounts || [])
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${isSummaryScope ? 'account summary options' : 'accounts'}`)
    }
    if (isSummaryScope) setSummaryAccountsLoading(false)
    else setLoading(false)
  }, [
    token,
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
