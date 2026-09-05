/** External presence store — Chat subscribes without re-rendering Dashboard. */

let onlineUserIds = []
const listeners = new Set()

export function getOnlineUserIds() {
  return onlineUserIds
}

export function subscribeOnlineUserIds(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setOnlineUserIds(ids) {
  const next = Array.isArray(ids) ? ids.map(String) : []
  const prev = onlineUserIds
  if (prev.length === next.length && prev.every((id, i) => id === next[i])) return
  onlineUserIds = next
  listeners.forEach((listener) => listener())
}

export function applyPresenceUpdate({ userId, online }) {
  const normalizedId = String(userId || '')
  if (!normalizedId) return
  const next = new Set(onlineUserIds)
  if (online) next.add(normalizedId)
  else next.delete(normalizedId)
  setOnlineUserIds(Array.from(next))
}

export function clearOnlineUserIds() {
  setOnlineUserIds([])
}
