// FILE: src/pages/Login.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getTenantBranding, isLocalTenantHost, resolveTenantFromHostname, resolveTenantFromSearch } from '../config/tenantBranding'
import BuildInfoBadge from '../components/BuildInfoBadge'

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

  return (
    <div className="min-h-screen bg-[#eef2f6] p-0 md:p-3">
      <div
        className="min-h-screen md:min-h-[calc(100vh-24px)] relative overflow-hidden bg-white md:rounded-[24px] border border-[#dbe4ef]"
        style={{ boxShadow: '0 18px 40px rgba(27, 42, 51, 0.08), inset 0 1px 0 rgba(255,255,255,0.7)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 68% 34%, rgba(201, 164, 92, 0.14), transparent 28%), radial-gradient(circle at 54% 78%, rgba(0, 91, 150, 0.05), transparent 22%), linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)',
          }}
        />

        <div style={{ position: 'absolute', top: '18px', right: '20px', zIndex: 5 }}>
          <BuildInfoBadge tone="light" className="hidden sm:inline-flex" />
        </div>

        <div className="relative min-h-screen md:min-h-[calc(100vh-24px)] flex flex-col lg:flex-row">
          <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden items-center">
            <div
              className="absolute rounded-full"
              style={{
                width: '900px',
                height: '900px',
                top: '-212px',
                left: '-472px',
                background: circleLarge,
                boxShadow: 'inset 28px 28px 64px rgba(255,255,255,0.18), inset -28px -28px 64px rgba(0,0,0,0.26)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: '168px',
                height: '168px',
                bottom: '36px',
                right: '-10px',
                background: circleMed,
                boxShadow: 'inset 16px 16px 36px rgba(255,255,255,0.16), inset -18px -18px 40px rgba(0,0,0,0.24)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: '226px',
                height: '226px',
                bottom: '-118px',
                left: '-78px',
                background: circleSmall,
                boxShadow: 'inset 16px 16px 36px rgba(255,255,255,0.16), inset -18px -18px 40px rgba(0,0,0,0.24)',
              }}
            />

            <div className="relative z-10 pl-12 xl:pl-16 pr-8 max-w-[360px]" style={{ marginTop: '-28px' }}>
              <div
                className="inline-flex items-center justify-center w-[78px] h-[78px] rounded-[18px] mb-7"
                style={{ background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
              >
                {branding.logoImage
                  ? <img src={branding.logoImage} alt={branding.displayName} className="w-12 h-12 object-contain" />
                  : <span className="text-[20px] font-extrabold text-white tracking-wide">{branding.logoText}</span>
                }
              </div>

              <h1 className="text-[46px] leading-none font-extrabold text-white tracking-tight mb-2">WELCOME</h1>
              <div className="text-[31px] leading-none font-extrabold tracking-tight mb-3">
                <span style={{ color: '#7bc3ff' }}>Nexa</span>
                <span style={{ color: '#0f172a' }}>Ops</span>
                <span style={{ color: '#0f172a', fontSize: '16px', verticalAlign: 'super', marginLeft: 2 }}>TM</span>
              </div>
              <p className="text-[14px] leading-7 text-white/82 max-w-[300px]">
                Unified platform for metal trading, ERP,
                compliance, and financial control.
              </p>
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center lg:justify-start px-6 py-24 sm:px-10 lg:px-0 xl:px-0">
            <div
              className="absolute rounded-full hidden md:block"
              style={{
                width: '162px',
                height: '162px',
                left: '-18px',
                bottom: '34px',
                background: circleMed,
                boxShadow: 'inset 16px 16px 32px rgba(255,255,255,0.18), inset -18px -18px 38px rgba(0,0,0,0.22)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: '228px',
                height: '228px',
                right: '-48px',
                bottom: '-44px',
                background: circleSmall,
                boxShadow: 'inset 16px 16px 36px rgba(255,255,255,0.18), inset -18px -18px 40px rgba(0,0,0,0.24)',
              }}
            />

            <div className="relative z-10 w-full max-w-[430px] lg:ml-[8px] xl:ml-[22px]">
              <div className="lg:hidden mb-8 text-center">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-[18px] mb-4"
                  style={{ background: branding.colors.gradBar, boxShadow: '0 14px 28px rgba(var(--purple-rgb),0.18)' }}
                >
                  {branding.logoImage
                    ? <img src={branding.logoImage} alt={branding.displayName} className="w-11 h-11 object-contain" />
                    : <span className="text-xl font-extrabold text-white tracking-wide">{branding.logoText}</span>
                  }
                </div>
                <div className="text-[24px] font-extrabold tracking-tight text-[#17233c]">{t('signIn')}</div>
                <div className="text-[13px] text-[#7f8b9c] mt-1">{branding.tagline || t('operationsControl')}</div>
              </div>

              <div
                className="rounded-[22px] border border-[#dbe3ef] bg-white px-7 py-8 sm:px-9 sm:py-10"
                style={{ width: '426px', minHeight: '426px', boxShadow: '0 16px 38px rgba(20, 34, 60, 0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
              >
                <div className="hidden lg:block mb-8" style={{ paddingTop: '8px' }}>
                  <h1 className="text-[37px] leading-none font-extrabold tracking-tight text-[#1b2540]">{t('signIn')}</h1>
                  <p className="text-[13px] text-[#7f8796] mt-2">{branding.tagline || t('operationsControl')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 rounded-[12px] border border-[#f0c9c9] bg-[#fff5f5] px-3 py-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[12px] text-red-600">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-semibold text-[#8b95a5] mb-2 uppercase tracking-[0.05em]">
                      {t('username')}
                    </label>
                    <div className="relative">
                      <svg className="w-4 h-4 text-[#7f8a99] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1118.88 17.8M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError('') }}
                        placeholder={t('enterUsername')}
                        className="w-full rounded-[12px] border border-[#aab7c8] bg-[#f3f7fc] py-[13px] pl-10 pr-4 text-[13px] text-[#273247] outline-none transition-all duration-200 placeholder:text-[#9aa5b4] focus:border-[#6ea6e5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,123,255,0.10)]"
                        autoFocus
                        autoComplete="username"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#8b95a5] mb-2 uppercase tracking-[0.05em]">
                      {t('password')}
                    </label>
                    <div className="relative">
                      <svg className="w-4 h-4 text-[#7f8a99] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V9a3 3 0 016 0v2H9z" />
                      </svg>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError('') }}
                        placeholder={t('enterPassword')}
                        className="w-full rounded-[12px] border border-[#aab7c8] bg-[#f3f7fc] py-[13px] pl-10 pr-20 text-[13px] text-[#273247] outline-none transition-all duration-200 placeholder:text-[#9aa5b4] focus:border-[#6ea6e5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,123,255,0.10)]"
                        autoComplete="current-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold tracking-wide text-[#2a67d7] hover:opacity-80 transition-opacity"
                      >
                        {showPass ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-[12px] py-[13px] text-white text-[14px] font-bold tracking-[0.01em] shadow-[0_8px_18px_rgba(0,91,150,0.22)] transition-transform duration-200 hover:-translate-y-[1px]"
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

                  <div className="pt-5 text-center">
                    <p className="text-[13px] text-[#7f8796] font-medium">
                      <span className="mr-1">🔒</span>
                      {t('accessByInvitation')}
                    </p>
                    <p className="text-[12px] text-[#7f8796] mt-1">
                      Contact your administrator to get access
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
