import { useEffect, useState } from 'react'
import { DEMO_WRITE_MSG } from '../demo/pccApiAdapter'

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function canIssueGate(batch) {
  return Boolean(batch && ['CREATED', 'AWAITING_ISSUE'].includes(batch.status))
}

export function toastMsg(isDemo, fallback, res) {
  if (isDemo) return DEMO_WRITE_MSG
  return res?.message || fallback
}
