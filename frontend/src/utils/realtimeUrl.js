const trimApiSuffix = (value) => String(value || '').replace(/\/+$/, '').replace(/\/api$/i, '')

export const resolveRealtimeBaseUrl = () => {
  const envBase = trimApiSuffix(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '')
  if (envBase) return envBase
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

const appendTenantQuery = (url, tenant) => {
  const tenantKey = String(tenant || '').trim().toLowerCase()
  if (!tenantKey) return url
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined)
    parsed.searchParams.set('tenant', tenantKey)
    parsed.searchParams.set('company', tenantKey)
    return parsed.toString()
  } catch {
    const separator = String(url || '').includes('?') ? '&' : '?'
    const encoded = encodeURIComponent(tenantKey)
    return `${url}${separator}tenant=${encoded}&company=${encoded}`
  }
}

export const buildRealtimeEventsUrl = (tenant) => {
  const base = resolveRealtimeBaseUrl()
  if (!base) return ''
  return appendTenantQuery(`${base.replace(/\/$/, '')}/api/realtime/events`, tenant)
}

export const buildRealtimeNamespaceUrl = (namespace) => {
  const base = resolveRealtimeBaseUrl()
  return base ? `${base}${namespace}` : namespace
}
