/**
 * Lightweight Server-Timing helper for Chrome DevTools.
 * Do not attach account names, amounts, or other sensitive fields.
 */
function createServerTiming() {
  const marks = new Map()
  const startedAt = process.hrtime.bigint()

  return {
    start(name) {
      marks.set(String(name), process.hrtime.bigint())
    },
    end(name) {
      const key = String(name)
      const from = marks.get(key)
      if (!from) return 0
      const ms = Number(process.hrtime.bigint() - from) / 1e6
      marks.set(`${key}:ms`, ms)
      return ms
    },
    apply(res, extras = {}) {
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const parts = [`total;dur=${totalMs.toFixed(1)}`]
      for (const [key, value] of marks.entries()) {
        if (!key.endsWith(':ms')) continue
        const name = key.slice(0, -3)
        parts.push(`${name};dur=${Number(value).toFixed(1)}`)
      }
      Object.entries(extras).forEach(([name, dur]) => {
        if (!Number.isFinite(Number(dur))) return
        parts.push(`${name};dur=${Number(dur).toFixed(1)}`)
      })
      try {
        res.setHeader('Server-Timing', parts.join(', '))
        res.setHeader('X-Response-Time-Ms', totalMs.toFixed(1))
      } catch {
        /* headers may already be sent */
      }
      return totalMs
    },
  }
}

module.exports = {
  createServerTiming,
}
