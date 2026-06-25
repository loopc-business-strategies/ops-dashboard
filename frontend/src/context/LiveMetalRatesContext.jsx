import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { reportsApi } from '../api/erp-accounting/reports'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'
import {
  LIVE_METAL_POLL_MS,
  LIVE_METAL_POLL_STREAM_MS,
  LIVE_METAL_RATE_LIMIT_BACKOFF_MS,
  TOPBAR_MARKET_PARAMS,
  isMt4BridgeRates,
  marketPricesToRates,
  metalErrorFromException,
  normalizeMarketUnit,
  resolveLiveMetalPollIntervalMs,
} from '../utils/liveMetalRates'

const LiveMetalRatesContext = createContext(null)

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

export function LiveMetalRatesProvider({ token, tenant, enabled = true, children }) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [error, setError] = useState(null)
  const [streamWarning, setStreamWarning] = useState(null)
  const lastSnapshotRef = useRef(null)
  const sourceRef = useRef('')
  const streamConnectedRef = useRef(false)
  const pollPausedUntilRef = useRef(0)
  const pollTimerRef = useRef(null)

  const applyRates = useCallback((rates, options = {}) => {
    if (!rates) return
    const allowNonMt4Override = Boolean(options.allowNonMt4Override)

    const incomingMt4 = isMt4BridgeRates(rates)
    const currentMt4 = isMt4BridgeRates({ source: sourceRef.current })
    // Block EventSource / misc non-MT4 ticks from replacing an active MT4 stream,
    // but allow GET /metal-rates/live when the server returns feedType "market"
    // (stale or missing MT4 — see docs/MT4_METAL_PRICE_BRIDGE.md).
    if (!incomingMt4 && currentMt4 && !allowNonMt4Override) return

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
    sourceRef.current = next.source
    setError(null)
    setStreamWarning(null)
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
    if (Date.now() < pollPausedUntilRef.current) return
    if (typeof document !== 'undefined' && document.hidden) return

    try {
      const live = await currenciesApi.getLiveMetalRates(token)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && live?.live && liveRates && g > 0 && s > 0 && p > 0) {
        applyRates(liveRates, { allowNonMt4Override: live.feedType === 'market' })
        return
      }

      const saved = await currenciesApi.getMetalRates(token)
      if (saved?.success && saved.rates) {
        const sg = Number(saved.rates.goldPrice) || 0
        const ss = Number(saved.rates.silverPrice) || 0
        if (sg > 0 && ss > 0) {
          applyRates(saved.rates)
          if (!live?.live) {
            setError(live?.message ? { message: 'bridge offline' } : null)
          }
        }
      }
    } catch (err) {
      const parsed = metalErrorFromException(err)
      if (parsed.status === 429) {
        pollPausedUntilRef.current = Date.now() + LIVE_METAL_RATE_LIMIT_BACKOFF_MS
      }
      setError(parsed)
    }
  }, [applyRates, enabled, token])

  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (!enabled) return

    const intervalMs = resolveLiveMetalPollIntervalMs(streamConnectedRef.current, sourceRef.current)
    void load()
    pollTimerRef.current = window.setInterval(() => {
      void load()
    }, intervalMs)
  }, [enabled, load])

  useEffect(() => {
    schedulePoll()
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [schedulePoll])

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined

    const handleVisibility = () => {
      if (!document.hidden) {
        void load()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
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
      streamConnectedRef.current = false
      schedulePoll()
      return undefined
    }

    let closed = false
    const source = new window.EventSource(
      reportsApi.getMarketPricesStreamUrl({
        ...TOPBAR_MARKET_PARAMS,
        ...(tenant ? { tenant, company: tenant } : {}),
      }),
      { withCredentials: true },
    )

    source.onopen = () => {
      if (closed) return
      streamConnectedRef.current = true
      schedulePoll()
    }

    source.onmessage = (event) => {
      if (closed) return
      streamConnectedRef.current = true
      try {
        const rates = marketPricesToRates(JSON.parse(event.data))
        if (rates) applyRates(rates)
      } catch {
        // Ignore malformed stream ticks.
      }
    }

    source.onerror = () => {
      if (streamConnectedRef.current) {
        streamConnectedRef.current = false
        schedulePoll()
      }
      setStreamWarning({ message: 'market stream offline' })
      const hasPrices = lastSnapshotRef.current
        && (lastSnapshotRef.current.gold > 0 || lastSnapshotRef.current.silver > 0 || lastSnapshotRef.current.platinum > 0)
      if (!hasPrices) {
        setError((prev) => prev || { message: 'market stream offline' })
      }
    }

    return () => {
      closed = true
      streamConnectedRef.current = false
      source.close()
    }
  }, [applyRates, enabled, schedulePoll, tenant, token])

  const value = { snapshot, error, streamWarning, reload: load }
  return (
    <LiveMetalRatesContext.Provider value={value}>
      {children}
    </LiveMetalRatesContext.Provider>
  )
}

export function useLiveMetalRates() {
  const ctx = useContext(LiveMetalRatesContext)
  if (!ctx) {
    throw new Error('useLiveMetalRates must be used within LiveMetalRatesProvider')
  }
  return ctx
}

export default LiveMetalRatesContext
