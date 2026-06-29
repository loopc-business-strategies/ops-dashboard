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
import { useTenant } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { startMetalRatesEvents } from '@/src/realtime/metalRatesSse'
import { startMetalRatesRealtime } from '@/src/realtime/metalRatesSocket'
import { startMarketPricesStream } from '@/src/realtime/marketPricesStream'
import {
  LIVE_METAL_RATE_LIMIT_BACKOFF_MS,
  type LiveMetalSnapshot,
  type MetalRatesError,
  buildMetalRatesFromApiPayload,
  isMt4BridgeRates,
  marketPricesToRates,
  metalErrorFromException,
  normalizeMarketUnit,
  resolveLiveMetalPollIntervalMs,
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

function normalizeInboundRates(rates: Record<string, unknown> | null | undefined) {
  if (!rates || typeof rates !== 'object') return null
  return buildMetalRatesFromApiPayload(rates)
}

function useLiveMetalRatesState(
  token: string | null,
  enabled: boolean,
  companyCode: string,
  sessionReady: boolean,
  tenantSessionKey: string,
) {
  const [snapshot, setSnapshot] = useState<LiveMetalSnapshot>(EMPTY_SNAPSHOT)
  const [error, setError] = useState<MetalRatesError | null>(null)
  const lastSnapshotRef = useRef<{ gold: number; silver: number; platinum: number } | null>(null)
  const sourceRef = useRef('')
  const socketConnectedRef = useRef(false)
  const streamConnectedRef = useRef(false)
  const pollPausedUntilRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalMsRef = useRef<number | null>(null)
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
    const prevSource = sourceRef.current
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
    if (prevSource !== next.source) {
      schedulePollRef.current()
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled || !sessionReady) return
    if (Date.now() < pollPausedUntilRef.current) return
    if (!appActiveRef.current) return

    try {
      const live = await fetchLiveMetalRates(token, companyCode)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && live?.live && liveRates && g > 0 && s > 0 && p > 0) {
        applyRates(normalizeInboundRates(liveRates as Record<string, unknown>), {
          allowNonMt4Override: live.feedType === 'market',
        })
        return
      }

      const saved = await fetchSavedMetalRates(token, companyCode)
      if (saved?.success && saved.rates) {
        const sg = Number(saved.rates.goldPrice) || 0
        const ss = Number(saved.rates.silverPrice) || 0
        if (sg > 0 && ss > 0) {
          applyRates(normalizeInboundRates(saved.rates as Record<string, unknown>))
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
  }, [applyRates, companyCode, enabled, sessionReady, token])

  const schedulePollRef = useRef(() => {})

  const schedulePoll = useCallback(() => {
    const intervalMs = resolveLiveMetalPollIntervalMs(streamConnectedRef.current, sourceRef.current)
    const needsReset = pollIntervalMsRef.current !== intervalMs || !pollTimerRef.current
    pollIntervalMsRef.current = intervalMs

    if (!needsReset) return

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (!enabled) return

    void load()
    pollTimerRef.current = setInterval(() => {
      void load()
    }, intervalMs)
  }, [enabled, load])

  schedulePollRef.current = schedulePoll

  useEffect(() => {
    schedulePoll()
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      pollIntervalMsRef.current = null
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
    setSnapshot(EMPTY_SNAPSHOT)
    setError(null)
    lastSnapshotRef.current = null
    sourceRef.current = ''
  }, [tenantSessionKey])

  useEffect(() => {
    if (!enabled || !token || !sessionReady) return undefined

    const stopSse = startMetalRatesEvents(token, companyCode, (data) => {
      const rates = (data.rates as Record<string, unknown>) || data
      applyRates(normalizeInboundRates(rates))
    })

    const stop = startMetalRatesRealtime({
      token,
      tenant: companyCode,
      onConnect: () => {
        socketConnectedRef.current = true
        schedulePoll()
        void load()
      },
      onDisconnect: () => {
        socketConnectedRef.current = false
        schedulePoll()
      },
      onRatesUpdate: (payload) => {
        const raw = payload?.rates || payload?.data?.rates
        applyRates(normalizeInboundRates(raw))
      },
    })

    return () => {
      socketConnectedRef.current = false
      stopSse()
      stop()
    }
  }, [applyRates, companyCode, enabled, load, schedulePoll, sessionReady, token])

  useEffect(() => {
    if (!enabled || !token || !sessionReady) return undefined

    const stopMarket = startMarketPricesStream(
      token,
      companyCode,
      (payload) => {
        const rates = marketPricesToRates(payload)
        if (rates) applyRates(normalizeInboundRates(rates as Record<string, unknown>))
      },
      () => {
        streamConnectedRef.current = true
        schedulePoll()
      },
      () => {
        if (streamConnectedRef.current) {
          streamConnectedRef.current = false
          schedulePoll()
        }
      },
    )

    return () => {
      streamConnectedRef.current = false
      stopMarket()
    }
  }, [applyRates, companyCode, enabled, schedulePoll, sessionReady, token])

  return { snapshot, error, refresh: load }
}

export function LiveMetalRatesProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const { companyCode } = useTenant()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const enabled = Boolean(token && isAuthenticated)
  const value = useLiveMetalRatesState(token, enabled, companyCode, sessionReady, tenantSessionKey)

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
