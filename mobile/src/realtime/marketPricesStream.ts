import { Platform } from 'react-native'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_URL, getTenant } from '@/src/config/tenant'
import { TOPBAR_MARKET_PARAMS } from '@/src/utils/liveMetalRates'

const trimApiBase = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

function buildMarketPricesStreamUrl(tenant: string): string {
  const base = trimApiBase(API_URL)
  const tenantKey = encodeURIComponent(tenant || getTenant())
  const params = new URLSearchParams({
    currency: TOPBAR_MARKET_PARAMS.currency,
    unit: TOPBAR_MARKET_PARAMS.unit,
    tenant: tenantKey,
    company: tenantKey,
  })
  return `${base}/api/erp-accounting/reports/market-prices/stream?${params.toString()}`
}

/**
 * Market-prices SSE stream (web LiveMetalRatesContext parity).
 */
export function startMarketPricesStream(
  token: string,
  tenant: string,
  onTick: (data: Record<string, unknown>) => void,
  onConnect?: () => void,
  onDisconnect?: () => void,
): () => void {
  const tenantKey = tenant || getTenant()
  if (!token || !tenantKey) return () => {}

  const url = buildMarketPricesStreamUrl(tenantKey)
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
      onopen() {
        onConnect?.()
        return Promise.resolve()
      },
      onmessage(ev) {
        try {
          const data = JSON.parse(ev.data || '{}') as Record<string, unknown>
          onTick(data)
        } catch {
          // ignore malformed payloads
        }
      },
      onerror() {
        onDisconnect?.()
      },
    }).catch(() => {
      onDisconnect?.()
    })

    return () => {
      onDisconnect?.()
      ac.abort()
    }
  }

  let closed = false
  const run = async () => {
    while (!closed) {
      try {
        const res = await fetch(url, { method: 'GET', headers })
        if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
        onConnect?.()
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
            const dataLines: string[] = []
            for (const line of block.split(/\r?\n/)) {
              if (!line || line.startsWith(':')) continue
              if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
            }
            if (dataLines.length) {
              try {
                onTick(JSON.parse(dataLines.join('\n')) as Record<string, unknown>)
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        onDisconnect?.()
        if (closed) break
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  void run()
  return () => {
    closed = true
    onDisconnect?.()
    ac.abort()
  }
}
