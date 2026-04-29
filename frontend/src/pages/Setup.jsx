// FILE: src/pages/Setup.jsx
// WHAT THIS IS:
//   One-time page to create the very first Super Admin.
//   Only works when the database has ZERO users.
//   After first use, backend permanently blocks this route.
//   Visit: http://localhost:5173/setup

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authAPI from '../api/auth'
import { useAuth } from '../context/AuthContext'

function Setup() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [company,  setCompany]  = useState('loopc')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim())           return setError('Username is required.')
    if (password.length < 6)   return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      await authAPI.setup(name.trim(), password, company)
      // Auto-login after setup
      await login(name.trim(), password, company)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-700/20 border-2 border-emerald-600/50 mb-4">
            <span className="text-2xl">⚙️</span>
          </div>
          <h1 className="text-xl font-bold text-white">First Time Setup</h1>
          <p className="text-gray-500 text-sm mt-1">Create your Super Admin account</p>
        </div>

        <div className="bg-emerald-700/10 border border-emerald-600/30 rounded-xl p-4 mb-6">
          <p className="text-violet-300 text-xs text-center">
            This page only works once — when no users exist yet.
            After this, only Super Admin can create new users.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Company</label>
              <select value={company} onChange={e => setCompany(e.target.value)} className="input-field">
                <option value="mg">MG</option>
                <option value="cg">CG</option>
                <option value="loopc">LoopC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Username</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Choose a username" className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters" className="input-field" />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Super Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Setup
