import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/erp-accounting/inventory'
import { buildVaultStockGroups } from '../tabs/erp/inventoryCategoryGroups'

/** Live ERP inventory for the Vault Room card. Reloads when the dashboard refreshes. Does not write stock. */
export function useVaultInventory(lastUpdated) {
  const { token } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', groups: [] })

  useEffect(() => {
    if (!token) {
      setState({ loading: false, error: '', groups: [] })
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await inventoryApi.getInventoryProducts(token, { limit: 500 })
        if (cancelled) return
        setState({
          loading: false,
          error: '',
          groups: buildVaultStockGroups(data?.products || []),
        })
      } catch (err) {
        if (cancelled) return
        setState({
          loading: false,
          error: err?.response?.data?.message || err?.message || 'Could not load stock',
          groups: [],
        })
      }
    })()
    return () => { cancelled = true }
  }, [token, lastUpdated])

  return state
}
