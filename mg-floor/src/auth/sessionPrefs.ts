import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const DEPT_KEY = 'mg_factory_selected_department'
const BIO_USER_KEY = 'mg_factory_bio_username'
const BIO_PASS_KEY = 'mg_factory_bio_password'
const BIO_ENABLED_KEY = 'mg_factory_bio_enabled'
const SESSION_EXPIRED_KEY = 'mg_floor_session_expired_notice'
const SESSION_LOGIN_AT_KEY = 'mg_floor_session_login_at'

/** In-memory cache so CONTINUE works even if SecureStore fails (e.g. web). */
const memory: Record<string, string | null> = {}

async function getPref(key: string): Promise<string | null> {
  if (memory[key] != null) return memory[key]
  try {
    const fromAsync = await AsyncStorage.getItem(key)
    if (fromAsync != null) {
      memory[key] = fromAsync
      return fromAsync
    }
  } catch {
    // fall through
  }
  try {
    const fromSecure = await SecureStore.getItemAsync(key)
    if (fromSecure != null) {
      memory[key] = fromSecure
      try {
        await AsyncStorage.setItem(key, fromSecure)
      } catch {
        // ignore migrate failure
      }
      return fromSecure
    }
  } catch {
    // ignore
  }
  return memory[key] ?? null
}

async function setPref(key: string, value: string): Promise<void> {
  memory[key] = value
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    // memory already set — enough for this session
  }
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    // optional on web / unsupported platforms
  }
}

async function clearPref(key: string): Promise<void> {
  memory[key] = null
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // ignore
  }
}

export async function getSelectedDepartment(): Promise<string | null> {
  return getPref(DEPT_KEY)
}

export async function setSelectedDepartment(key: string): Promise<void> {
  await setPref(DEPT_KEY, key)
}

export async function clearSelectedDepartment(): Promise<void> {
  await clearPref(DEPT_KEY)
}

export async function markSessionExpiredNotice(): Promise<void> {
  await setPref(SESSION_EXPIRED_KEY, '1')
}

/** Returns true once if a session-expired notice was queued, then clears it. */
export async function consumeSessionExpiredNotice(): Promise<boolean> {
  const v = await getPref(SESSION_EXPIRED_KEY)
  if (v !== '1') return false
  await clearPref(SESSION_EXPIRED_KEY)
  return true
}

export async function setSessionLoginAt(iso: string): Promise<void> {
  await setPref(SESSION_LOGIN_AT_KEY, iso)
}

export async function getSessionLoginAt(): Promise<string | null> {
  return getPref(SESSION_LOGIN_AT_KEY)
}

export async function clearSessionLoginAt(): Promise<void> {
  await clearPref(SESSION_LOGIN_AT_KEY)
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return Boolean(hasHardware && enrolled)
  } catch {
    return false
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(BIO_ENABLED_KEY)
    return v === '1'
  } catch {
    return false
  }
}

export async function enrollBiometricCredentials(username: string, password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIO_USER_KEY, username)
    await SecureStore.setItemAsync(BIO_PASS_KEY, password)
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, '1')
  } catch {
    // Device storage unavailable — biometric enroll skipped
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIO_USER_KEY)
    await SecureStore.deleteItemAsync(BIO_PASS_KEY)
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY)
  } catch {
    // ignore
  }
}

export async function authenticateWithBiometric(): Promise<{ username: string; password: string } | null> {
  const enabled = await isBiometricEnabled()
  if (!enabled) return null
  const available = await biometricAvailable()
  if (!available) return null
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to MG Floor',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    })
    if (!result.success) return null
    const username = await SecureStore.getItemAsync(BIO_USER_KEY)
    const password = await SecureStore.getItemAsync(BIO_PASS_KEY)
    if (!username || !password) return null
    return { username, password }
  } catch {
    return null
  }
}
