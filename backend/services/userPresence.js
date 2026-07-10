const {
  getJson,
  setJson,
  incrementCounter,
  decrementCounter,
  getCounter,
  resetCounter,
} = require('../utils/sharedCoordination')

const CONNECTION_COUNTER_WINDOW_MS = 24 * 60 * 60 * 1000
const ONLINE_SET_TTL_MS = 7 * 24 * 60 * 60 * 1000

function connectionKey(tenant, userId) {
  return `presence:conn:${tenant}:${userId}`
}

function onlineSetKey(tenant) {
  return `presence:online:${tenant}`
}

async function readOnlineMap(tenant) {
  const map = await getJson(onlineSetKey(tenant))
  return map && typeof map === 'object' ? map : {}
}

async function writeOnlineMap(tenant, map) {
  await setJson(onlineSetKey(tenant), map, ONLINE_SET_TTL_MS)
}

async function addToOnlineSet(tenant, userId) {
  const map = await readOnlineMap(tenant)
  map[String(userId)] = true
  await writeOnlineMap(tenant, map)
}

async function removeFromOnlineSet(tenant, userId) {
  const map = await readOnlineMap(tenant)
  delete map[String(userId)]
  await writeOnlineMap(tenant, map)
}

async function registerConnection(tenant, userId) {
  const normalizedTenant = String(tenant || '').trim().toLowerCase()
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedTenant || !normalizedUserId) {
    return { becameOnline: false, totalHits: 0 }
  }

  const key = connectionKey(normalizedTenant, normalizedUserId)
  const { totalHits } = await incrementCounter(key, CONNECTION_COUNTER_WINDOW_MS)
  const becameOnline = totalHits === 1
  if (becameOnline) {
    await addToOnlineSet(normalizedTenant, normalizedUserId)
  }
  return { becameOnline, totalHits }
}

async function unregisterConnection(tenant, userId) {
  const normalizedTenant = String(tenant || '').trim().toLowerCase()
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedTenant || !normalizedUserId) {
    return { becameOffline: false, remaining: 0 }
  }

  const key = connectionKey(normalizedTenant, normalizedUserId)
  await decrementCounter(key)
  const remaining = await getCounter(key)
  const becameOffline = remaining <= 0
  if (becameOffline) {
    await resetCounter(key)
    await removeFromOnlineSet(normalizedTenant, normalizedUserId)
  }
  return { becameOffline, remaining: Math.max(0, remaining) }
}

async function getOnlineUserIds(tenant) {
  const normalizedTenant = String(tenant || '').trim().toLowerCase()
  if (!normalizedTenant) return []
  const map = await readOnlineMap(normalizedTenant)
  return Object.keys(map).filter((userId) => map[userId])
}

async function isUserOnline(tenant, userId) {
  const normalizedTenant = String(tenant || '').trim().toLowerCase()
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedTenant || !normalizedUserId) return false
  const map = await readOnlineMap(normalizedTenant)
  return Boolean(map[normalizedUserId])
}

async function resetPresenceForTests() {
  await writeOnlineMap('loopc', {})
  await writeOnlineMap('mg', {})
  await writeOnlineMap('cg', {})
}

module.exports = {
  registerConnection,
  unregisterConnection,
  getOnlineUserIds,
  isUserOnline,
  resetPresenceForTests,
}
