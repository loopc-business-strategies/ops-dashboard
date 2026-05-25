const DEFAULT_TTL_MS = 60000

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
    buildKey(parts) {
      return parts.filter((part) => part !== undefined && part !== null && part !== '').join(':')
    },
  }
}

module.exports = {
  createReportResponseCache,
  DEFAULT_TTL_MS,
}
