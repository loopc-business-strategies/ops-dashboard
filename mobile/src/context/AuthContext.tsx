import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { setAuthToken } from '@/src/api/client'
import * as authApi from '@/src/api/auth'
import type { AuthUser } from '@/src/api/auth'
import { registerExpoPushAndPost, unregisterExpoPushFromBackend, attachExpoPushReregistration } from '@/src/services/expoPushRegistration'

const TOKEN_KEY = 'mg_ops_session_token'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (name: string, password: string, companyCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const applySession = useCallback(async (nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken)
    setUser(nextUser)
    setAuthToken(nextToken)
    if (nextToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken)
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY)
    if (!stored) {
      await applySession(null, null)
      return
    }
    setAuthToken(stored)
    const me = await authApi.fetchMe(stored)
    await applySession(stored, me.user)
  }, [applySession])

  useEffect(() => {
    refreshUser()
      .catch(() => applySession(null, null))
      .finally(() => setIsLoading(false))
  }, [applySession, refreshUser])

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
    const data = await authApi.login(name.trim(), password, companyCode.trim().toLowerCase())
    if (!data.token) {
      throw new Error('Mobile login requires API token. Deploy backend auth update or use X-Client: mobile.')
    }
    await applySession(data.token, data.user)
  }, [applySession])

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
  }, [applySession, token])

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
