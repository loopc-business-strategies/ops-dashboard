import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import erpAccountingAPI from '../../../api/erp-accounting'
import {
  isAccountingPeriodClosingEnabled,
  isVoucher24HourLockEnabled,
} from '../../../config/tenantBranding'
import {
  accountingDateFromEntry,
  createdAtFromEntry,
  editableUntilFromCreatedAt,
  isDateLocked,
  isPast24HourWindow,
} from './accountingPeriodClosed'

/**
 * Loads accounting period status + optional 24h lock setting for view-only mutate UX.
 * Backend remains the authority; this only disables UI actions early.
 */
export function useAccountingPeriodLocks() {
  const { token, user } = useAuth()
  const tenant = user?.company
  const periodEnabled = isAccountingPeriodClosingEnabled(tenant)
  const lock24hFeature = isVoucher24HourLockEnabled(tenant)
  const cacheRef = useRef(new Map())
  const [voucher24HourLockEnabled, setVoucher24HourLockEnabled] = useState(false)
  const [, setTick] = useState(0)

  const ensureYear = useCallback(async (year) => {
    if (!periodEnabled || !token || !Number.isFinite(year)) return null
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
  }, [periodEnabled, token])

  const refreshControls = useCallback(async () => {
    if (!lock24hFeature || !token) {
      setVoucher24HourLockEnabled(false)
      return
    }
    try {
      const data = await erpAccountingAPI.getAccountingControls(token)
      setVoucher24HourLockEnabled(data?.voucher24HourLockEnabled !== false)
    } catch {
      setVoucher24HourLockEnabled(false)
    }
  }, [lock24hFeature, token])

  useEffect(() => {
    if (periodEnabled) void ensureYear(new Date().getUTCFullYear())
  }, [periodEnabled, ensureYear])

  useEffect(() => {
    void refreshControls()
  }, [refreshControls])

  const isEntryLocked = useCallback((entryOrDate) => {
    const isPlainDate = entryOrDate instanceof Date
      || typeof entryOrDate === 'string'
      || typeof entryOrDate === 'number'
    const date = isPlainDate
      ? (entryOrDate instanceof Date ? entryOrDate : new Date(entryOrDate))
      : accountingDateFromEntry(entryOrDate)
    const createdAt = isPlainDate ? null : createdAtFromEntry(entryOrDate)

    if (voucher24HourLockEnabled && createdAt && isPast24HourWindow(createdAt)) {
      return true
    }

    if (!periodEnabled) return false
    if (!date || Number.isNaN(date.getTime())) return false
    const year = date.getUTCFullYear()
    const periods = cacheRef.current.get(year)
    if (!periods) {
      void ensureYear(year)
      return false
    }
    return isDateLocked(date, periods)
  }, [periodEnabled, voucher24HourLockEnabled, ensureYear])

  const getEntryLockInfo = useCallback((entry) => {
    const createdAt = createdAtFromEntry(entry)
    const ageLocked = Boolean(voucher24HourLockEnabled && createdAt && isPast24HourWindow(createdAt))
    const periodLocked = (() => {
      if (!periodEnabled) return false
      const date = accountingDateFromEntry(entry)
      if (!date) return false
      const periods = cacheRef.current.get(date.getUTCFullYear())
      if (!periods) return false
      return isDateLocked(date, periods)
    })()
    const locked = periodLocked || ageLocked
    return {
      locked,
      periodLocked,
      ageLocked,
      editableUntil: voucher24HourLockEnabled ? editableUntilFromCreatedAt(createdAt) : null,
      voucher24HourLockEnabled,
    }
  }, [periodEnabled, voucher24HourLockEnabled])

  const prefetchDates = useCallback((dates = []) => {
    if (!periodEnabled) return
    const years = new Set()
    for (const value of dates) {
      const d = value instanceof Date ? value : new Date(value)
      if (!Number.isNaN(d.getTime())) years.add(d.getUTCFullYear())
    }
    years.forEach((year) => { void ensureYear(year) })
  }, [periodEnabled, ensureYear])

  const invalidate = useCallback(() => {
    cacheRef.current.clear()
    setTick((n) => n + 1)
    if (periodEnabled) void ensureYear(new Date().getUTCFullYear())
    void refreshControls()
  }, [periodEnabled, ensureYear, refreshControls])

  return {
    enabled: periodEnabled || lock24hFeature,
    periodEnabled,
    voucher24HourLockFeature: lock24hFeature,
    voucher24HourLockEnabled,
    isEntryLocked,
    getEntryLockInfo,
    prefetchDates,
    invalidate,
    ensureYear,
    refreshControls,
  }
}
