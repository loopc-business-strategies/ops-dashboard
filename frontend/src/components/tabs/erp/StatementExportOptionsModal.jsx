/**
 * Small modal for account statement export (print vs PDF). Keeps bulk out of ERPTab.jsx.
 */
export default function StatementExportOptionsModal({ open, onClose, onPrint, onDownloadPdf }) {
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

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '2rem', maxWidth: '400px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Export Statement</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: '#6B7280', fontSize: '0.95rem' }}>Choose how you&apos;d like to export the statement:</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onPrint}
            style={{ ...primaryBtn, background: '#3B82F6' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2563EB' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6' }}
          >
            🖨 Print
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            style={{ ...primaryBtn, background: '#10B981' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#059669' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#10B981' }}
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
      </div>
    </div>
  )
}
