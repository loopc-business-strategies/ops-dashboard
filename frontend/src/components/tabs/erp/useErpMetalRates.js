import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpMetalRates({ token, setMetalRates, setMetalRateForm, setError }) {
  const loadMetalRates = useCallback(async () => {
    try {
      const data = await erpAccountingAPI.getMetalRates(token)
      const rates = data.rates || { goldPrice: 285, silverPrice: 3.5, priceCurrency: 'USD', updatedAt: null }
      setMetalRates(rates)
      setMetalRateForm({
        goldPrice: String(rates.goldPrice ?? 285),
        silverPrice: String(rates.silverPrice ?? 3.5),
        priceCurrency: rates.priceCurrency || 'USD',
      })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load metal rates')
    }
  }, [token, setMetalRates, setMetalRateForm, setError])

  return { loadMetalRates }
}
