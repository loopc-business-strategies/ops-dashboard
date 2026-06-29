import { useCallback, useEffect, useRef } from 'react'

export const WEB_IDLE_ACTIVITY_STORAGE_KEY = 'ops-web-last-activity'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart']
const MOUSEMOVE_THROTTLE_MS = 1000

function readStoredActivityAt() {
  try {
    const raw = localStorage.getItem(WEB_IDLE_ACTIVITY_STORAGE_KEY)
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeStoredActivityAt(timestamp) {
  try {
    localStorage.setItem(WEB_IDLE_ACTIVITY_STORAGE_KEY, String(timestamp))
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearStoredActivity() {
  try {
    localStorage.removeItem(WEB_IDLE_ACTIVITY_STORAGE_KEY)
  } catch {
    // Ignore quota / private mode errors.
  }
}

export { writeStoredActivityAt }

function resolveActivityAt(stored, idleTimeoutMs) {
  const now = Date.now()
  if (!stored || !idleTimeoutMs || idleTimeoutMs <= 0) return now
  if (now - stored >= idleTimeoutMs) return now
  return stored
}

/**
 * Web-only idle logout timer with cross-tab activity sync.
 */
export function useWebIdleLogout({
  enabled = false,
  idleTimeoutMs = 30 * 60 * 1000,
  warningMs = 5 * 60 * 1000,
  onIdle,
  onWarn,
  onActivityReset,
} = {}) {
  const onIdleRef = useRef(onIdle)
  const onWarnRef = useRef(onWarn)
  const onActivityResetRef = useRef(onActivityReset)
  const warnTimerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const warnedRef = useRef(false)
  const lastMouseMoveRef = useRef(0)
  const lastActivityRef = useRef(Date.now())

  onIdleRef.current = onIdle
  onWarnRef.current = onWarn
  onActivityResetRef.current = onActivityReset

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) {
      clearTimeout(warnTimerRef.current)
      warnTimerRef.current = null
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleFromActivityAt = useCallback((activityAt) => {
    clearTimers()
    warnedRef.current = false

    if (!enabled || !idleTimeoutMs || idleTimeoutMs <= 0) return

    const safeWarningMs = Math.max(0, Math.min(warningMs || 0, idleTimeoutMs - 1000))
    const now = Date.now()
    const idleAt = activityAt + idleTimeoutMs
    const warnAt = activityAt + idleTimeoutMs - safeWarningMs
    const idleDelay = Math.max(0, idleAt - now)
    const warnDelay = Math.max(0, warnAt - now)

    if (safeWarningMs > 0 && warnDelay > 0) {
      warnTimerRef.current = setTimeout(() => {
        warnedRef.current = true
        onWarnRef.current?.()
      }, warnDelay)
    } else if (safeWarningMs > 0 && warnDelay === 0 && idleDelay > 0) {
      warnedRef.current = true
      onWarnRef.current?.()
    }

    idleTimerRef.current = setTimeout(() => {
      onIdleRef.current?.()
    }, idleDelay)
  }, [clearTimers, enabled, idleTimeoutMs, warningMs])

  const recordActivity = useCallback((activityAt = Date.now()) => {
    if (!enabled || !idleTimeoutMs || idleTimeoutMs <= 0) return

    lastActivityRef.current = activityAt
    writeStoredActivityAt(activityAt)
    const wasWarned = warnedRef.current
    warnedRef.current = false
    scheduleFromActivityAt(activityAt)
    if (wasWarned) onActivityResetRef.current?.()
  }, [enabled, idleTimeoutMs, scheduleFromActivityAt])

  const handleActivity = useCallback(() => {
    recordActivity(Date.now())
  }, [recordActivity])

  const handleMouseMove = useCallback(() => {
    const now = Date.now()
    if (now - lastMouseMoveRef.current < MOUSEMOVE_THROTTLE_MS) return
    lastMouseMoveRef.current = now
    handleActivity()
  }, [handleActivity])

  const handleVisibility = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    const stored = readStoredActivityAt()
    const activityAt = stored || lastActivityRef.current
    const now = Date.now()
    if (!enabled || !idleTimeoutMs || idleTimeoutMs <= 0) return

    if (now - activityAt >= idleTimeoutMs) {
      onIdleRef.current?.()
      return
    }

    recordActivity(activityAt)
  }, [enabled, idleTimeoutMs, recordActivity])

  const handleStorage = useCallback((event) => {
    if (event.key !== WEB_IDLE_ACTIVITY_STORAGE_KEY) return
    const stored = readStoredActivityAt()
    if (!stored) return
    recordActivity(stored)
  }, [recordActivity])

  useEffect(() => {
    if (!enabled || !idleTimeoutMs || idleTimeoutMs <= 0) {
      clearTimers()
      warnedRef.current = false
      return undefined
    }

    const stored = readStoredActivityAt()
    const initialActivity = resolveActivityAt(stored, idleTimeoutMs)
    recordActivity(initialActivity)

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('storage', handleStorage)

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorage)
    }
  }, [
    clearTimers,
    enabled,
    handleActivity,
    handleMouseMove,
    handleStorage,
    handleVisibility,
    idleTimeoutMs,
    recordActivity,
  ])

  return { recordActivity }
}
