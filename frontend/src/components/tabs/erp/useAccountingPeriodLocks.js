import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import erpAccountingAPI from '../../../api/erp-accounting'
import { isAccountingPeriodClosingEnabled } from '../../../config/tenantBranding'
import { accountingDateFromEntry, isDateLocked } from './accountingPeriodClosed'

/**
 * Loads accounting period status by calendar year (cached) for view-only mutate UX.
 * Backend remains the authority; this only disables UI actions early.
 */
export function useAccountingPeriodLocks() {
  const { token, user } = useAuth()
  const tenant = user?.company
  const enabled = isAccountingPeriodClosingEnabled(tenant)
  const cacheRef = useRef(new Map())
  const [, setTick] = useState(0)

  const ensureYear = useCallback(async (year) => {
    if (!enabled || !token || !Number.isFinite(year)) return null
    if (cacheRef.current.has(year)) return cacheRef.current.get(year)
    try {
      const data = await erpAccountingAPI.getAccountingPeriods(token, year)
      const payload = {
        yearly: data.yearly || null,
        months: Array.isArray(data.months) ? data.months : [],
      }
      cacheRef.current.set(year, payload)
      setTick((n) => n + 1)
      return payload
    } catch {
      cacheRef.current.set(year, { yearly: null, months: [] })
      return cacheRef.current.get(year)
    }
  }, [enabled, token])

  useEffect(() => {
    if (!enabled) return
    void ensureYear(new Date().getUTCFullYear())
  }, [enabled, ensureYear])

  const isEntryLocked = useCallback((entryOrDate) => {
    if (!enabled) return false
    const date = entryOrDate instanceof Date || typeof entryOrDate === 'string' || typeof entryOrDate === 'number'
      ? (entryOrDate instanceof Date ? entryOrDate : new Date(entryOrDate))
      : accountingDateFromEntry(entryOrDate)
    if (!date || Number.isNaN(date.getTime())) return false
    const year = date.getUTCFullYear()
    const periods = cacheRef.current.get(year)
    if (!periods) {
      void ensureYear(year)
      return false
    }
    return isDateLocked(date, periods)
  }, [enabled, ensureYear])

  const prefetchDates = useCallback((dates = []) => {
    if (!enabled) return
    const years = new Set()
    for (const value of dates) {
      const d = value instanceof Date ? value : new Date(value)
      if (!Number.isNaN(d.getTime())) years.add(d.getUTCFullYear())
    }
    years.forEach((year) => { void ensureYear(year) })
  }, [enabled, ensureYear])

  const invalidate = useCallback(() => {
    cacheRef.current.clear()
    setTick((n) => n + 1)
    if (enabled) void ensureYear(new Date().getUTCFullYear())
  }, [enabled, ensureYear])

  return {
    enabled,
    isEntryLocked,
    prefetchDates,
    invalidate,
    ensureYear,
  }
}
