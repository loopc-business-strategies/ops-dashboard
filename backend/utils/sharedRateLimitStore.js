const {
  incrementCounter,
  decrementCounter,
  resetCounter,
} = require('./sharedCoordination')

function createSharedRateLimitStore(prefix = 'rate-limit') {
  let windowMs = 60_000

  return {
    init(options = {}) {
      windowMs = Number(options.windowMs || windowMs)
    },
    async increment(key) {
      return incrementCounter(`${prefix}:${key}`, windowMs)
    },
    async decrement(key) {
      await decrementCounter(`${prefix}:${key}`)
    },
    async resetKey(key) {
      await resetCounter(`${prefix}:${key}`)
    },
  }
}

module.exports = { createSharedRateLimitStore }
