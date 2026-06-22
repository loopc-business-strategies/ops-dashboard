import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { fetchLiveMetalRates, fetchSavedMetalRates } from '@/src/api/metalRates'
import { useAuth } from '@/src/context/AuthContext'
import { getTenant } from '@/src/config/tenant'
import { startMetalRatesRealtime } from '@/src/realtime/metalRatesSocket'
import {
  LIVE_METAL_POLL_MS,
  LIVE_METAL_POLL_STREAM_MS,
  LIVE_METAL_RATE_LIMIT_BACKOFF_MS,
  type LiveMetalSnapshot,
  type MetalRatesError,
  buildMetalRatesFromApiPayload,
  isMt4BridgeRates,
  metalErrorFromException,
  normalizeMarketUnit,
} from '@/src/utils/liveMetalRates'

const EMPTY_SNAPSHOT: LiveMetalSnapshot = {
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

type LiveMetalRatesContextValue = {
  snapshot: LiveMetalSnapshot
  error: MetalRatesError | null
  refresh: () => Promise<void>
}

const LiveMetalRatesContext = createContext<LiveMetalRatesContextValue | null>(null)

function useLiveMetalRatesState(token: string | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<LiveMetalSnapshot>(EMPTY_SNAPSHOT)
  const [error, setError] = useState<MetalRatesError | null>(null)
  const lastSnapshotRef = useRef<{ gold: number; silver: number; platinum: number } | null>(null)
  const sourceRef = useRef('')
  const socketConnectedRef = useRef(false)
  const pollPausedUntilRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appActiveRef = useRef(true)

  const applyRates = useCallback((rates: Record<string, unknown> | null | undefined, options: { allowNonMt4Override?: boolean } = {}) => {
    if (!rates) return
    const allowNonMt4Override = Boolean(options.allowNonMt4Override)

    const incomingMt4 = isMt4BridgeRates(rates as { source?: string })
    const currentMt4 = isMt4BridgeRates({ source: sourceRef.current })
    if (!incomingMt4 && currentMt4 && !allowNonMt4Override) return

    const useSourceToz = normalizeMarketUnit(String(rates.sourceUnit || rates.priceUnit || '')) === 'TOZ'
    const pickPrice = (sourceValue: unknown, storedValue: unknown) => {
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
      updatedAt: (rates.updatedAt as string | null) || null,
    }
    const prevSnapshot = lastSnapshotRef.current
    let deltas: LiveMetalSnapshot['deltas'] = null
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
    setSnapshot({
      ...next,
      deltas,
      prevSnapshot:
        prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)
          ? { gold: prevSnapshot.gold, silver: prevSnapshot.silver, platinum: prevSnapshot.platinum }
          : null,
    })
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    if (Date.now() < pollPausedUntilRef.current) return
    if (!appActiveRef.current) return

    try {
      const live = await fetchLiveMetalRates(token)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && live?.live && liveRates && g > 0 && s > 0 && p > 0) {
        applyRates(buildMetalRatesFromApiPayload(liveRates as Record<string, unknown>), {
          allowNonMt4Override: live.feedType === 'market',
        })
        return
      }

      const saved = await fetchSavedMetalRates(token)
      if (saved?.success && saved.rates) {
        const sg = Number(saved.rates.goldPrice) || 0
        const ss = Number(saved.rates.silverPrice) || 0
        if (sg > 0 && ss > 0) {
          applyRates(buildMetalRatesFromApiPayload(saved.rates as Record<string, unknown>))
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
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (!enabled) return

    const intervalMs = socketConnectedRef.current ? LIVE_METAL_POLL_STREAM_MS : LIVE_METAL_POLL_MS
    void load()
    pollTimerRef.current = setInterval(() => {
      void load()
    }, intervalMs)
  }, [enabled, load])

  useEffect(() => {
    schedulePoll()
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [schedulePoll])

  useEffect(() => {
    if (!enabled) return undefined

    const handleAppState = (state: AppStateStatus) => {
      const active = state === 'active'
      appActiveRef.current = active
      if (active) void load()
    }
    const sub = AppState.addEventListener('change', handleAppState)
    appActiveRef.current = AppState.currentState === 'active'
    return () => sub.remove()
  }, [enabled, load])

  useEffect(() => {
    if (!enabled || !token) return undefined

    const stop = startMetalRatesRealtime({
      token,
      tenant: getTenant(),
      onConnect: () => {
        socketConnectedRef.current = true
        schedulePoll()
      },
      onDisconnect: () => {
        socketConnectedRef.current = false
        schedulePoll()
      },
      onRatesUpdate: (payload) => {
        const rates = payload?.rates || payload?.data?.rates
        if (rates) applyRates(buildMetalRatesFromApiPayload(rates))
      },
    })

    return () => {
      socketConnectedRef.current = false
      stop()
    }
  }, [applyRates, enabled, schedulePoll, token])

  return { snapshot, error, refresh: load }
}

export function LiveMetalRatesProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const enabled = Boolean(token && isAuthenticated)
  const value = useLiveMetalRatesState(token, enabled)

  return <LiveMetalRatesContext.Provider value={value}>{children}</LiveMetalRatesContext.Provider>
}

export function useLiveMetalRates(): LiveMetalRatesContextValue {
  const ctx = useContext(LiveMetalRatesContext)
  if (!ctx) {
    throw new Error('useLiveMetalRates must be used within LiveMetalRatesProvider')
  }
  return ctx
}

export default LiveMetalRatesContext
