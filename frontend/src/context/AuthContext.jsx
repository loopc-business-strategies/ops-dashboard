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

  // On app load: restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser  = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (name, password) => {
    const data = await authAPI.login(name, password)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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
