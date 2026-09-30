import { useCallback, useEffect, useRef, useState } from 'react'
import { mgFloorBatchEntriesApi } from '../../api/mgFloorBatchEntries'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'
import { OLD_PENDING_MINUTES, formatWait, minutesWaiting } from '../tabs/operations/floorBatchCheck'

const POLL_MS = 30000
export const FM_APPROVALS_HREF = '/dashboard?tab=operations&sub=fm'

/**
 * MG Production Dashboard header: how many Metal In / Out batches are waiting for the Floor Manager
 * and how long the oldest has waited. Hidden when nothing waits or the user cannot see approvals.
 */
export default function PendingApprovalsBadge({ tenantKey = 'mg' }) {
  const [state, setState] = useState({ count: 0, oldestAt: null })
  const [allowed, setAllowed] = useState(true)
  const [, setTick] = useState(0)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await mgFloorBatchEntriesApi.list({ status: 'PENDING', limit: 1 })
      if (request !== requestRef.current) return
      setState({ count: Number(res?.counts?.PENDING) || 0, oldestAt: res?.oldestPendingAt || null })
    } catch (err) {
      if (request !== requestRef.current) return
      const status = err?.response?.status
      if (status === 401 || status === 403) setAllowed(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return undefined
    load()
    const timer = setInterval(() => {
      load()
      setTick((t) => t + 1)
    }, POLL_MS)
    const unsubscribe = subscribeRealtimeEvents(tenantKey, 'mg-floor:batch-entry', () => load())
    return () => {
      clearInterval(timer)
      unsubscribe()
      requestRef.current += 1
    }
  }, [allowed, load, tenantKey])

  if (!allowed || !state.count) return null
  const waited = state.oldestAt ? minutesWaiting(state.oldestAt) : null
  const old = waited != null && waited >= OLD_PENDING_MINUTES

  return (
    <a
      className={`pd-pending-badge${old ? ' pd-pending-badge--old' : ''}`}
      href={FM_APPROVALS_HREF}
      title="Open Operations → FM to approve or reject"
    >
      WAITING FOR F.M
      <span className="pd-pending-badge-count">{state.count}</span>
      {waited != null ? <span className="pd-pending-badge-age">oldest {formatWait(waited)}</span> : null}
    </a>
  )
}
