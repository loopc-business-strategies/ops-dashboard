import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  clearStoredActivity,
  useWebIdleLogout,
  WEB_IDLE_ACTIVITY_STORAGE_KEY,
} from './useWebIdleLogout'

describe('useWebIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  test('fires warning then idle logout after inactivity', () => {
    const onWarn = vi.fn()
    const onIdle = vi.fn()

    renderHook(() => useWebIdleLogout({
      enabled: true,
      idleTimeoutMs: 10_000,
      warningMs: 3_000,
      onWarn,
      onIdle,
    }))

    act(() => {
      vi.advanceTimersByTime(7_000)
    })
    expect(onWarn).toHaveBeenCalledTimes(1)
    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  test('activity resets idle timer', () => {
    const onIdle = vi.fn()

    const { result } = renderHook(() => useWebIdleLogout({
      enabled: true,
      idleTimeoutMs: 10_000,
      warningMs: 3_000,
      onIdle,
    }))

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    act(() => {
      result.current.recordActivity(Date.now())
    })

    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    expect(onIdle).not.toHaveBeenCalled()
  })

  test('disabled when idle timeout is zero', () => {
    const onIdle = vi.fn()

    renderHook(() => useWebIdleLogout({
      enabled: true,
      idleTimeoutMs: 0,
      warningMs: 1_000,
      onIdle,
    }))

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(onIdle).not.toHaveBeenCalled()
    expect(localStorage.getItem(WEB_IDLE_ACTIVITY_STORAGE_KEY)).toBeNull()
  })

  test('does not fire idle immediately when stored activity is stale', () => {
    const onIdle = vi.fn()
    const idleTimeoutMs = 10_000
    const staleActivity = Date.now() - idleTimeoutMs - 5_000
    localStorage.setItem(WEB_IDLE_ACTIVITY_STORAGE_KEY, String(staleActivity))

    renderHook(() => useWebIdleLogout({
      enabled: true,
      idleTimeoutMs,
      warningMs: 3_000,
      onIdle,
    }))

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(onIdle).not.toHaveBeenCalled()
    const storedActivity = Number(localStorage.getItem(WEB_IDLE_ACTIVITY_STORAGE_KEY))
    expect(storedActivity).toBeGreaterThan(staleActivity)
  })

  test('clearStoredActivity removes persisted idle timestamp', () => {
    localStorage.setItem(WEB_IDLE_ACTIVITY_STORAGE_KEY, String(Date.now()))
    clearStoredActivity()
    expect(localStorage.getItem(WEB_IDLE_ACTIVITY_STORAGE_KEY)).toBeNull()
  })
})
