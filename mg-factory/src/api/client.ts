import { API_URL } from '@/src/config/env'
import { getTenant } from '@/src/config/tenant'
import { ApiError, classifyHttpStatus, toApiError } from '@/src/api/errors'

type RequestOptions = {
  method?: string
  token?: string | null
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

const REQUEST_TIMEOUT_MS = 20000
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken() {
  return authToken
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const base = `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  if (!params) return base
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, external?: AbortSignal) {
  const controller = new AbortController()
  let timedOut = false
  const onExternalAbort = () => {
    try {
      controller.abort()
    } catch {
      // ignore
    }
  }
  if (external) {
    if (external.aborted) onExternalAbort()
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timeout = setTimeout(() => {
    timedOut = true
    try {
      controller.abort()
    } catch {
      // ignore
    }
  }, REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (external?.aborted) throw new ApiError('Request cancelled', 'CANCELLED')
    if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
      throw new ApiError('Request timed out. Check connection.', 'TIMEOUT')
    }
    throw toApiError(err)
  } finally {
    clearTimeout(timeout)
    if (external) external.removeEventListener('abort', onExternalAbort)
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token = authToken, body, params, signal } = options
  const tenant = getTenant()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': tenant,
    'x-company': tenant,
    'X-Client': 'mg-factory',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchWithTimeout(
    buildUrl(path, params),
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    signal,
  )

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized()
    const message =
      typeof (data as { message?: string })?.message === 'string'
        ? (data as { message: string }).message
        : `Request failed (${res.status})`
    throw classifyHttpStatus(res.status, message)
  }
  return data as T
}
