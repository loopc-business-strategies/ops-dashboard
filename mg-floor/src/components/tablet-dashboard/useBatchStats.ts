import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBatchStats, saveLossLimit, type BatchStats } from '@/src/api/batchStats'
import { toApiError } from '@/src/api/errors'
import { localDateKey } from './batchEntryMapping'

const POLL_MS = 60000

type Options = {
  token: string | null
  department: string
  /** Changes when a batch is approved, so the numbers refresh without waiting for the poll. */
  refreshKey: string
}

/** Metal loss / batch time for the tablet's department; keeps the last numbers when offline. */
export function useBatchStats({ token, department, refreshKey }: Options) {
  const [stats, setStats] = useState<BatchStats | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!token || !department) return
    const request = ++requestRef.current
    try {
      const res = await fetchBatchStats(department, localDateKey())
      if (request === requestRef.current) setStats(res)
    } catch {
      // Offline or server busy: keep showing the last numbers.
    }
  }, [token, department])

  useEffect(() => {
    setStats(null)
    if (!token || !department) return
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearInterval(timer)
      requestRef.current += 1
    }
  }, [token, department, load])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  /** Resolves to an error message, or null once saved. */
  const setLossLimit = useCallback(
    async (lossLimitPct: number | null): Promise<string | null> => {
      if (!department) return 'No floor department selected'
      try {
        const res = await saveLossLimit(department, lossLimitPct)
        setStats((cur) => (cur ? { ...cur, lossLimitPct: res.lossLimitPct, lossLimitSetBy: res.lossLimitSetBy } : cur))
        return null
      } catch (err) {
        return toApiError(err).message || 'Could not save the loss limit'
      }
    },
    [department],
  )

  return { stats, reload: load, setLossLimit }
}
