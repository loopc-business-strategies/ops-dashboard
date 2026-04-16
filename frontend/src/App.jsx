// FILE: src/App.jsx
// WHAT THIS DOES:
//   Sets up all the pages and their URLs.
//   /login   → Login page
//   /setup   → First-time admin setup (one-time only)
//   /dashboard → Main dashboard (requires login)
//   /        → Redirects to /dashboard

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute  from './components/ProtectedRoute'
import Login           from './pages/Login'
import Setup           from './pages/Setup'
import Dashboard       from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />

          {/* Protected — requires login */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Root → go to dashboard (which redirects to login if not logged in) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-4">
              <div>
                <p className="text-6xl font-bold text-gray-800 mb-3">404</p>
                <p className="text-gray-400 mb-5">Page not found</p>
                <a href="/dashboard" className="text-violet-400 hover:text-violet-300 text-sm">← Back to dashboard</a>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
