import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/erp-accounting/inventory'
import { buildVaultStockGroups } from './vaultInventory'

/** Vault Room inventory: load on mount, then every 4 minutes (not on every floor soft refresh). */
const VAULT_INVENTORY_REFRESH_MS = 240000

export function useVaultInventory() {
  const { token } = useAuth()
  const [state, setState] = useState({ loading: Boolean(token), error: '', groups: [] })

  useEffect(() => {
    if (!token) {
      setState({ loading: false, error: '', groups: [] })
      return undefined
    }
    let cancelled = false

    const load = () => {
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
    }

    load()
    const id = setInterval(load, VAULT_INVENTORY_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [token])

  return state
}
