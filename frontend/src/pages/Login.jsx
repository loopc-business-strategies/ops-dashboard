// FILE: src/pages/Login.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getTenantBranding, isLocalTenantHost, resolveTenantFromHostname, resolveTenantFromSearch } from '../config/tenantBranding'

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

  const hostTenant = resolveTenantFromHostname(window.location.hostname, 'loopc')
  const company = resolveTenantFromSearch(window.location.search, hostTenant)
  const isPlainLocalHost = isLocalTenantHost(window.location.hostname)

  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const branding = getTenantBranding(company)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--purple', branding.colors.brandPrimary)
    root.style.setProperty('--purple-light', branding.colors.brandSecondary)
    root.style.setProperty('--purple-rgb', hexToRgb(branding.colors.brandPrimary))
    root.style.setProperty('--grad-brand', `linear-gradient(135deg, ${branding.colors.brandPrimary}, ${branding.colors.brandSecondary})`)
    root.style.setProperty('--grad-bar', branding.colors.gradBar)
  }, [branding])

  useEffect(() => {
    if (!isPlainLocalHost) return
    if (window.location.search.includes('company=') || window.location.search.includes('tenant=')) return

    const target = new URL(window.location.href)
    target.hostname = `${company}.localhost`
    window.location.replace(target.toString())
  }, [company, isPlainLocalHost])

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

  const bp = branding.colors.brandPrimary


  const circleLarge = bp
  const circleMed   = bp
  const circleSmall = bp

  // Flat solid tenant brand color — no gradient
 



  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — flat solid brand color + 3D glossy circles ── */}
      <div
        className="hidden lg:flex lg:w-[50%] relative overflow-hidden flex-col justify-center px-14 bg-white"
      >
        {/* Large circle — fills most of panel, bleeds top-right */}
        <div className="absolute rounded-full"
             style={{
               width: '900px',
               height: '900px',
               paddingBottom: '72%',
               top: '-30%',
               left: '-35%',
               background: circleLarge,
               boxShadow: 'rgba(255, 255, 255, 0.2) 14px 14px 44px inset, rgba(0, 0, 0, 0.32) -18px -18px 52px inset',
              
             }} />

        {/* Medium circle — bottom-left, darker, cut off */}
        <div className="absolute rounded-full"
             style={{
               width: '300px',
               height: '300px',
               bottom: '40px',
               right: '170px',
               background: circleMed,
               boxShadow: 'rgba(255, 255, 255, 0.2) 14px 14px 44px inset, rgba(0, 0, 0, 0.32) -18px -18px 52px inset',
               zIndex: 2,
             }} />

        {/* Small circle — bottom-center, overlaps medium */}
        <div className="absolute rounded-full"
             style={{
               width: '300px',
               height: '300px',
               bottom: '-70px',
               left: '-100px',
               background: circleSmall,
               boxShadow: 'rgba(255, 255, 255, 0.2) 14px 14px 44px inset, rgba(0, 0, 0, 0.32) -18px -18px 52px inset',
               zIndex: 2,
             }} />

        {/* Content */}
        <div className="relative z-10"   style={{ paddingLeft: '70px', paddingBottom: '200px' }} >
          {/* Logo */}
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
            style={{ background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.30)' }}
          >
            {branding.logoImage
              ? <img src={branding.logoImage} alt={branding.displayName} className="w-14 h-14 object-contain" />
              : <span className="text-2xl font-extrabold text-white tracking-wide">{branding.logoText}</span>
            }
          </div>

          <h1 className="text-5xl font-extrabold text-white uppercase tracking-wide mb-3">
            WELCOME
          </h1>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            <span className="text-blue-300">Nexa</span>Ops™
          </h2>
          {/* <h2 className="text-base font-bold text-white/75 uppercase tracking-widest mb-5">
            {branding.displayName} OPS
          </h2> */}
          <p className="text-white/70 text-sm leading-relaxed max-w-xs mt-2">
            Unified platform for metal trading, ERP,
            compliance, and financial control.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — plain white background, no card ── */}
      <div className="flex-1 flex flex-col items-start justify-center bg-white relative overflow-hidden" style={{ padding: '40px 52px' }}>

        {/* Mobile-only logo (hidden on lg) */}
        <div className="lg:hidden mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
            style={{ background: branding.colors.gradBar, border: '2px solid rgba(255,255,255,0.25)' }}
          >
            {branding.logoImage
              ? <img src={branding.logoImage} alt={branding.displayName} className="w-11 h-11 object-contain" />
              : <span className="text-xl font-extrabold text-white tracking-wide">{branding.logoText}</span>
            }
          </div>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#1C2A33' }}>{branding.displayName} OPS</h1>
          <p className="text-gray-500 text-sm mt-1">{branding.tagline || t('operationsControl')}</p>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-[32px] font-bold text-[#1a1a2e] mb-1">{t('signIn')}</h1>
          <p className="text-xs text-gray-400 mb-7">{branding.tagline || t('operationsControl')}</p>

          <form onSubmit={handleSubmit} className="space-y-5">

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-500 text-xs">{error}</p>
                </div>
              )}

              {/* Username field */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                  {t('username')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError('') }}
                    placeholder={t('enterUsername')}
                    className="w-full bg-[#f3f4f6] border-none rounded-[10px] py-[11px] px-4 text-[13px] text-[#333] outline-none transition-all duration-200 placeholder:text-[#b0b8c4] placeholder:text-[13px] placeholder:font-normal focus:bg-white focus:shadow-[0_0_0_2px_#1877d4]"
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                  {t('password')}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder={t('enterPassword')}
                    className="w-full bg-[#f3f4f6] border-none rounded-[10px] py-[11px] pl-4 pr-20 text-[13px] text-[#333] outline-none transition-all duration-200 placeholder:text-[#b0b8c4] placeholder:text-[13px] placeholder:font-normal focus:bg-white focus:shadow-[0_0_0_2px_#1877d4]"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1d4ed8] text-xs font-semibold tracking-wide hover:opacity-80 transition-opacity"
                  >
                    {showPass ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Sign In button */}
              <button
                type="submit"
                className="w-full rounded-[10px] py-[13px] text-white text-sm font-semibold"
                style={{ background: branding.colors.gradBar }}
                disabled={loading}
              >
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

              {/* Access by invitation only */}
              <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  🔒 {t('accessByInvitation')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Contact your administrator to get access
                </p>
              </div>
            </form>
        </div>

        <div className="absolute rounded-full"
             style={{
               width: '300px',
               height: '300px',
               bottom: '-70px',
               right: '-100px',
               background: circleSmall,
               boxShadow: 'rgba(255, 255, 255, 0.2) 14px 14px 44px inset, rgba(0, 0, 0, 0.32) -18px -18px 52px inset',
               zIndex: 2,
             }} />
      </div>
    </div>

  )
}

export default Login
