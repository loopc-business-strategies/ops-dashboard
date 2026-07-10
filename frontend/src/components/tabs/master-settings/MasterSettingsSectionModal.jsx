import { memo, useEffect } from 'react'

function MasterSettingsSectionModal({
  open,
  onClose,
  title,
  children,
  wide = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: '#fff',
          borderRadius: '8px',
          width: wide ? 'min(1100px, 96vw)' : 'min(720px, 96vw)',
          height: 'min(88vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexShrink: 0,
        }}
        >
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{title}</span>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '20px',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#F9FAFB',
          padding: '1rem 1.25rem',
        }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default memo(MasterSettingsSectionModal)
