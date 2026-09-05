import { useEffect, useState } from 'react'
import BuildInfoBadge from '../components/BuildInfoBadge'
import './MgLogin.css'

const REMEMBER_KEY = 'enterprise.login.rememberName'

/**
 * Unified tenant-branded enterprise login shell.
 * Preserves auth fields, validation, remember-me, forgot-password notice, and contrast-safe CTAs.
 */
export default function TenantLoginShell({
  branding,
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

  const primary = branding.colors?.brandPrimary || 'var(--brand-primary)'

  return (
    <div className="mg-login enterprise-login" data-tenant={branding.key}>
      <div className="mg-login__frame">
        <div className="mg-login__panel mg-login__panel--brand" style={{ background: primary }}>
          <div className="mg-login__brand-inner">
            <div className="mg-login__logo-plate" style={{ background: '#FFFFFF' }}>
              {branding.logoImage ? (
                <img src={branding.logoImage} alt={`${branding.displayName} logo`} />
              ) : (
                <span className="mg-login__logo-fallback">{branding.logoText}</span>
              )}
            </div>
            <p className="mg-login__eyebrow">{branding.displayName}</p>
            <h1 className="mg-login__hero-title">Welcome</h1>
            <p className="mg-login__hero-copy">{branding.tagline || t('operationsControl')}</p>
            <ul className="mg-login__chips" aria-hidden="true">
              <li>ERP</li>
              <li>Finance</li>
              <li>Operations</li>
            </ul>
          </div>
        </div>

        <div className="mg-login__panel mg-login__panel--form">
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <BuildInfoBadge tone="light" className="hidden sm:inline-flex" />
          </div>
          <form className="mg-login__card" onSubmit={onSubmit} noValidate>
            {branding.logoImage ? (
              <div className="mg-login__form-logo" aria-hidden="true">
                <img src={branding.logoImage} alt="" />
              </div>
            ) : null}
            <h2 className="mg-login__form-title">{t('signIn')}</h2>
            <p className="mg-login__form-sub">{branding.tagline || t('operationsControl')}</p>

            {idleNotice && <div className="mg-login__alert mg-login__alert--warn">{idleNotice}</div>}
            {error && <div className="mg-login__alert mg-login__alert--error" role="alert">{error}</div>}
            {forgotNotice && <div className="mg-login__alert mg-login__alert--info">{forgotNotice}</div>}

            <label className="mg-login__label" htmlFor="enterprise-login-user">{t('username')}</label>
            <div className="mg-login__field">
              <input
                id="enterprise-login-user"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                placeholder={t('enterUsername')}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>

            <label className="mg-login__label" htmlFor="enterprise-login-pass">{t('password')}</label>
            <div className="mg-login__field mg-login__field--pass">
              <input
                id="enterprise-login-pass"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder={t('enterPassword')}
                autoComplete="current-password"
                disabled={loading}
              />
              <button type="button" className="mg-login__eye" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            <div className="mg-login__row">
              <label className="mg-login__remember">
                <input type="checkbox" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="mg-login__forgot"
                onClick={() => setForgotNotice('Contact your administrator to reset your password.')}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="mg-login__submit" disabled={loading}>
              {loading ? t('signingIn') : t('signIn')}
            </button>

            <p className="mg-login__footnote">
              {t('accessByInvitation')}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
