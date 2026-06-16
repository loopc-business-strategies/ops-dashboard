// FILE: src/context/AuthContext.jsx
// WHAT THIS DOES:
//   Stores the logged-in user and token globally.
//   Any component in the app can read: user, token, isAuthenticated
//   Any component can call: login(), logout()
//   This avoids passing user data as props through every component.

import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from '../api/client'
import authAPI from '../api/auth'
import { resolveTenantFromHostname, resolveTenantFromSearch } from '../config/tenantBranding'
import { ensureWebPushSubscription, teardownWebPush } from '../utils/webPushRegister'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const hostTenant = resolveTenantFromHostname(window.location.hostname, localStorage.getItem('tenantCompany') || 'loopc')
  const resolvedTenant = resolveTenantFromSearch(window.location.search, hostTenant)

  const [user,      setUser]      = useState(null)
  const [token,     setToken]     = useState(null)
  const [company,   setCompany]   = useState(resolvedTenant)
  const [isLoading, setIsLoading] = useState(true) // checking saved session

  // Always tell the backend which tenant this frontend belongs to
  axios.defaults.headers.common['x-tenant'] = resolvedTenant
  axios.defaults.headers.common['x-company'] = resolvedTenant

  useEffect(() => {
    const hasResponseInterceptor = Boolean(axios?.interceptors?.response?.use)
    if (!hasResponseInterceptor) return undefined

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status
        const requestUrl = String(error?.config?.url || '')
        const isSessionProbe = /\/api\/auth\/me\b/i.test(requestUrl)

        if (status === 401 && isSessionProbe) {
          setUser(null)
          setToken(null)
          setCompany(resolvedTenant)
          if (window.location.pathname !== '/login') {
            window.location.replace('/login')
          }
        }

        return Promise.reject(error)
      }
    )

    return () => {
      if (axios?.interceptors?.response?.eject) {
        axios.interceptors.response.eject(interceptorId)
      }
    }
  }, [resolvedTenant])

  // On app load: restore session from server cookie
  useEffect(() => {
    let mounted = true
    const currentPath = String(window.location.pathname || '').toLowerCase()
    const shouldSkipSessionRestore = currentPath === '/login' || currentPath === '/setup'

    if (shouldSkipSessionRestore) {
      setIsLoading(false)
      return () => {
        mounted = false
      }
    }

    const restoreSession = async () => {
      try {
        const data = await authAPI.getMe()
        if (!mounted) return
        const nextTenant = resolveTenantFromSearch(
          window.location.search,
          resolveTenantFromHostname(window.location.hostname, data.user?.company || resolvedTenant)
        )
        setUser(data.user)
        setCompany(nextTenant)
        localStorage.setItem('tenantCompany', nextTenant)
        axios.defaults.headers.common['x-tenant'] = nextTenant
        axios.defaults.headers.common['x-company'] = nextTenant
        // Restore CSRF token for cross-domain use
        if (data.csrfToken) {
          axios.defaults.headers.common['x-csrf-token'] = data.csrfToken
        }
        // Keep compatibility for existing token checks in tabs.
        setToken('cookie-session')
      } catch {
        if (!mounted) return
        setUser(null)
        setToken(null)
        setCompany(resolvedTenant)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    restoreSession()

    return () => {
      mounted = false
    }
  }, [resolvedTenant])

  useEffect(() => {
    if (!user?.id) return undefined
    void ensureWebPushSubscription()
    return undefined
  }, [user?.id])

  const login = async (name, password, selectedCompany) => {
    const tenant = resolveTenantFromSearch(
      window.location.search,
      resolveTenantFromHostname(window.location.hostname, selectedCompany || company || resolvedTenant)
    )
    const data = await authAPI.login(name, password, tenant)
    const nextTenant = resolveTenantFromSearch(
      window.location.search,
      resolveTenantFromHostname(window.location.hostname, data.user?.company || tenant)
    )
    setUser(data.user)
    setCompany(nextTenant)
    localStorage.setItem('tenantCompany', nextTenant)
    axios.defaults.headers.common['x-tenant'] = nextTenant
    axios.defaults.headers.common['x-company'] = nextTenant
    // Store CSRF token from auth response for cross-domain use
    if (data.csrfToken) {
      axios.defaults.headers.common['x-csrf-token'] = data.csrfToken
    }
    setToken('cookie-session')
    return data
  }

  const logout = async () => {
    await teardownWebPush()
    try {
      await authAPI.logout()
    } catch {
      // Clear client state even if server session is already invalid.
    }
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['x-tenant']
    delete axios.defaults.headers.common['x-company']
  }

  return (
    <AuthContext.Provider value={{
      user, token, company, isLoading,
      isAuthenticated: !!user,
      setCompany,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — use this in any component:
// const { user, login, logout } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
