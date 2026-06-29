import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setAuthToken } from '@/src/api/client'
import { registerUnauthorizedHandler } from '@/src/api/sessionEvents'
import * as authApi from '@/src/api/auth'
import type { AuthUser } from '@/src/api/auth'
import { readSessionTokenFromSecureStore, writeSessionTokenToSecureStore } from '@/src/config/tenant'
import { useTenant } from '@/src/context/TenantContext'
import { registerExpoPushAndPost, unregisterExpoPushFromBackend, attachExpoPushReregistration } from '@/src/services/expoPushRegistration'
import { buildTenantSessionKey } from '@/src/utils/tenantSessionKey'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  sessionEpoch: number
  tenantSessionKey: string
  login: (name: string, password: string, companyCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isReady, companyCode, syncTenantFromSession, resetForLogout } = useTenant()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionEpoch, setSessionEpoch] = useState(0)

  const applySession = useCallback(async (nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken)
    setUser(nextUser)
    setAuthToken(nextToken)
    await writeSessionTokenToSecureStore(nextToken)
  }, [])

  const refreshUser = useCallback(async () => {
    const stored = await readSessionTokenFromSecureStore()
    if (!stored) {
      await applySession(null, null)
      return
    }
    setAuthToken(stored)
    const me = await authApi.fetchMe(stored)
    if (me.user.company) {
      await syncTenantFromSession(me.user.company)
    }
    await applySession(stored, me.user)
  }, [applySession, syncTenantFromSession])

  useEffect(() => {
    if (!isReady) return
    refreshUser()
      .catch(() => applySession(null, null))
      .finally(() => setIsLoading(false))
  }, [applySession, isReady, refreshUser])

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    void (async () => {
      try {
        await registerExpoPushAndPost(token)
      } catch (err) {
        if (!cancelled) {
          console.warn('[expo-push] register failed:', err instanceof Error ? err.message : err)
        }
      }
    })()
    const stopReregistration = attachExpoPushReregistration(token)
    return () => {
      cancelled = true
      stopReregistration()
    }
  }, [token, user?.id])

  const login = useCallback(async (name: string, password: string, companyCode: string) => {
    const normalizedCode = companyCode.trim().toLowerCase()
    const data = await authApi.login(name.trim(), password, normalizedCode)
    if (!data.token) {
      throw new Error('Mobile login requires API token. Deploy backend auth update or use X-Client: mobile.')
    }
    const sessionCompany = String(data.user.company || normalizedCode).trim().toLowerCase()
    if (sessionCompany !== normalizedCode) {
      throw new Error('Session company does not match entered company code.')
    }
    await syncTenantFromSession(sessionCompany)
    await applySession(data.token, data.user)
    setSessionEpoch((epoch) => epoch + 1)
  }, [applySession, syncTenantFromSession])

  const logout = useCallback(async () => {
    try {
      if (token) await unregisterExpoPushFromBackend(token)
    } catch {
      // ignore
    }
    try {
      if (token) await authApi.logout(token)
    } catch {
      // Clear local session even if server logout fails.
    }
    await applySession(null, null)
    await resetForLogout()
    setSessionEpoch((epoch) => epoch + 1)
  }, [applySession, resetForLogout, token])

  useEffect(() => {
    registerUnauthorizedHandler(() => logout())
    return () => registerUnauthorizedHandler(null)
  }, [logout])

  const tenantSessionKey = useMemo(
    () => buildTenantSessionKey(token, user, companyCode, sessionEpoch),
    [token, user, companyCode, sessionEpoch],
  )

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      sessionEpoch,
      tenantSessionKey,
      login,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, sessionEpoch, tenantSessionKey, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
