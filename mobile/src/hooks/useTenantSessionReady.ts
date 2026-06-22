import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'

/** Tenant storage loaded and JWT company matches active x-tenant header. */
export function useTenantSessionReady(): boolean {
  const { isReady, companyCode } = useTenantBranding()
  const { token, user } = useAuth()
  if (!isReady) return false
  if (!token) return false
  const sessionCompany = normalizeSessionCompany(user?.company)
  return sessionCompany === companyCode
}

function normalizeSessionCompany(company: string | undefined): string {
  return String(company || '')
    .trim()
    .toLowerCase()
}
