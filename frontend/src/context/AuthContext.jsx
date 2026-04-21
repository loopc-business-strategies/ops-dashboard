// FILE: src/context/AuthContext.jsx
// WHAT THIS DOES:
//   Stores the logged-in user and token globally.
//   Any component in the app can read: user, token, isAuthenticated
//   Any component can call: login(), logout()
//   This avoids passing user data as props through every component.

import { createContext, useContext, useState, useEffect } from 'react'
import authAPI from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [token,     setToken]     = useState(null)
  const [isLoading, setIsLoading] = useState(true) // checking saved session

  // On app load: restore session from server cookie
  useEffect(() => {
    let mounted = true

    const restoreSession = async () => {
      try {
        const data = await authAPI.getMe()
        if (!mounted) return
        setUser(data.user)
        // Keep compatibility for existing token checks in tabs.
        setToken('cookie-session')
      } catch {
        if (!mounted) return
        setUser(null)
        setToken(null)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    restoreSession()

    return () => {
      mounted = false
    }
  }, [])

  const login = async (name, password) => {
    const data = await authAPI.login(name, password)
    setUser(data.user)
    setToken('cookie-session')
    return data
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // Clear client state even if server session is already invalid.
    }
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!user,
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
