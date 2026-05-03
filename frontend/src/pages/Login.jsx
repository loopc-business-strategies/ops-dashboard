// FILE: src/pages/Login.jsx
// PAGE 1 — Login screen
// - Only username + password fields
// - Credentials box is orange-themed as requested
// - No sign up link anywhere
// - "Access by invitation only" message

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getTenantBranding, resolveTenantFromHostname } from '../config/tenantBranding'

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()

  const company = resolveTenantFromHostname(window.location.hostname, 'loopc')

  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const branding = getTenantBranding(company)

  // Apply tenant CSS vars on login page so btn-primary and focus styles use brand color
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--purple', branding.colors.brandPrimary)
    root.style.setProperty('--purple-light', branding.colors.brandSecondary)
    root.style.setProperty('--purple-rgb', hexToRgb(branding.colors.brandPrimary))
    root.style.setProperty('--grad-brand', `linear-gradient(135deg, ${branding.colors.brandPrimary}, ${branding.colors.brandSecondary})`)
    root.style.setProperty('--grad-bar', branding.colors.gradBar)
  }, [branding])

  const handleDemoLogin = async () => {
    const demoAccountsByTenant = {
      mg: { username: 'mgadmin', password: 'MgAdmin@2026!' },
      cg: { username: 'cgadmin', password: 'CgAdmin@2026!' },
      loopc: { username: 'loopcadmin', password: 'LoopcAdmin@2026!' },
    }

    const account = demoAccountsByTenant[company] || demoAccountsByTenant.loopc

    setLoading(true)
    setError('')
    try {
      await login(account.username, account.password, company)
      navigate('/dashboard')
    } catch (err) {
      if (!err.response) {
        setError(t('loginErrNetwork'))
      } else if (err.response.status >= 500) {
        setError(t('loginErrServer'))
      } else {
        setError(err.response?.data?.message || t('loginErrInvalid'))
      }
      console.error('Demo login failed', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!company || !name.trim() || !password) return setError(t('loginErrEmpty'))
    setLoading(true)
    setError('')
    try {
      await login(name.trim(), password, company)
      navigate('/dashboard')
    } catch (err) {
      if (!err.response) {
        setError(t('loginErrNetwork'))
      } else if (err.response.status >= 500) {
        setError(t('loginErrServer'))
      } else {
        setError(err.response?.data?.message || t('loginErrInvalid'))
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">

      {/* ── Top: Company logo placeholder ── */}
      <div className="mb-10 text-center">
        {/* Logo placeholder — replace with real logo later */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
          style={{ background: branding.colors.gradBar, border: '2px solid rgba(255,255,255,0.25)' }}>
          <span className="text-2xl font-extrabold text-white tracking-wide">{branding.logoText}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#1C2A33' }}>{branding.displayName} OPS</h1>
        <p className="text-gray-500 text-sm mt-1">{t('operationsControl')}</p>
      </div>

      {/* ── Orange credential box ── */}
      <div className="w-full max-w-sm">
        {/* Green header bar */}
        <div className="rounded-t-xl px-6 py-4" style={{ background: `linear-gradient(135deg, ${branding.colors.brandPrimary}, ${branding.colors.brandSecondary})` }}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1
                   1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="text-white font-semibold text-sm tracking-wide">{t('signIn')}</span>
          </div>
        </div>

        {/* Form body */}
        <div className="bg-gray-900 border border-gray-800 border-t-0 rounded-b-xl px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Company
              </label>
              <div className="input-field flex items-center justify-between">
                <span>{branding.displayName}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider">{window.location.hostname}</span>
              </div>
            </div>

            {/* Username field */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  {t('username')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                    placeholder={t('enterUsername')}
                  className="input-field"
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  {t('password')}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder={t('enterPassword')}
                  className="input-field pr-10"
                  autoComplete="current-password"
                  disabled={loading}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button type="submit" className="btn-primary" style={{ background: `linear-gradient(135deg, ${branding.colors.brandPrimary}, ${branding.colors.brandSecondary})` }} disabled={loading}>
              {loading ? (  
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('signingIn')}
                </span>
              ) : t('signIn')}
            </button>
          </form>

          {/* DEMO LOGIN — delete this block when done */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              ⚡ Demo Login (Super Admin)
            </button>
            <p className="text-xs text-yellow-600/60 text-center mt-1">For testing only — remove before production</p>
          </div>

          {/* No signup — invitation only */}
          <div className="mt-5 pt-5 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-600">
              🔒 {t('accessByInvitation')}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              Contact your administrator to get access
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: live feed placeholder */}
      <div className="mt-8 w-full max-w-sm">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-600">📡 Live Feed — Coming Soon</p>
        </div>
      </div>

    </div>
  )
}

export default Login
