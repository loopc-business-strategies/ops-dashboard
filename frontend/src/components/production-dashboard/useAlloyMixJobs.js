import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/erp-accounting/inventory'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'

/** Open alloy mixes for Production Dashboard dept cards (MG). */
const MIX_JOBS_REFRESH_MS = 60000
const REALTIME_DEBOUNCE_MS = 350

export function useAlloyMixJobs({ enabled = true, tenantKey = 'mg' } = {}) {
  const { token } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const softTimerRef = useRef(null)

  const load = useCallback((opts = {}) => {
    const soft = Boolean(opts.soft)
    if (!token) {
      setJobs([])
      setLoading(false)
      setError('')
      return Promise.resolve()
    }
    if (!soft) setLoading(true)
    return inventoryApi.listAlloyMixJobs(token, {})
      .then((data) => {
        setJobs(Array.isArray(data?.jobs) ? data.jobs : [])
        setError('')
      })
      .catch((err) => {
        setJobs([])
        setError(err?.response?.data?.message || 'Could not load alloy mixes')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  useEffect(() => {
    if (!enabled || !token) {
      setJobs([])
      setLoading(false)
      setError('')
      return undefined
    }
    let cancelled = false
    load().finally(() => {
      if (cancelled) return
    })
    const id = setInterval(() => {
      if (!cancelled) load({ soft: true })
    }, MIX_JOBS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [token, enabled, load])

  // Floor allocate / ERP post mix emit production:update — refresh Mix Jobs immediately.
  useEffect(() => {
    if (!enabled || !token || !tenantKey) return undefined
    const unsubscribe = subscribeRealtimeEvents(tenantKey, 'production:update', () => {
      if (softTimerRef.current) clearTimeout(softTimerRef.current)
      softTimerRef.current = setTimeout(() => {
        softTimerRef.current = null
        load({ soft: true })
      }, REALTIME_DEBOUNCE_MS)
    })
    return () => {
      unsubscribe()
      if (softTimerRef.current) clearTimeout(softTimerRef.current)
    }
  }, [enabled, token, tenantKey, load])

  const byDepartment = useMemo(() => {
    const map = {}
    for (const job of jobs) {
      const key = String(job.currentDepartment || '').trim()
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(job)
    }
    return map
  }, [jobs])

  const allocate = useCallback(async (mixId, payload = {}) => {
    if (!token) throw new Error('Sign in to allocate alloy mixes')
    const data = await inventoryApi.allocateAlloyMixJob(token, mixId, payload)
    await load({ soft: true })
    return data
  }, [token, load])

  return { jobs, byDepartment, loading, error, refresh: load, allocate }
}
