import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpCurrencies({
  token,
  canLoadReferenceData,
  setLoading,
  setCurrencies,
  setError,
}) {
  const loadCurrencies = useCallback(async () => {
    if (!canLoadReferenceData) return
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCurrencies(token)
      setCurrencies(data.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load currencies')
    }
    setLoading(false)
  }, [token, canLoadReferenceData, setLoading, setCurrencies, setError])

  return { loadCurrencies }
}
