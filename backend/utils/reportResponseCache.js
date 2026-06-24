const DEFAULT_TTL_MS = 60000
const sharedCoordination = require('./sharedCoordination')

function createReportResponseCache(defaultTtlMs = DEFAULT_TTL_MS) {
  const store = new Map()

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
    async getShared(key) {
      const shared = await sharedCoordination.getJson(`report-cache:${key}`)
      if (shared) return shared
      return this.get(key)
    },
    async setShared(key, payload, ttlMs = defaultTtlMs) {
      this.set(key, payload, ttlMs)
      await sharedCoordination.setJson(`report-cache:${key}`, payload, ttlMs)
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
