import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { clearStoredActivity, useWebIdleLogout } from '../hooks/useWebIdleLogout'

export default function WebIdleSessionGuard() {
  const { logout, sessionPolicy } = useAuth()
  const { t } = useLanguage()
  const [showWarning, setShowWarning] = useState(false)

  const idleTimeoutMinutes = Number(sessionPolicy?.idleTimeoutMinutes || 0)
  const idleWarningMinutes = Number(sessionPolicy?.idleWarningMinutes || 5)
  const enabled = idleTimeoutMinutes > 0

  const idleTimeoutMs = useMemo(
    () => (enabled ? idleTimeoutMinutes * 60 * 1000 : 0),
    [enabled, idleTimeoutMinutes],
  )
  const warningMs = useMemo(
    () => Math.min(idleWarningMinutes * 60 * 1000, Math.max(0, idleTimeoutMs - 1000)),
    [idleTimeoutMs, idleWarningMinutes],
  )

  const handleIdleLogout = useCallback(async () => {
    setShowWarning(false)
    clearStoredActivity()
    try {
      await logout()
    } catch {
      // Still redirect when server logout fails.
    }
    window.location.replace('/login?reason=idle')
  }, [logout])

  const { recordActivity } = useWebIdleLogout({
    enabled,
    idleTimeoutMs,
    warningMs,
    onWarn: () => setShowWarning(true),
    onIdle: handleIdleLogout,
    onActivityReset: () => setShowWarning(false),
  })

  const staySignedIn = () => {
    setShowWarning(false)
    recordActivity(Date.now())
  }

  if (!enabled || !showWarning) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-session-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
        }}
      >
        <h2
          id="idle-session-title"
          style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}
        >
          {t('idleWarningTitle')}
        </h2>
        <p style={{ margin: '0.75rem 0 1.25rem', fontSize: '0.92rem', lineHeight: 1.5, color: '#4B5563' }}>
          {String(t('idleWarningBody')).replace('{minutes}', String(idleWarningMinutes))}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleIdleLogout}
            style={{
              border: '1px solid #D1D5DB',
              background: '#fff',
              color: '#374151',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('signOutNow')}
          </button>
          <button
            type="button"
            onClick={staySignedIn}
            style={{
              border: 0,
              background: '#4F46E5',
              color: '#fff',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('staySignedIn')}
          </button>
        </div>
      </div>
    </div>
  )
}
