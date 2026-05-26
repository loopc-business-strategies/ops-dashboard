import { useCallback, useEffect, useRef, useState } from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { reportsApi } from '../api/erp-accounting/reports'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'
import {
  LIVE_METAL_POLL_MS,
  TOPBAR_MARKET_PARAMS,
  marketPricesToRates,
  metalErrorFromException,
  normalizeMarketUnit,
} from '../utils/liveMetalRates'

const EMPTY_SNAPSHOT = {
  gold: 0,
  silver: 0,
  platinum: 0,
  currency: 'USD',
  unit: 'TOZ',
  source: '',
  updatedAt: null,
  deltas: null,
  prevSnapshot: null,
}

/**
 * Shared live Gold / Silver / Platinum feed (poll + socket + SSE), same source as top bar.
 */
export default function useLiveMetalRates({ token, tenant, enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [error, setError] = useState(null)
  const lastSnapshotRef = useRef(null)

  const applyRates = useCallback((rates) => {
    if (!rates) return
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
      source: String(rates.source || '').trim(),
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

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const live = await currenciesApi.getLiveMetalRates(token)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && liveRates && g > 0 && s > 0 && p > 0) {
        applyRates(liveRates)
        return
      }

      try {
        const market = await reportsApi.getMarketPrices(token, { ...TOPBAR_MARKET_PARAMS, fresh: 1 })
        const marketRates = marketPricesToRates(market)
        const mg = Number(marketRates?.goldPrice) || 0
        const ms = Number(marketRates?.silverPrice) || 0
        const mp = Number(marketRates?.platinumPrice) || 0
        if (marketRates && mg > 0 && ms > 0 && mp > 0) {
          applyRates(marketRates)
          return
        }
      } catch {
        // Some roles can read saved rates but not reports.
      }

      const saved = await currenciesApi.getMetalRates(token)
      if (saved?.success && saved.rates) {
        applyRates(saved.rates)
        if (!live?.live) {
          setError(live?.message ? { message: 'bridge offline' } : null)
        }
      }
    } catch (err) {
      setError(metalErrorFromException(err))
    }
  }, [applyRates, enabled, token])

  useEffect(() => {
    if (!enabled) return undefined
    void load()
    const id = window.setInterval(() => void load(), LIVE_METAL_POLL_MS)
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

  useEffect(() => {
    if (!enabled || !token || typeof window === 'undefined' || typeof window.EventSource !== 'function') {
      return undefined
    }

    let closed = false
    const source = new window.EventSource(
      reportsApi.getMarketPricesStreamUrl(TOPBAR_MARKET_PARAMS),
      { withCredentials: true },
    )

    source.onmessage = (event) => {
      if (closed) return
      try {
        const rates = marketPricesToRates(JSON.parse(event.data))
        if (rates) applyRates(rates)
      } catch {
        // Ignore malformed stream ticks.
      }
    }

    source.onerror = () => {
      setError((prev) => prev || { message: 'market stream offline' })
    }

    return () => {
      closed = true
      source.close()
    }
  }, [applyRates, enabled, token])

  return { snapshot, error, reload: load }
}
