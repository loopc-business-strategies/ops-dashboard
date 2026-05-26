import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpInventory({
  token,
  canAccessInventory,
  setLoading,
  setInventoryProducts,
  setStockMovements,
  setStockMovementsLoading,
  setError,
}) {
  const loadInventory = useCallback(async () => {
    if (!canAccessInventory) return
    setLoading(true)
    try {
      const productsData = await erpAccountingAPI.getInventoryProducts(token)
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    setLoading(false)
  }, [token, canAccessInventory, setLoading, setInventoryProducts, setError])

  const loadStockLedger = useCallback(async () => {
    if (!canAccessInventory) return
    setStockMovementsLoading(true)
    try {
      const data = await erpAccountingAPI.getStockLedger(token)
      setStockMovements(data.movements || [])
    } catch {
      setStockMovements([])
    } finally {
      setStockMovementsLoading(false)
    }
  }, [token, canAccessInventory, setStockMovementsLoading, setStockMovements])

  return { loadInventory, loadStockLedger }
}
