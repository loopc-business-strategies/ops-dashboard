import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { reportsApi } from '../api/erp-accounting/reports'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'
import { subscribeRealtimeEvents, parseRealtimeEventData } from '../utils/realtimeEventsBus'
import {
  LIVE_METAL_RATE_LIMIT_BACKOFF_MS,
  TOPBAR_MARKET_PARAMS,
  buildMetalRatesFromApiPayload,
  isMt4BridgeRates,
  marketPricesToRates,
  metalErrorFromException,
  normalizeMarketUnit,
  resolveLiveMetalPollIntervalMs,
} from '../utils/liveMetalRates'

function normalizeInboundRates(rates) {
  if (!rates || typeof rates !== 'object') return null
  return buildMetalRatesFromApiPayload(rates)
}

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

/** Module store so Provider state ticks do not re-render the whole Dashboard tree. */
let storeState = {
  snapshot: EMPTY_SNAPSHOT,
  error: null,
  streamWarning: null,
}
const storeListeners = new Set()

function getMetalRatesStoreState() {
  return storeState
}

function subscribeMetalRatesStore(listener) {
  storeListeners.add(listener)
  return () => storeListeners.delete(listener)
}

function setMetalRatesStoreState(partial) {
  storeState = { ...storeState, ...partial }
  storeListeners.forEach((listener) => listener())
}

function resetMetalRatesStoreState() {
  storeState = {
    snapshot: EMPTY_SNAPSHOT,
    error: null,
    streamWarning: null,
  }
  storeListeners.forEach((listener) => listener())
}

export function LiveMetalRatesProvider({ token, tenant, enabled = true, children }) {
  const lastSnapshotRef = useRef(null)
  const sourceRef = useRef('')
  const streamConnectedRef = useRef(false)
  const pollPausedUntilRef = useRef(0)
  const pollTimerRef = useRef(null)
  const pollIntervalMsRef = useRef(null)
  const schedulePollRef = useRef(() => {})
  const loadRef = useRef(async () => {})

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
    const prevSource = sourceRef.current
    sourceRef.current = next.source
    setMetalRatesStoreState({
      error: null,
      streamWarning: null,
      snapshot: {
        ...next,
        deltas,
        prevSnapshot: prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)
          ? { gold: prevSnapshot.gold, silver: prevSnapshot.silver, platinum: prevSnapshot.platinum }
          : null,
      },
    })
    if (prevSource !== next.source) {
      schedulePollRef.current()
    }
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
        applyRates(normalizeInboundRates(liveRates), { allowNonMt4Override: live.feedType === 'market' })
        return
      }

      const saved = await currenciesApi.getMetalRates(token)
      if (saved?.success && saved.rates) {
        const sg = Number(saved.rates.goldPrice) || 0
        const ss = Number(saved.rates.silverPrice) || 0
        if (sg > 0 && ss > 0) {
          applyRates(normalizeInboundRates(saved.rates))
          if (!live?.live) {
            setMetalRatesStoreState({
              error: live?.message ? { message: 'bridge offline' } : null,
            })
          }
        }
      }
    } catch (err) {
      const parsed = metalErrorFromException(err)
      if (parsed.status === 429) {
        pollPausedUntilRef.current = Date.now() + LIVE_METAL_RATE_LIMIT_BACKOFF_MS
      }
      setMetalRatesStoreState({ error: parsed })
    }
  }, [applyRates, enabled, token])

  loadRef.current = load

  const schedulePoll = useCallback(() => {
    const intervalMs = resolveLiveMetalPollIntervalMs(streamConnectedRef.current, sourceRef.current)
    const needsReset = pollIntervalMsRef.current !== intervalMs || !pollTimerRef.current
    pollIntervalMsRef.current = intervalMs

    if (!needsReset) return

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (!enabled) return

    void load()
    pollTimerRef.current = window.setInterval(() => {
      void load()
    }, intervalMs)
  }, [enabled, load])

  schedulePollRef.current = schedulePoll

  useEffect(() => {
    schedulePoll()
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      pollIntervalMsRef.current = null
    }
  }, [schedulePoll])

  useEffect(() => {
    if (!enabled || !token) {
      return undefined
    }

    return subscribeRealtimeEvents(tenant, 'metal-rates:update', (event) => {
      try {
        const data = parseRealtimeEventData(event, {})
        const rates = data.rates || data
        applyRates(normalizeInboundRates(rates))
      } catch {
        // Ignore malformed realtime events.
      }
    })
  }, [applyRates, enabled, tenant, token])

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
      onConnect: () => void load(),
      onRatesUpdate: (payload) => {
        const raw = payload?.rates || payload?.data?.rates
        applyRates(normalizeInboundRates(raw))
      },
    })
  }, [applyRates, enabled, load, tenant, token])

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
      setMetalRatesStoreState({ streamWarning: { message: 'market stream offline' } })
      const hasPrices = lastSnapshotRef.current
        && (lastSnapshotRef.current.gold > 0 || lastSnapshotRef.current.silver > 0 || lastSnapshotRef.current.platinum > 0)
      if (!hasPrices) {
        const prev = getMetalRatesStoreState()
        if (!prev.error) {
          setMetalRatesStoreState({ error: { message: 'market stream offline' } })
        }
      }
    }

    return () => {
      closed = true
      streamConnectedRef.current = false
      source.close()
    }
  }, [applyRates, enabled, schedulePoll, tenant, token])

  useEffect(() => () => {
    resetMetalRatesStoreState()
    lastSnapshotRef.current = null
    sourceRef.current = ''
  }, [])

  const reload = useCallback(() => loadRef.current(), [])
  const value = useMemo(() => ({ reload }), [reload])

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
  const state = useSyncExternalStore(
    subscribeMetalRatesStore,
    getMetalRatesStoreState,
    getMetalRatesStoreState,
  )
  return {
    snapshot: state.snapshot,
    error: state.error,
    streamWarning: state.streamWarning,
    reload: ctx.reload,
  }
}

export default LiveMetalRatesContext
