import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/erp-accounting/inventory'

/** Open alloy mixes for Production Dashboard dept cards (MG). */
const MIX_JOBS_REFRESH_MS = 60000

export function useAlloyMixJobs({ enabled = true } = {}) {
  const { token } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !token) {
      setJobs([])
      setLoading(false)
      setError('')
      return undefined
    }
    let cancelled = false

    const load = () => {
      setLoading(true)
      inventoryApi.listAlloyMixJobs(token, {})
        .then((data) => {
          if (cancelled) return
          setJobs(Array.isArray(data?.jobs) ? data.jobs : [])
          setError('')
        })
        .catch((err) => {
          if (cancelled) return
          setJobs([])
          setError(err?.response?.data?.message || 'Could not load alloy mixes')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    load()
    const id = setInterval(load, MIX_JOBS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [token, enabled])

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

  return { jobs, byDepartment, loading, error }
}
