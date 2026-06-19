export default function StatementPreviewModal({
  open,
  onClose,
  title,
  html,
  loading,
  backdropColor,
  modalOffset,
  modalDrag,
  beginModalDrag,
}) {
  if (!open) return null
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        transition: 'background 120ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          width: 'min(1200px, 96vw)',
          height: 'min(88vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
          transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)`,
        }}
      >
        <div
          onMouseDown={beginModalDrag}
          style={{
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            cursor: modalDrag.active ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{title}</span>
          <button
            type="button"
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
        <div style={{ flex: 1, overflow: 'hidden', background: '#F9FAFB' }}>
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
              style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#FFFFFF' }}
            />
          )}
        </div>
        <div style={{
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
        >
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
      </div>
    </div>
  )
}
