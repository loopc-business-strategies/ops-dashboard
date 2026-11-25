const UserNavShortcuts = require('../models/UserNavShortcuts')
const { assertAllowedNavItemId, isAllowedNavItemId } = require('../utils/navItemAllowlist')

const MAX_RECENT = 10
const MAX_FAVORITES = 40

async function getOrCreateDoc(userId) {
  let doc = await UserNavShortcuts.findOne({ userId })
  if (!doc) {
    doc = await UserNavShortcuts.create({ userId, favorites: [], recent: [] })
  }
  return doc
}

function serializeFavorites(favorites = []) {
  return [...favorites]
    .filter((f) => f && isAllowedNavItemId(f.navItemId))
    .sort((a, b) => (a.order - b.order) || String(a.navItemId).localeCompare(String(b.navItemId)))
    .map((f) => ({
      navItemId: f.navItemId,
      order: f.order,
      createdAt: f.createdAt || null,
    }))
}

function serializeRecent(recent = []) {
  return [...recent]
    .filter((r) => r && isAllowedNavItemId(r.navItemId))
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
    .slice(0, MAX_RECENT)
    .map((r) => ({
      navItemId: r.navItemId,
      visitedAt: r.visitedAt || null,
    }))
}

async function getFavorites(userId) {
  const doc = await getOrCreateDoc(userId)
  return serializeFavorites(doc.favorites)
}

async function addFavorite(userId, navItemIdRaw) {
  const navItemId = assertAllowedNavItemId(navItemIdRaw)
  const doc = await getOrCreateDoc(userId)
  const existing = (doc.favorites || []).find((f) => f.navItemId === navItemId)
  if (existing) {
    return serializeFavorites(doc.favorites)
  }
  if ((doc.favorites || []).length >= MAX_FAVORITES) {
    const err = new Error(`You can save at most ${MAX_FAVORITES} favorites.`)
    err.status = 400
    err.code = 'FAVORITES_LIMIT'
    throw err
  }
  const maxOrder = (doc.favorites || []).reduce((m, f) => Math.max(m, Number(f.order) || 0), -1)
  doc.favorites.push({ navItemId, order: maxOrder + 1, createdAt: new Date() })
  doc.markModified('favorites')
  await doc.save()
  return serializeFavorites(doc.favorites)
}

async function removeFavorite(userId, navItemIdRaw) {
  const navItemId = assertAllowedNavItemId(navItemIdRaw)
  const doc = await getOrCreateDoc(userId)
  doc.favorites = (doc.favorites || []).filter((f) => f.navItemId !== navItemId)
  doc.markModified('favorites')
  await doc.save()
  return serializeFavorites(doc.favorites)
}

async function reorderFavorites(userId, navItemIdsRaw = []) {
  const ids = [...new Set(
    (Array.isArray(navItemIdsRaw) ? navItemIdsRaw : [])
      .map((id) => String(id || '').trim())
      .filter(isAllowedNavItemId),
  )]
  const doc = await getOrCreateDoc(userId)
  const byId = new Map((doc.favorites || []).map((f) => [f.navItemId, f]))
  const next = []
  ids.forEach((id, index) => {
    const prev = byId.get(id)
    if (!prev) return
    next.push({
      navItemId: id,
      order: index,
      createdAt: prev.createdAt || new Date(),
    })
    byId.delete(id)
  })
  // Keep any favorites omitted from the payload at the end (stable).
  for (const leftover of byId.values()) {
    next.push({
      navItemId: leftover.navItemId,
      order: next.length,
      createdAt: leftover.createdAt || new Date(),
    })
  }
  doc.favorites = next
  doc.markModified('favorites')
  await doc.save()
  return serializeFavorites(doc.favorites)
}

async function getRecent(userId) {
  const doc = await getOrCreateDoc(userId)
  return serializeRecent(doc.recent)
}

async function recordRecent(userId, navItemIdRaw) {
  const navItemId = assertAllowedNavItemId(navItemIdRaw)
  const doc = await getOrCreateDoc(userId)
  const now = new Date()
  const rest = (doc.recent || []).filter((r) => r.navItemId !== navItemId)
  doc.recent = [{ navItemId, visitedAt: now }, ...rest].slice(0, MAX_RECENT)
  doc.markModified('recent')
  await doc.save()
  return serializeRecent(doc.recent)
}

async function clearRecent(userId) {
  const doc = await getOrCreateDoc(userId)
  doc.recent = []
  doc.markModified('recent')
  await doc.save()
  return []
}

module.exports = {
  MAX_RECENT,
  MAX_FAVORITES,
  getFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
  getRecent,
  recordRecent,
  clearRecent,
  serializeFavorites,
  serializeRecent,
}
