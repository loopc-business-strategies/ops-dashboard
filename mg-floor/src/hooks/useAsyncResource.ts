import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import type { AsyncResourceState } from '@/src/async/types'
import { toApiError, userFacingMessage } from '@/src/api/errors'

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

  const dataRef = useRef<T | null>(null)
  dataRef.current = state.data
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
    setState((prev) => ({
      ...prev,
      status: hadData ? 'retrying' : 'loading',
      error: null,
      errorKind: null,
    }))

    const net = await NetInfo.fetch()
    const offline = net.isConnected === false

    if (cacheKey && !hadData) {
      const cached = await readCache<T>(cacheKey)
      if (cached && !controller.signal.aborted) {
        const empty = isEmpty ? isEmpty(cached.data) : false
        dataRef.current = cached.data
        // Stale cache while online = LAST KNOWN (success/empty), not OFFLINE
        setState({
          status: offline ? 'offline' : empty ? 'empty' : 'success',
          data: cached.data,
          updatedAt: cached.at,
          fromCache: true,
          error: offline ? 'You are offline. Showing last known data.' : null,
          errorKind: offline ? 'OFFLINE' : null,
        })
      }
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

    try {
      const data = await fetcherRef.current(controller.signal)
      if (controller.signal.aborted) return
      const empty = isEmpty ? isEmpty(data) : false
      if (cacheKey) await writeCache(cacheKey, data)
      dataRef.current = data
      setState({
        status: empty ? 'empty' : 'success',
        data,
        error: null,
        errorKind: null,
        updatedAt: Date.now(),
        fromCache: false,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const e = toApiError(err)
      if (e.kind === 'CANCELLED') return
      const keep = dataRef.current
      const net2 = await NetInfo.fetch()
      const stillOffline = net2.isConnected === false
      setState({
        status:
          keep != null
            ? stillOffline
              ? 'offline'
              : 'error'
            : stillOffline || e.kind === 'NETWORK_ERROR' || e.kind === 'TIMEOUT'
              ? stillOffline
                ? 'offline'
                : 'error'
              : 'error',
        data: keep,
        error: userFacingMessage(e) || e.message,
        errorKind: e.kind,
        updatedAt: keep != null ? Date.now() : null,
        fromCache: keep != null,
      })
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
    abort: () => abortRef.current?.abort(),
  }
}
