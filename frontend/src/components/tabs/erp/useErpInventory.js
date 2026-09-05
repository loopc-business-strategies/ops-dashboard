import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchCatalogCached, CATALOG_KINDS } from '../../../utils/erpCatalogCache'

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
  const loadSeqRef = useRef(0)
  const stockSeqRef = useRef(0)
  const canLoadInventoryData = canAccessInventory || canAccessFixingRegister

  const loadInventory = useCallback(async () => {
    if (!canLoadInventoryData) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const productsData = await fetchCatalogCached(CATALOG_KINDS.inventory, token, {}, () =>
        erpAccountingAPI.getInventoryProducts(token))
      if (seq !== loadSeqRef.current) return
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    if (seq === loadSeqRef.current) setLoading(false)
  }, [token, canLoadInventoryData, setLoading, setInventoryProducts, setError])

  const loadStockLedger = useCallback(async () => {
    if (!canLoadInventoryData) return
    const seq = ++stockSeqRef.current
    setStockMovementsLoading(true)
    try {
      const data = await erpAccountingAPI.getStockLedger(token)
      if (seq !== stockSeqRef.current) return
      setStockMovements(data.movements || [])
    } catch {
      if (seq !== stockSeqRef.current) return
      setStockMovements([])
    } finally {
      if (seq === stockSeqRef.current) setStockMovementsLoading(false)
    }
  }, [token, canLoadInventoryData, setStockMovementsLoading, setStockMovements])

  return { loadInventory, loadStockLedger }
}
