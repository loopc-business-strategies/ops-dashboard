import {
  FLOATING_MODAL_FOOTER_END_PAD,
  FloatingModalResizeHandle,
  useFloatingModalChrome,
} from './useFloatingModalChrome'

export default function ErpMappingTestModal({ open, testMapping, colors, onClose }) {
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
    open: Boolean(open && testMapping),
    defaultWidth: 540,
    defaultHeightRatio: 0.7,
    minWidth: 360,
    minHeight: 280,
  })

  if (!open || !testMapping) return null
  const C = colors
  const backdropColor = (isDragging || isResizing)
    ? 'rgba(17, 24, 39, 0.18)'
    : 'rgba(17, 24, 39, 0.45)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={() => { if (canCloseOnBackdropClick()) onClose() }}
    >
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          width: size.width,
          height: size.height,
          maxWidth: '100%',
          maxHeight: '100%',
          background: '#FFFFFF',
          borderRadius: '0.75rem',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.2)',
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
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, color: C.ink, fontWeight: '700', fontSize: '1.05rem' }}>
            Test Mapping: {testMapping.mappingType}
          </h3>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: C.ink,
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0.2rem 0.35rem',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem', minHeight: 0 }}>
          <div style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <p style={{ color: C.inkSoft, marginBottom: '0.75rem' }}>
              <strong>Usage Count:</strong> {testMapping.usageCount || 0} times used
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div>
                <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DEBIT ACCOUNT</p>
                <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.debitAccountId?.accountCode}</p>
                <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.debitAccountId?.accountName}</p>
              </div>
              <div>
                <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>CREDIT ACCOUNT</p>
                <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.creditAccountId?.accountCode}</p>
                <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.creditAccountId?.accountName}</p>
              </div>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}` }}>
              <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DESCRIPTION</p>
              <p style={{ color: C.ink }}>{testMapping.description || '(No description)'}</p>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}`, background: '#ECFDF5', padding: '0.75rem', borderRadius: '0.375rem' }}>
              <p style={{ color: '#065F46', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>✓ Sample Transaction</p>
              <p style={{ color: '#047857', fontSize: '0.875rem' }}>When this mapping is applied:</p>
              <ul style={{ color: '#047857', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <li>Debit: {testMapping.debitAccountId?.accountCode}</li>
                <li>Credit: {testMapping.creditAccountId?.accountCode}</li>
                <li>Amount: Enter any amount</li>
              </ul>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingRight: FLOATING_MODAL_FOOTER_END_PAD, paddingBottom: '0.35rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
        <FloatingModalResizeHandle onMouseDown={beginResize} />
      </div>
    </div>
  )
}
