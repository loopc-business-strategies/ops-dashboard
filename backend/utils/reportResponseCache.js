const DEFAULT_TTL_MS = 60000
const sharedCoordination = require('./sharedCoordination')

function createReportResponseCache(defaultTtlMs = DEFAULT_TTL_MS) {
  const store = new Map()
  const inflight = new Map()

  return {
    get(key) {
      const row = store.get(key)
      if (!row || row.expiresAt <= Date.now()) {
        if (row) store.delete(key)
        return null
      }
      return row.payload
    },
    set(key, payload, ttlMs = defaultTtlMs) {
      store.set(key, { payload, expiresAt: Date.now() + ttlMs })
    },
    clearLocal(key) {
      if (key) store.delete(key)
      else store.clear()
    },
    async getShared(key) {
      const shared = await sharedCoordination.getJson(`report-cache:${key}`)
      if (shared) return shared
      return this.get(key)
    },
    async setShared(key, payload, ttlMs = defaultTtlMs) {
      this.set(key, payload, ttlMs)
      await sharedCoordination.setJson(`report-cache:${key}`, payload, ttlMs)
    },
    /**
     * Singleflight: concurrent callers with the same key share one compute.
     */
    async getOrCompute(key, computeFn, ttlMs = defaultTtlMs) {
      const cached = await this.getShared(key)
      if (cached) return { payload: cached, fromCache: true }

      if (inflight.has(key)) {
        const payload = await inflight.get(key)
        return { payload, fromCache: true }
      }

      const promise = Promise.resolve()
        .then(computeFn)
        .then(async (payload) => {
          await this.setShared(key, payload, ttlMs)
          return payload
        })
        .finally(() => {
          inflight.delete(key)
        })

      inflight.set(key, promise)
      const payload = await promise
      return { payload, fromCache: false }
    },
    /**
     * Drop local cache entries whose key starts with prefix (tenant:…).
     * Redis keys expire via TTL; local clear avoids serving stale immediately after writes.
     */
    invalidateByPrefix(prefix) {
      const p = String(prefix || '')
      if (!p) {
        store.clear()
        inflight.clear()
        return
      }
      for (const key of store.keys()) {
        if (key.startsWith(p)) store.delete(key)
      }
      for (const key of inflight.keys()) {
        if (key.startsWith(p)) inflight.delete(key)
      }
    },
    buildKey(parts) {
      return parts.filter((part) => part !== undefined && part !== null && part !== '').join(':')
    },
  }
}

module.exports = {
  createReportResponseCache,
  DEFAULT_TTL_MS,
}
