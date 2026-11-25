import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addFavorite as apiAddFavorite,
  clearRecent as apiClearRecent,
  getFavorites,
  getRecent,
  recordRecent as apiRecordRecent,
  removeFavorite as apiRemoveFavorite,
  reorderFavorites as apiReorderFavorites,
} from '../api/userNavShortcuts'

/**
 * Load / mutate per-user favorites + recent nav shortcuts.
 */
export function useUserNavShortcuts({ enabled = true } = {}) {
  const [favorites, setFavorites] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState('')
  const mountedRef = useRef(true)
  const recordingRef = useRef(new Set())

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFavorites([])
      setRecent([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [favRes, recentRes] = await Promise.all([getFavorites(), getRecent()])
      if (!mountedRef.current) return
      setFavorites(Array.isArray(favRes?.favorites) ? favRes.favorites : [])
      setRecent(Array.isArray(recentRes?.recent) ? recentRes.recent : [])
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.response?.data?.message || err.message || 'Failed to load shortcuts')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  const favoriteIdSet = useMemo(
    () => new Set((favorites || []).map((f) => f.navItemId)),
    [favorites],
  )

  const isFavorite = useCallback((navItemId) => favoriteIdSet.has(navItemId), [favoriteIdSet])

  const toggleFavorite = useCallback(async (navItemId) => {
    const id = String(navItemId || '').trim()
    if (!id) return
    const wasFavorite = favoriteIdSet.has(id)
    setFavorites((prev) => {
      if (wasFavorite) return prev.filter((f) => f.navItemId !== id)
      const maxOrder = prev.reduce((m, f) => Math.max(m, Number(f.order) || 0), -1)
      return [...prev, { navItemId: id, order: maxOrder + 1, createdAt: new Date().toISOString() }]
    })
    try {
      const res = wasFavorite
        ? await apiRemoveFavorite(id)
        : await apiAddFavorite(id)
      if (!mountedRef.current) return
      if (Array.isArray(res?.favorites)) setFavorites(res.favorites)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.response?.data?.message || err.message || 'Failed to update favorite')
      refresh()
    }
  }, [favoriteIdSet, refresh])

  const reorderFavoriteIds = useCallback(async (navItemIds) => {
    const ids = (navItemIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    setFavorites((prev) => {
      const byId = new Map(prev.map((f) => [f.navItemId, f]))
      return ids.map((id, order) => {
        const prevItem = byId.get(id) || { navItemId: id, createdAt: new Date().toISOString() }
        return { ...prevItem, order }
      })
    })
    try {
      const res = await apiReorderFavorites(ids)
      if (!mountedRef.current) return
      if (Array.isArray(res?.favorites)) setFavorites(res.favorites)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.response?.data?.message || err.message || 'Failed to reorder favorites')
      refresh()
    }
  }, [refresh])

  const recordRecentVisit = useCallback(async (navItemId) => {
    const id = String(navItemId || '').trim()
    if (!id || !enabled) return
    if (recordingRef.current.has(id)) return
    recordingRef.current.add(id)
    setRecent((prev) => {
      const rest = prev.filter((r) => r.navItemId !== id)
      return [{ navItemId: id, visitedAt: new Date().toISOString() }, ...rest].slice(0, 10)
    })
    try {
      const res = await apiRecordRecent(id)
      if (!mountedRef.current) return
      if (Array.isArray(res?.recent)) setRecent(res.recent)
    } catch {
      /* non-blocking */
    } finally {
      recordingRef.current.delete(id)
    }
  }, [enabled])

  const clearRecentHistory = useCallback(async () => {
    setRecent([])
    try {
      const res = await apiClearRecent()
      if (!mountedRef.current) return
      if (Array.isArray(res?.recent)) setRecent(res.recent)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.response?.data?.message || err.message || 'Failed to clear recent')
      refresh()
    }
  }, [refresh])

  return {
    favorites,
    recent,
    loading,
    error,
    isFavorite,
    toggleFavorite,
    reorderFavoriteIds,
    recordRecentVisit,
    clearRecentHistory,
    refresh,
  }
}
