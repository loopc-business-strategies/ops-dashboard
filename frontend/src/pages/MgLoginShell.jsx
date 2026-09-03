import { useEffect, useState } from 'react'
import BuildInfoBadge from '../components/BuildInfoBadge'
import './MgLogin.css'

const REMEMBER_KEY = 'mg.login.rememberName'

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

function IconEye({ off }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function DecorCurves() {
  return (
    <div className="mg-login__decor" aria-hidden="true">
      <div className="mg-login__decor-dots" />
      <div className="mg-login__decor-blob mg-login__decor-blob--tl" />
      <div className="mg-login__decor-blob mg-login__decor-blob--br" />
      <svg className="mg-login__decor-curve mg-login__decor-curve--tl" viewBox="0 0 640 320" fill="none">
        <path d="M-40 220C80 40 260 -20 420 80C520 150 580 40 700 -20" stroke="url(#mgCurveA)" strokeWidth="28" strokeLinecap="round" opacity="0.35" />
        <path d="M-20 280C120 120 300 40 460 120" stroke="url(#mgCurveB)" strokeWidth="14" strokeLinecap="round" opacity="0.25" />
        <defs>
          <linearGradient id="mgCurveA" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FF8A00" />
            <stop offset="1" stopColor="#FFC400" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="mgCurveB" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#FF6A00" />
            <stop offset="1" stopColor="#FFC400" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg className="mg-login__decor-curve mg-login__decor-curve--br" viewBox="0 0 640 320" fill="none">
        <path d="M-40 220C80 40 260 -20 420 80C520 150 580 40 700 -20" stroke="url(#mgCurveC)" strokeWidth="28" strokeLinecap="round" opacity="0.3" />
        <defs>
          <linearGradient id="mgCurveC" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FF6A00" />
            <stop offset="1" stopColor="#FFC400" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export default function MgLoginShell({
  name,
  setName,
  password,
  setPassword,
  error,
  idleNotice,
  setError,
  loading,
  showPass,
  setShowPass,
  handleSubmit,
  t,
}) {
  const [remember, setRemember] = useState(false)
  const [forgotNotice, setForgotNotice] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setName(saved)
        setRemember(true)
      }
    } catch {
      /* ignore */
    }
  }, [setName])

  const onRememberChange = (checked) => {
    setRemember(checked)
    if (!checked) {
      try {
        localStorage.removeItem(REMEMBER_KEY)
      } catch {
        /* ignore */
      }
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setForgotNotice('')
    try {
      if (remember && name.trim()) {
        localStorage.setItem(REMEMBER_KEY, name.trim())
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
    } catch {
      /* ignore */
    }
    await handleSubmit(e)
  }

  return (
    <div className="mg-login">
      <DecorCurves />
      <div className="mg-login__badge">
        <BuildInfoBadge tone="light" className="hidden sm:inline-flex" />
      </div>

      <div className="mg-login__grid">
        <aside className="mg-login__brand">
          <img
            className="mg-login__logo"
            src="/logos/mg-logo.png"
            alt="Modern Gold"
            width={220}
            height={220}
          />
          <h1 className="mg-login__brand-name">
            MODERN <span>GOLD</span>
          </h1>
          <div className="mg-login__brand-rule" />
          <p className="mg-login__tagline">Precision. Purity. Prestige.</p>

          <div className="mg-login__features">
            <div className="mg-login__feature">
              <span className="mg-login__feature-icon"><IconShield /></span>
              <div>
                <strong>Secure</strong>
                <span>Enterprise-grade security</span>
              </div>
            </div>
            <div className="mg-login__feature">
              <span className="mg-login__feature-icon"><IconChart /></span>
              <div>
                <strong>Reliable</strong>
                <span>99.9% uptime guarantee</span>
              </div>
            </div>
            <div className="mg-login__feature">
              <span className="mg-login__feature-icon"><IconUsers /></span>
              <div>
                <strong>Trusted</strong>
                <span>Built for growing businesses</span>
              </div>
            </div>
          </div>

          <p className="mg-login__copyright">© 2026 Modern Gold Jewelry. All rights reserved.</p>
        </aside>

        <section className="mg-login__panel">
          <div className="mg-login__card">
            <h2 className="mg-login__title">
              Welcome <span>Back</span>
            </h2>
            <p className="mg-login__subtitle">Sign in to continue to your account</p>

            <form onSubmit={onSubmit} noValidate>
              {idleNotice && (
                <div className="mg-login__alert mg-login__alert--idle" role="status">
                  {idleNotice}
                </div>
              )}
              {error && (
                <div className="mg-login__alert mg-login__alert--error" role="alert">
                  {error}
                </div>
              )}
              {forgotNotice && (
                <div className="mg-login__alert mg-login__alert--info" role="status">
                  {forgotNotice}
                </div>
              )}

              <div className="mg-login__group">
                <label className="mg-login__label" htmlFor="mg-login-user">
                  Email Address
                </label>
                <div className="mg-login__field">
                  <span className="mg-login__field-icon"><IconUser /></span>
                  <input
                    id="mg-login-user"
                    className="mg-login__field-input"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); setForgotNotice('') }}
                    placeholder="Enter your email address"
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                    aria-label={t('username')}
                  />
                </div>
              </div>

              <div className="mg-login__group">
                <label className="mg-login__label" htmlFor="mg-login-password">
                  Password
                </label>
                <div className="mg-login__field">
                  <span className="mg-login__field-icon"><IconLock /></span>
                  <input
                    id="mg-login-password"
                    className="mg-login__field-input mg-login__field-input--password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); setForgotNotice('') }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-label={t('password')}
                  />
                  <button
                    type="button"
                    className="mg-login__eye"
                    onClick={() => setShowPass(!showPass)}
                    disabled={loading}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    <IconEye off={showPass} />
                  </button>
                </div>
              </div>

              <div className="mg-login__row">
                <label className="mg-login__remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => onRememberChange(e.target.checked)}
                    disabled={loading}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="mg-login__forgot"
                  disabled={loading}
                  onClick={() => setForgotNotice('Contact your administrator to reset your password.')}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="mg-login__submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <svg className="mg-login__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {t('signingIn')}
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mg-login__secure">
              <span className="mg-login__secure-icon"><IconShield /></span>
              <div>
                <strong>Secure and trusted access</strong>
                <p>Your data is protected with enterprise-grade security</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
