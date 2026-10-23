import { memo, useEffect } from 'react'
import {
  FLOATING_MODAL_FOOTER_END_PAD,
  FLOATING_MODAL_RESIZE_HANDLE_STYLE,
  useFloatingModalChrome,
} from '../useFloatingModalChrome'

function StatementPreviewModal({
  open,
  onClose,
  title,
  html,
  loading,
  showPrintButton = false,
  onPrint,
}) {
  const {
    panelRef,
    offset,
    size,
    isDragging,
    isResizing,
    beginDrag,
    beginResize,
    canCloseOnBackdropClick,
  } = useFloatingModalChrome({
    open,
    defaultWidth: 1200,
    defaultHeightRatio: 0.88,
    minWidth: 640,
    minHeight: 360,
  })

  useEffect(() => {
    if (!open || !panelRef.current) return undefined
    panelRef.current.style.willChange = (isDragging || isResizing) ? 'transform, width, height' : ''
    return undefined
  }, [open, isDragging, isResizing, panelRef])

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }
    if (!html) return
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }

  if (!open) return null

  const backdropColor = (isDragging || isResizing)
    ? 'rgba(15, 23, 42, 0.12)'
    : 'rgba(15, 23, 42, 0.45)'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && canCloseOnBackdropClick()) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: '8px',
          width: size.width,
          height: size.height,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
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
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
            touchAction: 'none',
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{title}</span>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onClose()}
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
        <div style={{ flex: 1, overflow: 'auto', background: '#F9FAFB', minHeight: 0 }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#374151',
              fontSize: '0.95rem',
            }}
            >
              Preparing statement…
            </div>
          ) : (
            <iframe
              title="Statement preview"
              srcDoc={html}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#FFFFFF',
                pointerEvents: (isDragging || isResizing) ? 'none' : 'auto',
              }}
            />
          )}
        </div>
        <div style={{
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          padding: `1rem ${FLOATING_MODAL_FOOTER_END_PAD} 1rem 1.5rem`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexShrink: 0,
        }}
        >
          {showPrintButton ? (
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !html}
              style={{
                padding: '0.6rem 1.2rem',
                background: 'var(--purple)',
                color: 'var(--brand-on-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                cursor: loading || !html ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                opacity: loading || !html ? 0.65 : 1,
              }}
            >
              Print
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onClose()}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#6B7280',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              fontWeight: '700',
            }}
          >
            Close
          </button>
        </div>
        <div
          role="button"
          tabIndex={0}
          onMouseDown={beginResize}
          title="Resize"
          aria-label="Resize"
          style={FLOATING_MODAL_RESIZE_HANDLE_STYLE}
        />
      </div>
    </div>
  )
}

export default memo(StatementPreviewModal)
