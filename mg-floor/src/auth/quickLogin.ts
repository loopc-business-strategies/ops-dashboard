import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import {
  authenticateWithBiometric,
  biometricAvailable,
  clearBiometricCredentials,
  isBiometricEnabled,
} from '@/src/auth/sessionPrefs'

const INDEX_KEY = 'mg_floor_quick_ids'
const credKey = (id: string) => `mg_floor_quick_${id}`
const LEGACY_USER_KEY = 'mg_factory_bio_username'
export const LEGACY_QUICK_ID = 'legacy'

export type QuickLoginEntry = { id: string; name: string; employeeCode?: string }

/** What a fingerprint / Face ID unlock replays: the same login the employee did when turning it on. */
export type QuickLoginCredential = { kind: 'password'; name: string; password: string }

async function readIndex(): Promise<QuickLoginEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string') : []
  } catch {
    return []
  }
}

async function writeIndex(list: QuickLoginEntry[]) {
  try {
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(list))
  } catch {
    // Device storage unavailable — quick login not saved
  }
}

async function readCredential(id: string): Promise<QuickLoginCredential | null> {
  try {
    const raw = await SecureStore.getItemAsync(credKey(id))
    const cred = raw ? JSON.parse(raw) : null
    return cred?.kind === 'password' && typeof cred.name === 'string' && typeof cred.password === 'string' ? cred : null
  } catch {
    return null
  }
}

/** Saved logins that can still be replayed; PIN logins saved by older builds are deleted (PIN login was retired). */
async function readUsableIndex(): Promise<QuickLoginEntry[]> {
  const list = await readIndex()
  const creds = await Promise.all(list.map((e) => readCredential(e.id)))
  const usable = list.filter((_, i) => creds[i])
  if (usable.length !== list.length) {
    await Promise.all(list.filter((_, i) => !creds[i]).map((e) => SecureStore.deleteItemAsync(credKey(e.id)).catch(() => {})))
    await writeIndex(usable)
  }
  return usable
}

/** Employees who turned on fingerprint / Face ID on this tablet (plus the single account saved by older builds). */
export async function listQuickLogins(): Promise<QuickLoginEntry[]> {
  if (!(await biometricAvailable())) return []
  const list = await readUsableIndex()
  if (await isBiometricEnabled()) {
    try {
      const legacyName = await SecureStore.getItemAsync(LEGACY_USER_KEY)
      if (legacyName && !list.some((e) => e.name.toLowerCase() === legacyName.toLowerCase())) {
        list.push({ id: LEGACY_QUICK_ID, name: legacyName })
      }
    } catch {
      // ignore
    }
  }
  return list
}

export async function hasQuickLogin(userId: string): Promise<boolean> {
  return (await readUsableIndex()).some((e) => e.id === userId)
}

export async function saveQuickLogin(entry: QuickLoginEntry, cred: QuickLoginCredential): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(credKey(entry.id), JSON.stringify(cred))
  } catch {
    return false
  }
  const list = (await readIndex()).filter((e) => e.id !== entry.id)
  await writeIndex([...list, entry])
  return true
}

export async function removeQuickLogin(userId: string): Promise<void> {
  if (userId === LEGACY_QUICK_ID) {
    await clearBiometricCredentials()
    return
  }
  try {
    await SecureStore.deleteItemAsync(credKey(userId))
  } catch {
    // ignore
  }
  await writeIndex((await readIndex()).filter((e) => e.id !== userId))
}

/** Asks for fingerprint / Face ID, then returns the saved login for that employee (null when cancelled). */
export async function unlockQuickLogin(entry: QuickLoginEntry): Promise<QuickLoginCredential | null> {
  if (entry.id === LEGACY_QUICK_ID) {
    const creds = await authenticateWithBiometric()
    return creds ? { kind: 'password', name: creds.username, password: creds.password } : null
  }
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Log in as ${entry.name}`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    })
    if (!result.success) return null
    return await readCredential(entry.id)
  } catch {
    return null
  }
}
