import { useCallback, useEffect, useRef, useState } from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'
import {
  MT4_LIVE_POLL_MS,
  isMt4BridgeRates,
  metalErrorFromException,
  normalizeMarketUnit,
} from '../utils/liveMetalRates'

const EMPTY_SNAPSHOT = {
  gold: 0,
  silver: 0,
  platinum: 0,
  currency: 'USD',
  unit: 'TOZ',
  source: 'waiting-mt4',
  updatedAt: null,
  deltas: null,
  prevSnapshot: null,
}

/**
 * Live Gold / Silver / Platinum from the MT4 bridge only (poll + Socket.IO push).
 */
export default function useLiveMetalRates({ token, tenant, enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [error, setError] = useState(null)
  const lastSnapshotRef = useRef(null)

  const applyRates = useCallback((rates) => {
    if (!isMt4BridgeRates(rates)) return

    const useSourceToz = normalizeMarketUnit(rates.sourceUnit || rates.priceUnit) === 'TOZ'
    const pickPrice = (sourceValue, storedValue) => {
      const source = Number(sourceValue) || 0
      return useSourceToz && source > 0 ? source : Number(storedValue) || 0
    }
    const next = {
      gold: pickPrice(rates.sourceGoldPrice, rates.goldPrice),
      silver: pickPrice(rates.sourceSilverPrice, rates.silverPrice),
      platinum: pickPrice(rates.sourcePlatinumPrice, rates.platinumPrice),
      currency: String(rates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
      unit: useSourceToz ? 'TOZ' : String(rates.priceUnit || 'G').trim().toUpperCase() || 'G',
      source: 'mt4-bridge',
      updatedAt: rates.updatedAt || null,
    }
    const prevSnapshot = lastSnapshotRef.current
    let deltas = null
    if (prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)) {
      deltas = {
        gold: next.gold - prevSnapshot.gold,
        silver: next.silver - prevSnapshot.silver,
        platinum: next.platinum - prevSnapshot.platinum,
      }
    }
    lastSnapshotRef.current = { gold: next.gold, silver: next.silver, platinum: next.platinum }
    setError(null)
    setSnapshot({
      ...next,
      deltas,
      prevSnapshot: prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)
        ? { gold: prevSnapshot.gold, silver: prevSnapshot.silver, platinum: prevSnapshot.platinum }
        : null,
    })
  }, [])

  const resetWaiting = useCallback(() => {
    lastSnapshotRef.current = null
    setSnapshot(EMPTY_SNAPSHOT)
    setError(null)
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const live = await currenciesApi.getLiveMetalRates(token)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && live?.live && isMt4BridgeRates(liveRates) && g > 0 && s > 0 && p > 0) {
        applyRates(liveRates)
        return
      }
      resetWaiting()
    } catch (err) {
      resetWaiting()
      setError(metalErrorFromException(err))
    }
  }, [applyRates, enabled, resetWaiting, token])

  useEffect(() => {
    if (!enabled) return undefined
    void load()
    const id = window.setInterval(() => void load(), MT4_LIVE_POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, load])

  useEffect(() => {
    if (!enabled) return undefined
    return startMetalRatesRealtime({
      token,
      tenant,
      onRatesUpdate: (payload) => applyRates(payload?.rates || payload?.data?.rates),
    })
  }, [applyRates, enabled, tenant, token])

  return { snapshot, error, reload: load }
}
