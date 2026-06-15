import { Platform } from 'react-native'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_URL, TENANT } from '@/src/config/tenant'

const trimApiBase = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

function buildRealtimeEventsUrl(): string {
  const base = trimApiBase(API_URL)
  return `${base}/api/realtime/events`
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true },
    )
  })
}

type SseHeaders = Record<string, string>

/**
 * Parse one SSE block (lines between blank lines). Returns null for heartbeats / empty blocks.
 */
function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/)
  let event = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (!line.length || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message'
    } else if (line.startsWith('data:')) {
      const rest = line.slice(5)
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest)
    }
  }
  if (!dataLines.length) return null
  return { event, data: dataLines.join('\n') }
}

/**
 * Fetch-based SSE reader for React Native (no `document` / `window` from `@microsoft/fetch-event-source`).
 */
async function consumeSseStream(
  url: string,
  headers: SseHeaders,
  signal: AbortSignal,
  onSseEvent: (eventName: string, data: string) => void,
): Promise<void> {
  const res = await fetch(url, { method: 'GET', headers, signal })
  if (!res.ok) {
    throw new Error(`SSE HTTP ${res.status}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    throw new Error(`Expected text/event-stream, got ${ct || '(none)'}`)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('SSE response has no readable body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Dispatch complete SSE messages (blank line separates messages)
    let sep: number
    while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      if (raw.startsWith('\n')) continue
      const parsed = parseSseBlock(raw)
      if (parsed) onSseEvent(parsed.event, parsed.data)
    }
  }
}

function startNativeChatSse(token: string, onMessageCreated: () => void): () => void {
  const ac = new AbortController()
  const url = buildRealtimeEventsUrl()
  const headers: SseHeaders = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
    'x-tenant': TENANT,
    'x-company': TENANT,
    'X-Client': 'mobile',
  }

  const run = async () => {
    let retryMs = 1000
    while (!ac.signal.aborted) {
      let threw = false
      try {
        await consumeSseStream(url, headers, ac.signal, (eventName) => {
          if (eventName === 'message.created') onMessageCreated()
        })
        retryMs = 1000
      } catch {
        if (ac.signal.aborted) break
        threw = true
      }
      if (ac.signal.aborted) break
      await delay(Math.min(retryMs, 30_000), ac.signal)
      if (!ac.signal.aborted && threw) retryMs = Math.min(retryMs * 2, 30_000)
    }
  }

  void run()
  return () => ac.abort()
}

/**
 * Subscribe to tenant-scoped SSE from GET /api/realtime/events (same bus as web ChatTab).
 * Uses Bearer auth — required for mobile (no session cookies).
 *
 * **Web:** `@microsoft/fetch-event-source` (visibility handling).
 * **iOS / Android:** native `fetch` streaming reader — avoids `document` / `window` used by the library.
 */
export function startChatMessageEvents(
  token: string,
  onMessageCreated: () => void,
): () => void {
  if (Platform.OS === 'web') {
    const url = buildRealtimeEventsUrl()
    const ac = new AbortController()

    void fetchEventSource(url, {
      signal: ac.signal,
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'x-tenant': TENANT,
        'x-company': TENANT,
        'X-Client': 'mobile',
      },
      onmessage(ev) {
        if (ev.event === 'message.created') onMessageCreated()
      },
    }).catch(() => {
      // Network / 401 — effect restarts when token changes
    })

    return () => ac.abort()
  }

  return startNativeChatSse(token, onMessageCreated)
}
