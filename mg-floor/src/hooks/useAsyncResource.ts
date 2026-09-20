import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import type { AsyncResourceState } from '@/src/async/types'
import { toApiError, userFacingMessage } from '@/src/api/errors'
import { classifyCacheFreshness, shouldSkipNetworkFetch } from '@/src/hooks/cachePolicy'

type Options<T> = {
  cacheKey?: string
  cacheTtlMs?: number
  isEmpty?: (data: T) => boolean
  enabled?: boolean
  loadOnMount?: boolean
  deps?: unknown[]
}

const DEFAULT_TTL = 5 * 60 * 1000
const SLOW_MS = 3000

async function readCache<T>(key: string): Promise<{ data: T; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; at: number }
    if (!parsed || typeof parsed.at !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache<T>(key: string, data: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, at: Date.now() }))
  } catch {
    // ignore
  }
}

export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: Options<T> = {},
) {
  const {
    cacheKey,
    cacheTtlMs = DEFAULT_TTL,
    isEmpty,
    enabled = true,
    loadOnMount = true,
    deps = [],
  } = options

  const [state, setState] = useState<AsyncResourceState<T>>({
    status: 'idle',
    data: null,
    error: null,
    errorKind: null,
    updatedAt: null,
    fromCache: false,
  })
  const [slow, setSlow] = useState(false)
  const [stale, setStale] = useState(false)

  const dataRef = useRef<T | null>(null)
  dataRef.current = state.data
  const updatedAtRef = useRef<number | null>(null)
  updatedAtRef.current = state.updatedAt
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (mode: 'initial' | 'reload' = 'initial') => {
    if (!enabled) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSlow(false)
    const slowTimer = setTimeout(() => {
      if (!controller.signal.aborted) setSlow(true)
    }, SLOW_MS)

    const hadData = dataRef.current != null
    const forceNetwork = mode === 'reload'

    if (!hadData) {
      setState((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        errorKind: null,
      }))
    } else {
      setState((prev) => ({
        ...prev,
        status: 'retrying',
        error: null,
        errorKind: null,
      }))
    }

    const net = await NetInfo.fetch()
    const offline = net.isConnected === false

    let cachedAt: number | null = updatedAtRef.current

    if (cacheKey && !hadData) {
      const cached = await readCache<T>(cacheKey)
      if (cached && !controller.signal.aborted) {
        const empty = isEmpty ? isEmpty(cached.data) : false
        dataRef.current = cached.data
        cachedAt = cached.at
        updatedAtRef.current = cached.at
        const freshness = classifyCacheFreshness(cached.at, cacheTtlMs)
        setStale(freshness !== 'fresh')
        setState({
          status: offline ? 'offline' : empty ? 'empty' : 'success',
          data: cached.data,
          updatedAt: cached.at,
          fromCache: true,
          error: offline ? 'You are offline. Showing last known data.' : null,
          errorKind: offline ? 'OFFLINE' : null,
        })
      }
    } else if (hadData && cachedAt != null) {
      setStale(classifyCacheFreshness(cachedAt, cacheTtlMs) !== 'fresh')
    }

    // CASE A / D: offline with or without cache — never call API when offline with data
    if (shouldSkipNetworkFetch({ offline, hasCachedOrLiveData: dataRef.current != null })) {
      clearTimeout(slowTimer)
      setSlow(false)
      setState((prev) => ({
        ...prev,
        status: 'offline',
        error: prev.error || 'You are offline. Showing last known data.',
        errorKind: 'OFFLINE',
        fromCache: true,
        updatedAt: prev.updatedAt ?? cachedAt,
      }))
      return
    }

    if (offline && dataRef.current == null) {
      clearTimeout(slowTimer)
      setSlow(false)
      setState((prev) => ({
        ...prev,
        status: 'offline',
        error: 'You are offline.',
        errorKind: 'OFFLINE',
      }))
      return
    }

    // Online + fresh cache on initial: still refresh in background (stale-while-revalidate)
    // unless we already have live data and freshness is fresh and not forced — still refresh
    // so operators get updates; TTL mainly drives STALE label.
    void forceNetwork

    try {
      const data = await fetcherRef.current(controller.signal)
      if (controller.signal.aborted) return
      const empty = isEmpty ? isEmpty(data) : false
      const at = Date.now()
      if (cacheKey) await writeCache(cacheKey, data)
      dataRef.current = data
      updatedAtRef.current = at
      setStale(false)
      setState({
        status: empty ? 'empty' : 'success',
        data,
        error: null,
        errorKind: null,
        updatedAt: at,
        fromCache: false,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const e = toApiError(err)
      if (e.kind === 'CANCELLED') return
      const keep = dataRef.current
      const net2 = await NetInfo.fetch()
      const stillOffline = net2.isConnected === false
      // Preserve cached.at / prior updatedAt — never stamp Date.now() on failed refresh
      const preservedAt = updatedAtRef.current
      setState({
        status:
          keep != null
            ? stillOffline
              ? 'offline'
              : 'error'
            : stillOffline
              ? 'offline'
              : 'error',
        data: keep,
        error: userFacingMessage(e) || e.message,
        errorKind: e.kind,
        updatedAt: keep != null ? preservedAt : null,
        fromCache: keep != null,
      })
      if (keep != null && preservedAt != null) {
        setStale(classifyCacheFreshness(preservedAt, cacheTtlMs) !== 'fresh')
      }
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
    }
  }, [enabled, cacheKey, cacheTtlMs, isEmpty])

  const reload = useCallback(() => load('reload'), [load])

  useEffect(() => {
    if (!loadOnMount || !enabled) return
    load('initial')
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadOnMount, ...deps])

  return {
    ...state,
    reload,
    load,
    isLoading: state.status === 'loading' || state.status === 'retrying',
    slow,
    stale,
    abort: () => abortRef.current?.abort(),
  }
}
