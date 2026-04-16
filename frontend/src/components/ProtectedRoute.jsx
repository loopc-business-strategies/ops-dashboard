// FILE: src/components/ProtectedRoute.jsx
// WHAT THIS DOES:
//   Wraps any page that requires login.
//   If not logged in → redirects to /login
//   If wrong role → shows Access Denied screen

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, isLoading } = useAuth()

  // Show spinner while checking saved session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → go to login page
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Wrong role → access denied
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-xl font-bold text-red-400 mb-2">Access Denied</p>
          <p className="text-gray-400 mb-6">Your role cannot access this page.</p>
          <a href="/dashboard" className="text-violet-400 hover:text-violet-300">← Back to dashboard</a>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
