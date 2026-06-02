import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { fetchLiveMetalRates, type LiveMetalRatesResponse } from '@/src/api/dashboard'
import { useAuth } from '@/src/context/AuthContext'
import { snapshotFromRates, type MetalSnapshot } from '@/src/utils/liveMetalDisplay'

const POLL_MS = 15_000

export type MetalDeltas = {
  gold: number
  silver: number
  platinum: number
} | null

type Ctx = {
  snapshot: MetalSnapshot | null
  deltas: MetalDeltas
  error: string
  live: boolean
  message: string
  reload: () => Promise<void>
}

const LiveMetalTickerContext = createContext<Ctx | null>(null)

export function LiveMetalTickerProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const [snapshot, setSnapshot] = useState<MetalSnapshot | null>(null)
  const [deltas, setDeltas] = useState<MetalDeltas>(null)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)
  const [message, setMessage] = useState('')
  const prevRef = useRef<MetalSnapshot | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  const applyResponse = useCallback((data: LiveMetalRatesResponse | null) => {
    if (!data?.rates) {
      setSnapshot(null)
      setDeltas(null)
      setError(data?.message || 'No rates')
      setLive(Boolean(data?.live))
      setMessage(String(data?.message || ''))
      return
    }
    const next = snapshotFromRates(data.rates)
    setLive(Boolean(data.live))
    setMessage(String(data.message || ''))
    setError('')
    if (!next) {
      setSnapshot(null)
      setDeltas(null)
      return
    }
    const prev = prevRef.current
    if (prev && (prev.gold > 0 || prev.silver > 0 || prev.platinum > 0)) {
      setDeltas({
        gold: next.gold - prev.gold,
        silver: next.silver - prev.silver,
        platinum: next.platinum - prev.platinum,
      })
    } else {
      setDeltas(null)
    }
    prevRef.current = {
      gold: next.gold,
      silver: next.silver,
      platinum: next.platinum,
      currency: next.currency,
      unit: next.unit,
      source: next.source,
      updatedAt: next.updatedAt,
    }
    setSnapshot(next)
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await fetchLiveMetalRates(token)
      applyResponse(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load metal rates'
      setError(msg)
      setLive(false)
    }
  }, [applyResponse, token])

  useEffect(() => {
    if (!token) {
      prevRef.current = null
      setSnapshot(null)
      setDeltas(null)
      setError('')
      setLive(false)
      setMessage('')
      return undefined
    }

    void load()

    const id = setInterval(() => {
      if (appStateRef.current === 'active') void load()
    }, POLL_MS)

    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next
      if (next === 'active') void load()
    })

    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [load, token])

  const value: Ctx = {
    snapshot,
    deltas,
    error,
    live,
    message,
    reload: load,
  }

  return (
    <LiveMetalTickerContext.Provider value={value}>
      {children}
    </LiveMetalTickerContext.Provider>
  )
}

export function useLiveMetalTickerState(): Ctx {
  const ctx = useContext(LiveMetalTickerContext)
  if (!ctx) {
    throw new Error('useLiveMetalTickerState must be used within LiveMetalTickerProvider')
  }
  return ctx
}
