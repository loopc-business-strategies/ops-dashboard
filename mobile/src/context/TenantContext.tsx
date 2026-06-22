import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getTenantBranding, type MobileTenantBranding } from '@/src/config/tenantBranding'
import {
  getTenant,
  loadStoredCompanyCode,
  normalizeTenantKey,
  persistCompanyCode,
  setTenant,
} from '@/src/config/tenant'

type TenantContextValue = {
  companyCode: string
  branding: MobileTenantBranding
  isReady: boolean
  applyCompanyCode: (code: string) => Promise<string>
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [companyCode, setCompanyCode] = useState(() => getTenant())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void loadStoredCompanyCode()
      .then((stored) => {
        if (stored) setCompanyCode(stored)
        else setCompanyCode(getTenant())
      })
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

  const branding = useMemo(() => getTenantBranding(companyCode), [companyCode])

  const value = useMemo(
    () => ({
      companyCode,
      branding,
      isReady,
      applyCompanyCode,
    }),
    [companyCode, branding, isReady, applyCompanyCode],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantBranding() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenantBranding must be used within TenantProvider')
  return ctx
}
