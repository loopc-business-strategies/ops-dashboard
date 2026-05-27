import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpInventory({
  token,
  canAccessInventory,
  canAccessFixingRegister,
  setLoading,
  setInventoryProducts,
  setStockMovements,
  setStockMovementsLoading,
  setError,
}) {
  const canLoadInventoryData = canAccessInventory || canAccessFixingRegister

  const loadInventory = useCallback(async () => {
    if (!canLoadInventoryData) return
    setLoading(true)
    try {
      const productsData = await erpAccountingAPI.getInventoryProducts(token)
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    setLoading(false)
  }, [token, canLoadInventoryData, setLoading, setInventoryProducts, setError])

  const loadStockLedger = useCallback(async () => {
    if (!canLoadInventoryData) return
    setStockMovementsLoading(true)
    try {
      const data = await erpAccountingAPI.getStockLedger(token)
      setStockMovements(data.movements || [])
    } catch {
      setStockMovements([])
    } finally {
      setStockMovementsLoading(false)
    }
  }, [token, canLoadInventoryData, setStockMovementsLoading, setStockMovements])

  return { loadInventory, loadStockLedger }
}
