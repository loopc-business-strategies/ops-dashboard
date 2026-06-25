import { Platform } from 'react-native'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_URL, getTenant } from '@/src/config/tenant'

const trimApiBase = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

function buildRealtimeEventsUrl(tenant: string): string {
  const base = trimApiBase(API_URL)
  const tenantKey = encodeURIComponent(tenant || getTenant())
  return `${base}/api/realtime/events?tenant=${tenantKey}&company=${tenantKey}`
}

/**
 * SSE backup for metal-rates:update (same bus as web LiveMetalRatesContext).
 */
export function startMetalRatesEvents(
  token: string,
  tenant: string,
  onRatesUpdate: (data: Record<string, unknown>) => void,
): () => void {
  const tenantKey = tenant || getTenant()
  if (!token || !tenantKey) return () => {}

  const url = buildRealtimeEventsUrl(tenantKey)
  const ac = new AbortController()

  const headers = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
    'x-tenant': tenantKey,
    'x-company': tenantKey,
    'X-Client': 'mobile',
  }

  if (Platform.OS === 'web') {
    void fetchEventSource(url, {
      signal: ac.signal,
      headers,
      onmessage(ev) {
        if (ev.event !== 'metal-rates:update') return
        try {
          const data = JSON.parse(ev.data || '{}') as Record<string, unknown>
          onRatesUpdate(data)
        } catch {
          // ignore malformed payloads
        }
      },
    }).catch(() => {})

    return () => ac.abort()
  }

  let closed = false
  const run = async () => {
    while (!closed) {
      try {
        const res = await fetch(url, { method: 'GET', headers })
        if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!closed) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split(/\r?\n\r?\n/)
          buffer = parts.pop() || ''
          for (const block of parts) {
            if (!block.trim()) continue
            let event = 'message'
            const dataLines: string[] = []
            for (const line of block.split(/\r?\n/)) {
              if (!line || line.startsWith(':')) continue
              if (line.startsWith('event:')) event = line.slice(6).trim()
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
            }
            if (event === 'metal-rates:update' && dataLines.length) {
              try {
                onRatesUpdate(JSON.parse(dataLines.join('\n')) as Record<string, unknown>)
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        if (closed) break
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  void run()
  return () => {
    closed = true
    ac.abort()
  }
}
