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

function MgLoginShell({
  name,
  setName,
  password,
  setPassword,
  error,
  setError,
  loading,
  showPass,
  setShowPass,
  handleSubmit,
  t,
}) {
  const fieldBg = 'rgba(5, 16, 29, 0.99)'
  const inputStyle = {
    position: 'absolute',
    width: 410,
    height: 36,
    borderRadius: 4,
    border: 0,
    background: fieldBg,
    color: '#E8EDF4',
    fontSize: 16,
    lineHeight: '36px',
    outline: 'none',
    padding: '0 10px',
    boxShadow: 'none',
    zIndex: 2,
  }
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1600 : window.innerWidth,
    height: typeof window === 'undefined' ? 1000 : window.innerHeight,
  }))

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const designWidth = 1718
  const designHeight = 916
  const scaleX = viewport.width / designWidth
  const scaleY = viewport.height / designHeight
  const sx = (value) => value * scaleX
  const sy = (value) => value * scaleY

  return (
    <div
      className="mg-login-shell"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 22% 42%, rgba(31, 54, 77, 0.62), transparent 26%), radial-gradient(circle at 78% 18%, rgba(25, 55, 86, 0.36), transparent 30%), linear-gradient(135deg, #0b1b2b 0%, #020814 58%, #00040b 100%)',
        color: '#F8FAFC',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        className="mg-login-stage"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundImage: 'url(/images/mg-login-reference.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <form onSubmit={handleSubmit} style={{ position: 'absolute', inset: 0 }}>
          {error && (
            <div
              style={{
                position: 'absolute',
                left: sx(968),
                top: sy(318),
                width: sx(455),
                minHeight: sy(30),
                border: '1px solid rgba(248,113,113,0.55)',
                background: 'rgba(127,29,29,0.72)',
                color: '#FECACA',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                zIndex: 4,
              }}
            >
              {error}
            </div>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder=""
            style={{
              ...inputStyle,
              width: sx(300),
              height: sy(34),
              left: sx(1028),
              top: sy(372),
              fontSize: sx(16),
              lineHeight: `${sy(34)}px`,
            }}
            autoFocus
            autoComplete="username"
            disabled={loading}
            aria-label={t('username')}
          />
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder=""
            style={{
              ...inputStyle,
              width: sx(300),
              left: sx(1028),
              top: sy(484),
              height: sy(34),
              fontSize: sx(16),
              lineHeight: `${sy(34)}px`,
            }}
            autoComplete="current-password"
            disabled={loading}
            aria-label={t('password')}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            disabled={loading}
            style={{
              position: 'absolute',
              left: sx(1344),
              top: sy(468),
              width: sx(82),
              height: sy(60),
              border: 0,
              background: 'transparent',
              color: 'transparent',
              cursor: loading ? 'not-allowed' : 'pointer',
              zIndex: 3,
            }}
            aria-label={showPass ? 'Hide password' : 'Show password'}
          />
          {loading && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: sx(968),
                top: sy(551),
                width: sx(455),
                height: sy(55),
                borderRadius: 9,
                background: '#FFD15A',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            style={{
              position: 'absolute',
              left: sx(968),
              top: sy(551),
              width: sx(455),
              height: sy(55),
              border: 0,
              borderRadius: 9,
              background: 'transparent',
              color: loading ? '#071422' : 'transparent',
              fontSize: sx(16),
              fontWeight: 900,
              letterSpacing: loading ? '0.02em' : 0,
              cursor: loading ? 'wait' : 'pointer',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sx(8),
            }}
          >
            {loading ? (
              <>
                <svg
                  aria-hidden="true"
                  width={sx(18)}
                  height={sx(18)}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ flexShrink: 0, animation: 'mg-login-spin 0.8s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                {t('signingIn')}
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </button>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: sx(625),
              top: sy(596),
              width: sx(24),
              height: sy(18),
              background: 'rgba(5, 17, 30, 0.96)',
              borderRadius: 3,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: sx(610),
              top: sy(872),
              width: sx(500),
              height: sy(32),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(3, 12, 24, 0.94)',
              color: '#9CA3AF',
              fontSize: sx(14),
              letterSpacing: 0,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            © 2025 LoopC Business Strategies. All rights reserved.
          </div>
        </form>
      </div>

      <style>{`
        .mg-login-shell,
        .mg-login-shell * {
          box-sizing: border-box;
        }
        .mg-login-shell input::placeholder {
          color: rgba(226, 232, 240, 0.62);
        }
        .mg-login-shell input:-webkit-autofill,
        .mg-login-shell input:-webkit-autofill:hover,
        .mg-login-shell input:-webkit-autofill:focus {
          -webkit-text-fill-color: #e8edf4;
          caret-color: #e8edf4;
          box-shadow: 0 0 0 1000px rgba(5, 16, 29, 0.99) inset;
          transition: background-color 9999s ease-in-out 0s;
        }
        .mg-login-shell button[type="submit"] {
          background-image: none !important;
        }
        .mg-login-shell button[type="submit"]:not(:disabled) {
          color: transparent !important;
        }
        .mg-login-shell button[type="submit"]:disabled {
          color: #071422 !important;
        }
        @keyframes mg-login-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 980px) {
          .mg-login-stage {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            transform: none !important;
            min-height: 100vh !important;
          }
          .mg-login-shell { height: auto !important; min-height: 100vh !important; overflow-y: auto !important; }
          .mg-login-shell section {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            height: auto !important;
          }
          .mg-login-shell section:first-of-type { padding: 88px 24px 20px !important; }
          .mg-login-shell section:first-of-type img { width: min(220px, 58vw) !important; }
          .mg-login-shell section:first-of-type div[style*="font-size: 52px"] { font-size: 40px !important; }
          .mg-login-shell section:nth-of-type(2) { padding: 24px 22px 88px !important; }
          .mg-login-shell section:nth-of-type(2) > div { width: 100% !important; min-height: 0 !important; padding: 44px 24px 34px !important; }
          .mg-login-shell section:nth-of-type(2) h1 { font-size: 38px !important; }
          .mg-login-shell footer { position: relative !important; }
        }
      `}</style>
    </div>
  )
}

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()

  const storedTenant = localStorage.getItem('tenantCompany') || 'loopc'
  const hostTenant = resolveTenantFromHostname(window.location.hostname, storedTenant)
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
      setLoading(false)
      if (!err.response) {
        setError(t('loginErrNetwork'))
      } else if (err.response.status >= 500) {
        setError(t('loginErrServer'))
      } else {
        setError(err.response?.data?.message || t('loginErrInvalid'))
      }
    }
  }

  const bp = branding.colors.brandPrimary
  const circleLarge = bp
  const circleMed   = bp
  const circleSmall = bp
  const heroCircleShadow = 'inset 28px 28px 64px rgba(255,255,255,0.18), inset -28px -28px 64px rgba(0,0,0,0.26)'
  const orbShadow = 'inset 16px 16px 36px rgba(255,255,255,0.16), inset -18px -18px 40px rgba(0,0,0,0.24)'

  if (company === 'mg') {
    return (
      <MgLoginShell
        name={name}
        setName={setName}
        password={password}
        setPassword={setPassword}
        error={error}
        setError={setError}
        loading={loading}
        showPass={showPass}
        setShowPass={setShowPass}
        handleSubmit={handleSubmit}
        t={t}
      />
    )
  }

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

        <div
          className="absolute hidden lg:block rounded-full"
          style={{
            width: '150px',
            height: '150px',
            left: '-8px',
            bottom: '-14px',
            background: circleSmall,
            boxShadow: orbShadow,
            zIndex: 1,
          }}
        />
        <div
          className="absolute hidden lg:block rounded-full"
          style={{
            width: '162px',
            height: '162px',
            left: '340px',
            bottom: '32px',
            background: circleMed,
            boxShadow: orbShadow,
            zIndex: 1,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '230px',
            height: '230px',
            right: '-34px',
            bottom: '-54px',
            background: circleSmall,
            boxShadow: orbShadow,
            zIndex: 1,
          }}
        />

        <div style={{ position: 'absolute', top: '18px', right: '20px', zIndex: 5 }}>
          <BuildInfoBadge tone="light" className="hidden sm:inline-flex" />
        </div>

        <div className="relative min-h-screen md:min-h-[calc(100vh-24px)] flex flex-col lg:flex-row">
          <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden">
            <div
              className="absolute rounded-full"
              style={{
                width: '840px',
                height: '840px',
                top: '-114px',
                left: '-430px',
                background: circleLarge,
                boxShadow: heroCircleShadow,
              }}
            />

            <div className="absolute z-10 left-[48px] top-[178px] max-w-[320px]">
              <div
                className="inline-flex items-center justify-center w-[78px] h-[78px] rounded-[18px] mb-7"
                style={{ background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
              >
                {branding.logoImage
                  ? <img src={branding.logoImage} alt={branding.displayName} className="w-12 h-12 object-contain" />
                  : <span className="text-[20px] font-extrabold text-white tracking-wide">{branding.logoText}</span>
                }
              </div>

              <h1 className="text-[38px] leading-none font-extrabold text-white tracking-tight mb-3">WELCOME</h1>
              <div className="text-[26px] leading-none font-extrabold tracking-tight mb-3">
                <span style={{ color: '#7bc3ff' }}>Nexa</span>
                <span style={{ color: '#0f172a' }}>Ops</span>
              </div>
              <p className="text-[14px] leading-8 text-white/82 max-w-[290px]">
                Unified platform for metal trading, ERP,
                compliance, and financial control.
              </p>
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center lg:justify-start px-6 py-24 sm:px-10 lg:px-0 xl:px-0">
            <div className="relative z-10 w-full max-w-[488px] lg:ml-[22px] xl:ml-[38px]">
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
                className="rounded-[24px] border border-[#dbe3ef] bg-white"
                style={{ width: '100%', maxWidth: '448px', margin: '0 auto', padding: '40px 28px 34px', boxShadow: '0 16px 38px rgba(20, 34, 60, 0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
              >
                <div className="hidden lg:block" style={{ marginBottom: 26 }}>
                  <h1 className="leading-none font-extrabold tracking-tight text-[#1b2540]" style={{ fontSize: 52 }}>{t('signIn')}</h1>
                  <p className="text-[13px] text-[#7f8796] mt-2">{branding.tagline || t('operationsControl')}</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', rowGap: 16 }}>
                  {error && (
                    <div className="flex items-center gap-2 rounded-[12px] border border-[#f0c9c9] bg-[#fff5f5] px-3 py-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[12px] text-red-600">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-semibold text-[#8b95a5] mb-[8px] uppercase tracking-[0.05em]">
                      {t('username')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError('') }}
                        placeholder={t('enterUsername')}
                        className="w-full rounded-[11px] border border-[#aab7c8] bg-[#f3f7fc] pl-4 pr-4 text-[13px] text-[#273247] outline-none transition-all duration-200 placeholder:text-[#9aa5b4] focus:border-[#6ea6e5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,123,255,0.10)]"
                        style={{ height: 56 }}
                        autoFocus
                        autoComplete="username"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#8b95a5] mb-[8px] uppercase tracking-[0.05em]">
                      {t('password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError('') }}
                        placeholder={t('enterPassword')}
                        className="w-full rounded-[11px] border border-[#aab7c8] bg-[#f3f7fc] pl-4 pr-20 text-[13px] text-[#273247] outline-none transition-all duration-200 placeholder:text-[#9aa5b4] focus:border-[#6ea6e5] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,123,255,0.10)]"
                        style={{ height: 56 }}
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
                    className="w-full rounded-[11px] text-white text-[14px] font-bold tracking-[0.01em] shadow-[0_8px_18px_rgba(0,91,150,0.22)] transition-transform duration-200 hover:-translate-y-[1px]"
                    style={{ background: branding.colors.gradBar, height: 54 }}
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

                  <div className="text-center" style={{ paddingTop: 6 }}>
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
