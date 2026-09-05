import { buildRealtimeEventsUrl } from './realtimeUrl'

/**
 * Shared EventSource for /api/realtime/events — one connection per tenant.
 * Callers subscribe by event type; connection closes when the last subscriber leaves.
 */

const buses = new Map()

function getOrCreateBus(tenant) {
  const tenantKey = String(tenant || '').trim().toLowerCase() || 'default'
  let bus = buses.get(tenantKey)
  if (bus) return bus

  const url = buildRealtimeEventsUrl(tenantKey === 'default' ? '' : tenantKey)
  if (!url || typeof EventSource === 'undefined') {
    bus = {
      tenantKey,
      source: null,
      listeners: new Map(),
      refCount: 0,
    }
    buses.set(tenantKey, bus)
    return bus
  }

  const source = new EventSource(url, { withCredentials: true })
  bus = {
    tenantKey,
    source,
    listeners: new Map(),
    refCount: 0,
    onEvent: (eventType, ev) => {
      const set = bus.listeners.get(eventType)
      if (!set || !set.size) return
      set.forEach((handler) => {
        try {
          handler(ev)
        } catch {
          // Ignore subscriber errors
        }
      })
    },
  }

  const knownTypes = new Set()
  bus.ensureType = (eventType) => {
    if (knownTypes.has(eventType) || !bus.source) return
    if (typeof bus.source.addEventListener !== 'function') return
    knownTypes.add(eventType)
    bus.source.addEventListener(eventType, (ev) => bus.onEvent(eventType, ev))
  }

  buses.set(tenantKey, bus)
  return bus
}

/**
 * Subscribe to one or more SSE event types on the shared tenant bus.
 * @param {string} tenant
 * @param {string|string[]} eventTypes
 * @param {(ev: MessageEvent) => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribeRealtimeEvents(tenant, eventTypes, handler) {
  if (typeof handler !== 'function') return () => {}
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
  const bus = getOrCreateBus(tenant)
  bus.refCount += 1

  types.forEach((eventType) => {
    if (!bus.listeners.has(eventType)) bus.listeners.set(eventType, new Set())
    bus.listeners.get(eventType).add(handler)
    if (typeof bus.ensureType === 'function') bus.ensureType(eventType)
  })

  let closed = false
  return () => {
    if (closed) return
    closed = true
    types.forEach((eventType) => {
      const set = bus.listeners.get(eventType)
      if (set) {
        set.delete(handler)
        if (!set.size) bus.listeners.delete(eventType)
      }
    })
    bus.refCount = Math.max(0, bus.refCount - 1)
    if (bus.refCount === 0) {
      if (bus.source) bus.source.close()
      buses.delete(bus.tenantKey)
    }
  }
}

export function parseRealtimeEventData(ev, fallback = {}) {
  try {
    return JSON.parse(ev?.data || '{}')
  } catch {
    return fallback
  }
}
