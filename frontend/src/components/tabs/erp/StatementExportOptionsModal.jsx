import {
  FLOATING_MODAL_FOOTER_END_PAD,
  FloatingModalResizeHandle,
  useFloatingModalChrome,
} from './useFloatingModalChrome'

/**
 * Small modal for account statement export (print vs PDF). Keeps bulk out of ERPTab.jsx.
 */
export default function StatementExportOptionsModal({ open, onClose, onPrint, onDownloadPdf }) {
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
    persistKey: 'erp-statement-export',
    defaultWidth: 420,
    defaultHeightRatio: 0.28,
    minWidth: 320,
    minHeight: 200,
    maxHeight: 360,
  })

  if (!open) return null

  const primaryBtn = {
    padding: '0.75rem 1.5rem',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  }
  const backdropColor = (isDragging || isResizing)
    ? 'rgba(0, 0, 0, 0.2)'
    : 'rgba(0, 0, 0, 0.5)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={() => { if (canCloseOnBackdropClick()) onClose() }}
    >
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: '0.75rem',
          width: size.width,
          height: size.height,
          maxWidth: '100%',
          maxHeight: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onMouseDown={beginDrag}
          style={{
            padding: '1.25rem 1.5rem 0.75rem',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Export Statement</h3>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem' }}>Choose how you&apos;d like to export the statement:</p>
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          gap: '1rem',
          padding: `1rem ${FLOATING_MODAL_FOOTER_END_PAD} 1.5rem 1.5rem`,
          flexWrap: 'wrap',
          minHeight: 0,
        }}
        >
          <button
            type="button"
            onClick={onPrint}
            style={{ ...primaryBtn, background: 'var(--brand-button-bg, var(--brand-primary))' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-button-hover, var(--brand-hover))' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-button-bg, var(--brand-primary))' }}
          >
            🖨 Print
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            style={{ ...primaryBtn, background: 'var(--purple)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--purple-dark)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--purple)' }}
          >
            ⬇ Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...primaryBtn, background: '#6B7280' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#4B5563' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#6B7280' }}
          >
            Cancel
          </button>
        </div>
        <FloatingModalResizeHandle onMouseDown={beginResize} />
      </div>
    </div>
  )
}
