import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/erp-accounting/inventory'
import { buildVaultStockGroups } from './vaultInventory'

/** Read-only company inventory for the Vault Room card. Reloads with the dashboard refresh. */
export function useVaultInventory(lastUpdated) {
  const { token } = useAuth()
  const [state, setState] = useState({ loading: Boolean(token), error: '', groups: [] })

  useEffect(() => {
    if (!token) {
      setState({ loading: false, error: '', groups: [] })
      return undefined
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    inventoryApi.getInventoryProducts(token, { limit: 500 })
      .then((data) => {
        if (cancelled) return
        setState({
          loading: false,
          error: '',
          groups: buildVaultStockGroups(data?.products || []),
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          loading: false,
          error: err?.response?.data?.message || 'Could not load stock',
          groups: [],
        })
      })
    return () => { cancelled = true }
  }, [token, lastUpdated])

  return state
}
