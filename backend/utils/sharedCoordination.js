const { EventEmitter } = require('events')

const localStore = new Map()
const localBus = new EventEmitter()
localBus.setMaxListeners(500)

let redisClientPromise = null
let redisSubscriberPromise = null
let redisDisabled = false

function redisUrl() {
  return String(process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '').trim()
}

function isRedisConfigured() {
  return Boolean(redisUrl())
}

async function getRedisClient() {
  if (!isRedisConfigured() || redisDisabled) return null
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const { createClient } = require('redis')
        const client = createClient({ url: redisUrl() })
        client.on('error', (err) => {
          console.warn('[sharedCoordination] redis error', err.message)
        })
        await client.connect()
        return client
      } catch (err) {
        redisDisabled = true
        console.warn('[sharedCoordination] redis unavailable; using local fallback', err.message)
        return null
      }
    })()
  }
  return redisClientPromise
}

function localGet(key) {
  const row = localStore.get(key)
  if (!row || row.expiresAt <= Date.now()) {
    if (row) localStore.delete(key)
    return null
  }
  return row.value
}

function localSet(key, value, ttlMs) {
  localStore.set(key, { value, expiresAt: Date.now() + ttlMs })
  if (localStore.size > 10000) {
    const now = Date.now()
    for (const [entryKey, row] of localStore.entries()) {
      if (row.expiresAt <= now) localStore.delete(entryKey)
    }
  }
}

async function getJson(key) {
  const namespacedKey = `ops:${key}`
  const client = await getRedisClient()
  if (client) {
    const raw = await client.get(namespacedKey)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return localGet(namespacedKey)
}

async function setJson(key, value, ttlMs) {
  const namespacedKey = `ops:${key}`
  const normalizedTtl = Math.max(1, Number(ttlMs || 0))
  const client = await getRedisClient()
  if (client) {
    await client.set(namespacedKey, JSON.stringify(value), { PX: normalizedTtl })
    return
  }
  localSet(namespacedKey, value, normalizedTtl)
}

async function setOnce(key, ttlMs) {
  const namespacedKey = `ops:${key}`
  const normalizedTtl = Math.max(1, Number(ttlMs || 0))
  const client = await getRedisClient()
  if (client) {
    const result = await client.set(namespacedKey, '1', { PX: normalizedTtl, NX: true })
    return result === 'OK'
  }
  if (localGet(namespacedKey)) return false
  localSet(namespacedKey, true, normalizedTtl)
  return true
}

async function incrementCounter(key, windowMs) {
  const namespacedKey = `ops:${key}`
  const normalizedWindow = Math.max(1, Number(windowMs || 0))
  const client = await getRedisClient()
  if (client) {
    const totalHits = await client.incr(namespacedKey)
    let ttl = await client.pTTL(namespacedKey)
    if (ttl < 0) {
      await client.pExpire(namespacedKey, normalizedWindow)
      ttl = normalizedWindow
    }
    return {
      totalHits,
      resetTime: new Date(Date.now() + ttl),
    }
  }

  const row = localStore.get(namespacedKey)
  const now = Date.now()
  if (!row || row.expiresAt <= now) {
    localStore.set(namespacedKey, { value: 1, expiresAt: now + normalizedWindow })
    return { totalHits: 1, resetTime: new Date(now + normalizedWindow) }
  }
  row.value = Number(row.value || 0) + 1
  return { totalHits: row.value, resetTime: new Date(row.expiresAt) }
}

async function decrementCounter(key) {
  const namespacedKey = `ops:${key}`
  const client = await getRedisClient()
  if (client) {
    await client.decr(namespacedKey)
    return
  }
  const row = localStore.get(namespacedKey)
  if (row) row.value = Math.max(0, Number(row.value || 0) - 1)
}

async function resetCounter(key) {
  const namespacedKey = `ops:${key}`
  const client = await getRedisClient()
  if (client) {
    await client.del(namespacedKey)
    return
  }
  localStore.delete(namespacedKey)
}

async function publish(channel, payload) {
  const client = await getRedisClient()
  if (client) {
    await client.publish(`ops:${channel}`, JSON.stringify(payload))
    return
  }
  emitLocal(channel, payload)
}

async function subscribe(channel, handler) {
  const redisChannel = `ops:${channel}`
  const client = await getRedisClient()
  if (!client) return onLocal(channel, handler)

  if (!redisSubscriberPromise) {
    redisSubscriberPromise = (async () => {
      const subscriber = client.duplicate()
      subscriber.on('error', (err) => {
        console.warn('[sharedCoordination] redis subscriber error', err.message)
      })
      await subscriber.connect()
      return subscriber
    })()
  }
  const subscriber = await redisSubscriberPromise
  const listener = (message) => {
    try {
      handler(JSON.parse(message))
    } catch {
      // ignore malformed coordination messages
    }
  }
  await subscriber.subscribe(redisChannel, listener)
  return () => {
    subscriber.unsubscribe(redisChannel, listener).catch(() => {})
  }
}

function emitLocal(channel, payload) {
  localBus.emit(channel, payload)
}

function onLocal(channel, handler) {
  localBus.on(channel, handler)
  return () => localBus.off(channel, handler)
}

function resetLocalCoordinationForTests() {
  localStore.clear()
}

module.exports = {
  getJson,
  setJson,
  setOnce,
  incrementCounter,
  decrementCounter,
  resetCounter,
  publish,
  subscribe,
  emitLocal,
  onLocal,
  isRedisConfigured,
  resetLocalCoordinationForTests,
}
