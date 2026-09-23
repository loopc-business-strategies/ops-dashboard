import AsyncStorage from '@react-native-async-storage/async-storage'

const MANAGER_KEY = 'mg_floor_assigned_manager'
const ASSIGNED_METAL_KEY = 'mg_floor_assigned_metal_in'
const MANAGER_OPTIONS_KEY = 'mg_floor_manager_options'

export type AssignedManager = {
  id: string
  name: string
}

export type AssignedMetalLabels = {
  batch1: string
  batch2: string
}

const DEFAULT_MANAGERS: AssignedManager[] = [
  { id: 'fm-1', name: 'Floor Manager' },
  { id: 'fm-2', name: 'Production Manager' },
  { id: 'fm-3', name: 'Shift Supervisor' },
]

export async function getAssignedManager(): Promise<AssignedManager | null> {
  try {
    const raw = await AsyncStorage.getItem(MANAGER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AssignedManager
  } catch {
    return null
  }
}

export async function setAssignedManager(manager: AssignedManager): Promise<void> {
  await AsyncStorage.setItem(MANAGER_KEY, JSON.stringify(manager))
}

export async function clearAssignedManager(): Promise<void> {
  await AsyncStorage.removeItem(MANAGER_KEY)
}

export async function getManagerOptions(): Promise<AssignedManager[]> {
  try {
    const raw = await AsyncStorage.getItem(MANAGER_OPTIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AssignedManager[]
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {
    // fall through
  }
  return DEFAULT_MANAGERS
}

export async function addManagerOption(name: string): Promise<AssignedManager> {
  const trimmed = name.trim()
  const options = await getManagerOptions()
  const existing = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const next = { id: `fm-${Date.now()}`, name: trimmed }
  await AsyncStorage.setItem(MANAGER_OPTIONS_KEY, JSON.stringify([...options, next]))
  return next
}

export async function getAssignedMetalLabels(): Promise<AssignedMetalLabels> {
  try {
    const raw = await AsyncStorage.getItem(ASSIGNED_METAL_KEY)
    if (!raw) return { batch1: '', batch2: '' }
    return JSON.parse(raw) as AssignedMetalLabels
  } catch {
    return { batch1: '', batch2: '' }
  }
}

export async function setAssignedMetalLabels(labels: AssignedMetalLabels): Promise<void> {
  await AsyncStorage.setItem(ASSIGNED_METAL_KEY, JSON.stringify(labels))
}
