import { useCallback } from 'react'
import {
  fetchVoucherCurrencies,
  fetchVoucherMetalRates,
  fetchVoucherParties,
  voucherErpApi,
} from './voucherErpApi'

/**
 * Loads customers, vendors, currencies, and metal rates for the voucher tab.
 * Extracted from VoucherTab.jsx to shrink the shell and centralize ERP API access.
 */
export function useVoucherReferenceData({ token, setLocalCustomers, setLocalVendors, setLocalCurrencies, setLatestMetalRates }) {
  const refreshParties = useCallback(async () => {
    if (!token) return
    try {
      const { customers, vendors } = await fetchVoucherParties(token)
      setLocalCustomers(customers)
      setLocalVendors(vendors)
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

  return { refreshParties, refreshCurrencies, refreshMetalRates, voucherErpApi }
}
