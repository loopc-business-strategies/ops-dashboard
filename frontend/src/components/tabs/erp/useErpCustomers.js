import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpCustomers({
  token,
  canLoadParties,
  setLoading,
  setCustomers,
  setError,
}) {
  const loadCustomers = useCallback(async (params) => {
    if (!canLoadParties) return
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCustomers(token, params)
      setCustomers(data.customers || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customers')
    }
    setLoading(false)
  }, [token, canLoadParties, setLoading, setCustomers, setError])

  return { loadCustomers }
}
