import { useAuth } from '@/src/context/AuthContext'

export function useTenantSessionKey(): string {
  const { tenantSessionKey } = useAuth()
  return tenantSessionKey
}
