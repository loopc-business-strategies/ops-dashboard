import { memo, useEffect } from 'react'
import { useMasterSettingsModalChrome } from './useMasterSettingsModalChrome'

function MasterSettingsSectionModal({
  open,
  onClose,
  title,
  children,
  wide = false,
}) {
  const {
    panelRef,
    offset,
    size,
    isDragging,
    isResizing,
    beginDrag,
    beginResize,
  } = useMasterSettingsModalChrome({ open, wide })

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isInteracting = isDragging || isResizing
  const backdropColor = isInteracting ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.45)'

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !isInteracting) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        transition: 'background 120ms ease',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '8px',
          width: `min(${size.width}px, 96vw)`,
          height: `min(${size.height}px, 88vh)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
          position: 'relative',
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          willChange: isInteracting ? 'transform' : undefined,
        }}
      >
        <div
          onMouseDown={beginDrag}
          style={{
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexShrink: 0,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{title}</span>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
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
          minHeight: 0,
        }}
        >
          {children}
        </div>
        <div
          onMouseDown={beginResize}
          title="Resize"
          aria-label="Resize"
          style={{
            position: 'absolute',
            right: '6px',
            bottom: '6px',
            width: '16px',
            height: '16px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, #64748B 50%)',
            borderBottomRightRadius: '0.35rem',
          }}
        />
      </div>
    </div>
  )
}

export default memo(MasterSettingsSectionModal)
