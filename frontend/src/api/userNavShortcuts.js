import axios, { apiUrl } from './client'

const cfg = () => ({ withCredentials: true })

export async function getFavorites() {
  const res = await axios.get(apiUrl('/api/auth/me/favorites'), cfg())
  return res.data
}

export async function addFavorite(navItemId) {
  const res = await axios.post(apiUrl('/api/auth/me/favorites'), { navItemId }, cfg())
  return res.data
}

export async function removeFavorite(navItemId) {
  const res = await axios.delete(apiUrl(`/api/auth/me/favorites/${encodeURIComponent(navItemId)}`), cfg())
  return res.data
}

export async function reorderFavorites(navItemIds) {
  const res = await axios.put(apiUrl('/api/auth/me/favorites/order'), { navItemIds }, cfg())
  return res.data
}

export async function getRecent() {
  const res = await axios.get(apiUrl('/api/auth/me/recent'), cfg())
  return res.data
}

export async function recordRecent(navItemId) {
  const res = await axios.post(apiUrl('/api/auth/me/recent'), { navItemId }, cfg())
  return res.data
}

export async function clearRecent() {
  const res = await axios.delete(apiUrl('/api/auth/me/recent'), cfg())
  return res.data
}
