import { API_URL, getTenant, syncTenantFromJwt } from '@/src/config/tenant'
import { notifyUnauthorized } from '@/src/api/sessionEvents'

type RequestOptions = {
  method?: string
  token?: string | null
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

const REQUEST_TIMEOUT_MS = 20000
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    syncTenantFromJwt(token)
  }
}

export function getAuthToken() {
  return authToken
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
      throw new Error('Request timed out. Please check your connection and try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function shouldNotifyUnauthorized(path: string, status: number) {
  if (status !== 401) return false
  const normalized = path.split('?')[0] || ''
  return !/\/api\/auth\/login\b/i.test(normalized)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token = authToken, body, params } = options
  const tenant = getTenant()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': tenant,
    'x-company': tenant,
    'X-Client': 'mobile',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchWithTimeout(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (shouldNotifyUnauthorized(path, res.status)) {
      notifyUnauthorized()
    }
    const message = typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export async function apiUploadRequest<T>(
  path: string,
  formData: FormData,
  token: string | null = authToken,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-tenant': getTenant(),
    'x-company': getTenant(),
    'X-Client': 'mobile',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (shouldNotifyUnauthorized(path, res.status)) {
      notifyUnauthorized()
    }
    const message = typeof data?.message === 'string' ? data.message : `Upload failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export function attachmentRequestUrl(fileName: string) {
  return buildUrl(`/api/messages/attachments/${encodeURIComponent(fileName)}`)
}
