import { AppState, type AppStateStatus, Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import * as authApi from '@/src/api/auth'
import { EAS_PROJECT_ID } from '@/src/config/easProject'

const STORED_PUSH_TOKEN_KEY = 'nexa_expo_push_token'
const LEGACY_PUSH_TOKEN_KEY = 'mg_ops_expo_push_token'

async function readStoredPushTokenKey(): Promise<string | null> {
  const current = await SecureStore.getItemAsync(STORED_PUSH_TOKEN_KEY)
  if (current) return String(current).trim() || null
  const legacy = await SecureStore.getItemAsync(LEGACY_PUSH_TOKEN_KEY)
  if (!legacy) return null
  const trimmed = String(legacy).trim()
  if (!trimmed) return null
  await SecureStore.setItemAsync(STORED_PUSH_TOKEN_KEY, trimmed)
  await SecureStore.deleteItemAsync(LEGACY_PUSH_TOKEN_KEY)
  return trimmed
}

async function writeStoredPushTokenKey(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(STORED_PUSH_TOKEN_KEY, token)
    await SecureStore.deleteItemAsync(LEGACY_PUSH_TOKEN_KEY)
    return
  }
  await SecureStore.deleteItemAsync(STORED_PUSH_TOKEN_KEY)
  await SecureStore.deleteItemAsync(LEGACY_PUSH_TOKEN_KEY)
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

let lastExpoPushToken: string | null = null

export function getLastRegisteredExpoPushToken() {
  return lastExpoPushToken
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (Platform.OS === 'web') return Notifications.PermissionStatus.UNDETERMINED
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

async function resolveStoredPushToken() {
  if (lastExpoPushToken) return lastExpoPushToken
  try {
    const stored = await readStoredPushTokenKey()
    return stored ? String(stored).trim() : null
  } catch {
    return null
  }
}

/**
 * Request notification permission, obtain Expo push token, POST to API.
 * No-op on web. Safe to call repeatedly (dedupes same token server-side).
 */
export async function registerExpoPushAndPost(sessionToken: string): Promise<boolean> {
  if (Platform.OS === 'web') return false

  const { status: existing } = await Notifications.getPermissionsAsync()
  let final = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    final = status
  }
  if (final !== 'granted') return false

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#374151',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    })
  }

  const projectId =
    Constants.easConfig?.projectId
    || (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    || EAS_PROJECT_ID
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: String(projectId) })
  const expoToken = String(tokenResponse.data || '').trim()
  if (!expoToken) return false

  await authApi.registerPushToken(sessionToken, expoToken)
  lastExpoPushToken = expoToken
  await writeStoredPushTokenKey(expoToken)
  return true
}

export async function unregisterExpoPushFromBackend(sessionToken: string | null): Promise<void> {
  const token = await resolveStoredPushToken()
  if (!sessionToken || !token) return
  try {
    await authApi.deletePushToken(sessionToken, token)
  } catch {
    // best-effort
  } finally {
    lastExpoPushToken = null
    try {
    await writeStoredPushTokenKey(null)
    } catch {
      // ignore
    }
  }
}

/** Re-register when app returns to foreground (permission granted later, token rotation, network blip). */
export function attachExpoPushReregistration(sessionToken: string | null) {
  if (!sessionToken || Platform.OS === 'web') return () => undefined
  const onChange = (state: AppStateStatus) => {
    if (state !== 'active') return
    void registerExpoPushAndPost(sessionToken).catch((err) => {
      console.warn('[expo-push] re-register failed:', err instanceof Error ? err.message : err)
    })
  }
  const sub = AppState.addEventListener('change', onChange)
  return () => sub.remove()
}
