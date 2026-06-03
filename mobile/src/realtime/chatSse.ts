import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_URL, TENANT } from '@/src/config/tenant'

const trimApiBase = (value: string) =>
  String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')

/**
 * Subscribe to tenant-scoped SSE from GET /api/realtime/events (same bus as web ChatTab).
 * Uses Bearer auth — required for mobile (no session cookies).
 */
export function startChatMessageEvents(
  token: string,
  onMessageCreated: () => void,
): () => void {
  const base = trimApiBase(API_URL)
  const url = `${base}/api/realtime/events`
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
