import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { normalizeTenantKey, TENANT_KEYS } from '@/src/config/tenantBranding'

export const COMPANY_CODE_STORAGE_KEY = 'nexa_company_code'

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.loopcstrategies.com'

const buildDefaultTenant = () =>
  normalizeTenantKey((Constants.expoConfig?.extra?.tenant as string) || '') || 'mg'

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

/** @deprecated Use getTenant() — build-time default only */
export const TENANT = buildDefaultTenant()

export async function loadStoredCompanyCode(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(COMPANY_CODE_STORAGE_KEY)
  const normalized = normalizeTenantKey(stored)
  if (normalized) {
    activeTenant = normalized
    return normalized
  }
  return null
}

export async function persistCompanyCode(tenant: string): Promise<string> {
  const normalized = setTenant(tenant)
  await SecureStore.setItemAsync(COMPANY_CODE_STORAGE_KEY, normalized)
  return normalized
}

export async function clearStoredCompanyCode(): Promise<void> {
  await SecureStore.deleteItemAsync(COMPANY_CODE_STORAGE_KEY)
}

export { normalizeTenantKey, TENANT_KEYS }
