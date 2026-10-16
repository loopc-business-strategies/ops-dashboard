import { useCallback } from 'react'
import {
  fetchVoucherAccounts,
  fetchVoucherCurrencies,
  fetchVoucherMetalRates,
  fetchVoucherParties,
  voucherErpApi,
} from './voucherErpApi'

/**
 * Loads accounts, customers, vendors, currencies, and metal rates for the voucher tab.
 * Extracted from VoucherTab.jsx to shrink the shell and centralize ERP API access.
 */
export function useVoucherReferenceData({
  token,
  setLocalAccounts,
  setLocalCustomers,
  setLocalVendors,
  setLocalCurrencies,
  setLatestMetalRates,
}) {
  const refreshAccounts = useCallback(async () => {
    if (!token || !setLocalAccounts) return
    try {
      await fetchVoucherAccounts(token, {
        onPage: (accounts) => {
          if (accounts.length > 0) setLocalAccounts(accounts)
        },
      })
    } catch {
      // props fallback still available
    }
  }, [token, setLocalAccounts])

  const refreshParties = useCallback(async () => {
    if (!token) return
    try {
      await fetchVoucherParties(token, {
        onPage: ({ customers, vendors }) => {
          if (customers.length > 0) setLocalCustomers(customers)
          if (vendors.length > 0) setLocalVendors(vendors)
        },
      })
    } catch {
      // props fallback still available
    }
  }, [token, setLocalCustomers, setLocalVendors])

  const refreshCurrencies = useCallback(async () => {
    if (!token) return
    try {
      const items = await fetchVoucherCurrencies(token)
      if (items.length > 0) setLocalCurrencies(items)
    } catch {
      // fallback to prop currencies
    }
  }, [token, setLocalCurrencies])

  const refreshMetalRates = useCallback(async () => {
    if (!token) return
    try {
      const rates = await fetchVoucherMetalRates(token)
      if (rates) setLatestMetalRates(rates)
    } catch {
      // keep last known rates
    }
  }, [token, setLatestMetalRates])

  return { refreshAccounts, refreshParties, refreshCurrencies, refreshMetalRates, voucherErpApi }
}
