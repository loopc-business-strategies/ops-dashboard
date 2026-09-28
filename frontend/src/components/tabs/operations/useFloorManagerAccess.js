import { useCallback, useEffect, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'

const POLL_MS = 30000

/**
 * MG only: whether the signed-in user may approve floor batches (backend `canDecide`, i.e. approvePass)
 * and how many are waiting. Non-MG tenants never call the MG Floor API.
 */
export function useFloorManagerAccess(tenantKey) {
  const enabled = tenantKey === 'mg'
  const [state, setState] = useState({ canDecide: false, pending: 0 })

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await mgFloorBatchEntriesApi.list({ status: 'PENDING', limit: 1 })
      setState({ canDecide: Boolean(res?.canDecide), pending: Number(res?.counts?.PENDING || 0) })
    } catch {
      setState({ canDecide: false, pending: 0 })
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setState({ canDecide: false, pending: 0 })
      return undefined
    }
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  return { ...state, refresh }
}
