import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const DEPT_KEY = 'mg_factory_selected_department'
const BIO_USER_KEY = 'mg_factory_bio_username'
const BIO_PASS_KEY = 'mg_factory_bio_password'
const BIO_ENABLED_KEY = 'mg_factory_bio_enabled'

export async function getSelectedDepartment(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEPT_KEY)
  } catch {
    return null
  }
}

export async function setSelectedDepartment(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEPT_KEY, key)
  } catch {
    // ignore
  }
}

export async function clearSelectedDepartment(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEPT_KEY)
  } catch {
    // ignore
  }
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
