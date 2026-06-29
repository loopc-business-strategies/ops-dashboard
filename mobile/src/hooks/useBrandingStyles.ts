import { useMemo } from 'react'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import { useTenant } from '@/src/context/TenantContext'

/** Memoized StyleSheet (or style object) from active tenant branding. */
export function useBrandingStyles<T>(create: (branding: MobileTenantBranding) => T): T {
  const { branding } = useTenant()
  return useMemo(() => create(branding), [branding])
}
