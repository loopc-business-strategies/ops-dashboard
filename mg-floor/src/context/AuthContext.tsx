import * as SecureStore from 'expo-secure-store'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, login as apiLogin } from '@/src/api/auth'
import { setAuthToken, setUnauthorizedHandler } from '@/src/api/client'
import { registerDevice } from '@/src/api/floor'
import { Platform } from 'react-native'

const TOKEN_KEY = 'mg_floor_session_token'

type FloorUser = {
  id: string
  name: string
  role: string
  department?: string
  productionRole?: string | null
}

type AuthState = {
  loading: boolean
  token: string | null
  user: FloorUser | null
  shift: unknown
  permissions: Record<string, boolean>
  login: (name: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function readStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

async function writeStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  } catch {
    // Device storage unavailable — keep session in memory only for this process.
  }
}

async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<FloorUser | null>(null)
  const [shift, setShift] = useState<unknown>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})

  const logout = useCallback(async () => {
    setAuthToken(null)
    setToken(null)
    setUser(null)
    setShift(null)
    setPermissions({})
    await clearStoredToken()
  }, [])

  const hydrateFromMe = useCallback(async (tok: string) => {
    setAuthToken(tok)
    const me = await fetchMe(tok)
    if (String(me.tenant || '').toLowerCase() !== 'mg') {
      throw new Error('Session is not MG')
    }
    setToken(tok)
    setUser({
      id: String(me.user.id),
      name: me.user.name,
      role: me.user.role,
      department: me.user.department,
      productionRole: me.productionRole,
    })
    setShift(me.shift)
    setPermissions(me.permissions || {})
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    await hydrateFromMe(token)
  }, [hydrateFromMe, token])

  const login = useCallback(async (name: string, password: string) => {
    const data = await apiLogin(name, password)
    if (!data.token) throw new Error('Login failed — no token')
    await writeStoredToken(data.token)
    await hydrateFromMe(data.token)
    try {
      await registerDevice({
        deviceId: `mg-floor-${Platform.OS}-${Date.now()}`,
        appVersion: '1.0.0',
        os: Platform.OS,
        model: Platform.OS,
        department: data.user?.department || '',
      })
    } catch {
      // non-blocking
    }
  }, [hydrateFromMe])

  useEffect(() => {
    let cancelled = false
    setUnauthorizedHandler(() => {
      logout()
    })
    ;(async () => {
      try {
        const stored = await readStoredToken()
        if (cancelled) return
        if (stored) {
          try {
            await hydrateFromMe(stored)
          } catch {
            await logout()
          }
        }
      } catch {
        if (!cancelled) await logout()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setUnauthorizedHandler(null)
    }
  }, [hydrateFromMe, logout])

  const value = useMemo(
    () => ({ loading, token, user, shift, permissions, login, logout, refresh }),
    [loading, token, user, shift, permissions, login, logout, refresh],
  )

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
