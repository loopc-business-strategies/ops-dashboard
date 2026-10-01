import { useCallback, useEffect, useState } from 'react'
import { mgFloorBreakdownsApi } from '../../api/mgFloorBreakdowns'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'

const POLL_MS = 30000

/** Breakdowns acknowledged (or still ringing) but not fixed yet; `fix` marks one fixed from the web. */
export function useUnfixedBreakdowns({ tenantKey = 'mg', enabled = true } = {}) {
  const [breakdowns, setBreakdowns] = useState([])
  const [allowed, setAllowed] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await mgFloorBreakdownsApi.unfixed()
      setBreakdowns(Array.isArray(res?.breakdowns) ? res.breakdowns : [])
    } catch (err) {
      if (err?.response?.status === 403) setAllowed(false)
    }
  }, [])

  const active = enabled && allowed
  useEffect(() => {
    if (!active) return undefined
    load()
    const timer = setInterval(load, POLL_MS)
    const unsubscribe = subscribeRealtimeEvents(tenantKey, 'mg-floor:breakdown', () => load())
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [active, load, tenantKey])

  const fix = useCallback(async (id, note) => {
    const res = await mgFloorBreakdownsApi.markFixed(id, note)
    await load()
    return res
  }, [load])

  return { breakdowns: active ? breakdowns : [], fix }
}

/** Minutes since the breakdown was reported. */
export const minutesDown = (breakdown, now = Date.now()) => {
  const t = new Date(breakdown?.createdAt).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : null
}

/** 135 -> "2h 15m", 40 -> "40m". */
export const formatMinutes = (minutes) => {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`
}
