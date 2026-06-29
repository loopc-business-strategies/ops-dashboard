import { ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE } from './erpTabPresentation'

export default function ErpMappingTestModal({ open, testMapping, colors, onClose }) {
  if (!open || !testMapping) return null
  const C = colors
  return (
    <div style={ERP_MODAL_BACKDROP_STYLE} onClick={onClose}>
      <div style={ERP_MODAL_CARD_STYLE} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: '1rem', color: C.ink, fontWeight: '700' }}>
          Test Mapping: {testMapping.mappingType}
        </h3>
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
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
