import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const DEVICE_ID_KEY = 'mg_floor_device_id_v1'

let cached: string | null = null
let pending: Promise<string> | null = null

function generateDeviceId() {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase()
  return `MG-FLOOR-${Platform.OS.toUpperCase()}-${rand}`
}

async function readStored(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(DEVICE_ID_KEY)
    if (secure) return secure
  } catch {
    // SecureStore unavailable (web) — fall back to AsyncStorage
  }
  try {
    return await AsyncStorage.getItem(DEVICE_ID_KEY)
  } catch {
    return null
  }
}

async function writeStored(id: string) {
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id)
  } catch {
    // optional on web
  }
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, id)
  } catch {
    // in-memory cache still identifies this process
  }
}

/**
 * Stable identity for this MG Floor tablet — generated once, kept across logins and app restarts.
 * Uninstalling the app resets it; supervisors see it in audit records and the Devices screen.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  if (!pending) {
    pending = (async () => {
      const stored = await readStored()
      const id = stored || generateDeviceId()
      if (!stored) await writeStored(id)
      cached = id
      return id
    })().finally(() => {
      pending = null
    })
  }
  return pending
}

/** Synchronous read after first resolve; empty string until then. */
export function getCachedDeviceId(): string {
  return cached || ''
}
