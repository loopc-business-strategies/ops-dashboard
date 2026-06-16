import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as authApi from '@/src/api/auth'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

let lastExpoPushToken: string | null = null

export function getLastRegisteredExpoPushToken() {
  return lastExpoPushToken
}

/**
 * Request notification permission, obtain Expo push token, POST to API.
 * No-op on web. Safe to call repeatedly (dedupes same token server-side).
 */
export async function registerExpoPushAndPost(sessionToken: string): Promise<void> {
  if (Platform.OS === 'web') return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let final = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    final = status
  }
  if (final !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#005B96',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    })
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId: String(projectId) } : undefined,
  )
  const expoToken = tokenResponse.data
  if (!expoToken) return

  await authApi.registerPushToken(sessionToken, expoToken)
  lastExpoPushToken = expoToken
}

export async function unregisterExpoPushFromBackend(sessionToken: string | null): Promise<void> {
  if (!sessionToken || !lastExpoPushToken) return
  try {
    await authApi.deletePushToken(sessionToken, lastExpoPushToken)
  } catch {
    // best-effort
  } finally {
    lastExpoPushToken = null
  }
}
