import { API_URL } from '@/src/config/env'
import { getTenant } from '@/src/config/tenant'

type RequestOptions = {
  method?: string
  token?: string | null
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check connection or work offline.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token = authToken, body, params } = options
  const tenant = getTenant()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': tenant,
    'x-company': tenant,
    'X-Client': 'mg-floor',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchWithTimeout(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized()
    const message = typeof (data as { message?: string })?.message === 'string'
      ? (data as { message: string }).message
      : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}
