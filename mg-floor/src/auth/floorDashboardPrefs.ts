import AsyncStorage from '@react-native-async-storage/async-storage'

const MANAGER_CACHE_KEY = 'mg_floor_department_managers_v2'

export type AssignedManager = {
  id: string
  name: string
}

/**
 * Last assigned managers fetched from the server, by department, so Call F.M still shows the
 * name when the tablet starts offline. The server is the source of truth.
 */
export async function getCachedManagers(): Promise<Record<string, AssignedManager>> {
  try {
    const raw = await AsyncStorage.getItem(MANAGER_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function cacheManagers(managers: Record<string, AssignedManager>): Promise<void> {
  const slim = Object.fromEntries(Object.entries(managers).map(([dept, m]) => [dept, { id: m.id, name: m.name }]))
  await AsyncStorage.setItem(MANAGER_CACHE_KEY, JSON.stringify(slim)).catch(() => {})
}
