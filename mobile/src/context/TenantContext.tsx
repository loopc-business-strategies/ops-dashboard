import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getTenantBranding, type MobileTenantBranding } from '@/src/config/tenantBranding'
import {
  bootstrapTenantFromStorage,
  getTenant,
  normalizeTenantKey,
  persistCompanyCode,
  setTenant,
} from '@/src/config/tenant'

type TenantContextValue = {
  companyCode: string
  branding: MobileTenantBranding
  isReady: boolean
  applyCompanyCode: (code: string) => Promise<string>
  syncTenantFromSession: (company: string) => Promise<string>
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [companyCode, setCompanyCode] = useState(() => getTenant())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void bootstrapTenantFromStorage()
      .then((tenant) => setCompanyCode(tenant))
      .finally(() => setIsReady(true))
  }, [])

  const applyCompanyCode = useCallback(async (code: string) => {
    const normalized = normalizeTenantKey(code)
    if (!normalized) {
      throw new Error('Invalid company code')
    }
    setTenant(normalized)
    await persistCompanyCode(normalized)
    setCompanyCode(normalized)
    return normalized
  }, [])

  const syncTenantFromSession = useCallback(async (company: string) => {
    const normalized = normalizeTenantKey(company)
    if (!normalized) return getTenant()
    setTenant(normalized)
    await persistCompanyCode(normalized)
    setCompanyCode(normalized)
    return normalized
  }, [])

  const branding = useMemo(() => getTenantBranding(companyCode), [companyCode])

  const value = useMemo(
    () => ({
      companyCode,
      branding,
      isReady,
      applyCompanyCode,
      syncTenantFromSession,
    }),
    [companyCode, branding, isReady, applyCompanyCode, syncTenantFromSession],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantBranding() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenantBranding must be used within TenantProvider')
  return ctx
}
