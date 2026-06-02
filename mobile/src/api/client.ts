import { API_URL, TENANT } from '@/src/config/tenant'

type RequestOptions = {
  method?: string
  token?: string | null
  body?: unknown
  params?: Record<string, string | number | undefined>
}

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token = authToken, body, params } = options
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-tenant': TENANT,
    'x-company': TENANT,
    'X-Client': 'mobile',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
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
    'x-tenant': TENANT,
    'x-company': TENANT,
    'X-Client': 'mobile',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : `Upload failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export function attachmentRequestUrl(fileName: string) {
  return buildUrl(`/api/messages/attachments/${encodeURIComponent(fileName)}`)
}
