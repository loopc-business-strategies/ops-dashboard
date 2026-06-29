import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { normalizeTenantKey, TENANT_KEYS } from '@/src/config/tenantBranding'

export const COMPANY_CODE_STORAGE_KEY = 'nexa_company_code'
export const SESSION_TOKEN_KEY = 'nexa_session_token'
export const LEGACY_SESSION_TOKEN_KEY = 'mg_ops_session_token'

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.loopcstrategies.com'

const buildDefaultTenant = () =>
  normalizeTenantKey((Constants.expoConfig?.extra?.tenant as string) || '') || 'loopc'

let activeTenant = buildDefaultTenant()

export function getTenant(): string {
  return activeTenant
}

export function setTenant(tenant: string): string {
  const normalized = normalizeTenantKey(tenant)
  if (!normalized) {
    throw new Error(`Invalid company code. Use one of: ${TENANT_KEYS.join(', ')}`)
  }
  activeTenant = normalized
  return activeTenant
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  if (typeof atob === 'function') {
    return atob(padded)
  }
  return Buffer.from(padded, 'base64').toString('utf8')
}

/** Read tenant from JWT payload without verifying signature (client hint only). */
export function decodeTenantFromJwt(token: string | null | undefined): string | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { company?: unknown }
    return normalizeTenantKey(typeof payload.company === 'string' ? payload.company : '')
  } catch {
    return null
  }
}

export async function loadStoredCompanyCode(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(COMPANY_CODE_STORAGE_KEY)
  const normalized = normalizeTenantKey(stored)
  if (normalized) {
    activeTenant = normalized
    return normalized
  }
  return null
}

export async function readSessionTokenFromSecureStore(): Promise<string | null> {
  const current = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
  if (current) return current
  const legacy = await SecureStore.getItemAsync(LEGACY_SESSION_TOKEN_KEY)
  if (!legacy) return null
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, legacy)
  await SecureStore.deleteItemAsync(LEGACY_SESSION_TOKEN_KEY)
  return legacy
}

export async function writeSessionTokenToSecureStore(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
    await SecureStore.deleteItemAsync(LEGACY_SESSION_TOKEN_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
  await SecureStore.deleteItemAsync(LEGACY_SESSION_TOKEN_KEY)
}

/** Prefer JWT company, then stored company code, then build default. */
export async function bootstrapTenantFromStorage(sessionToken?: string | null): Promise<string> {
  const token =
    sessionToken !== undefined
      ? sessionToken
      : await readSessionTokenFromSecureStore()

  const fromJwt = decodeTenantFromJwt(token)
  if (fromJwt) {
    activeTenant = fromJwt
    return fromJwt
  }

  const stored = await SecureStore.getItemAsync(COMPANY_CODE_STORAGE_KEY)
  const fromStore = normalizeTenantKey(stored)
  if (fromStore) {
    activeTenant = fromStore
    return fromStore
  }

  activeTenant = buildDefaultTenant()
  return activeTenant
}

export async function persistCompanyCode(tenant: string): Promise<string> {
  const normalized = setTenant(tenant)
  await SecureStore.setItemAsync(COMPANY_CODE_STORAGE_KEY, normalized)
  return normalized
}

export async function clearStoredCompanyCode(): Promise<void> {
  await SecureStore.deleteItemAsync(COMPANY_CODE_STORAGE_KEY)
}

/** Sync active tenant from JWT company claim (no signature verify). */
export function syncTenantFromJwt(token: string | null | undefined): string | null {
  const fromJwt = decodeTenantFromJwt(token)
  if (fromJwt) {
    activeTenant = fromJwt
    return fromJwt
  }
  return null
}

/** Clear persisted company code and reset to build default (logout). */
export async function resetTenantSession(): Promise<string> {
  await clearStoredCompanyCode()
  activeTenant = buildDefaultTenant()
  return activeTenant
}

export { normalizeTenantKey, TENANT_KEYS }
