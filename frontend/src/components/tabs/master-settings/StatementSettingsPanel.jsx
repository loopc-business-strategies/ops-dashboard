import { useState } from 'react'
import DocumentLayoutPreview from './DocumentLayoutPreview'
import DocumentLogoEditor from './DocumentLogoEditor'
import SignatoryEditor from './SignatoryEditor'
import StatementPreviewModal from '../erp/accountEnquiry/StatementPreviewModal'
import { useStatementPreviewHtml } from './useStatementPreviewHtml'
import { applyDocumentLogoPatch } from './documentLogoChange'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function StatementSettingsPanel({
  branding,
  onChange,
  onSave,
  saving,
  error,
  status,
  user = null,
}) {
  const [previewDataMode, setPreviewDataMode] = useState('empty')
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [logoError, setLogoError] = useState('')
  const statementPrint = branding.statementPrint || {}

  const {
    html: previewHtml,
    loading: previewLoading,
    error: previewError,
    title: previewTitle,
  } = useStatementPreviewHtml({
    branding,
    user,
    previewMode: previewDataMode,
  })

  const patchBranding = (patch) => onChange((prev) => ({ ...prev, ...patch }))
  const patchStatementPrint = (patch) => onChange((prev) => ({
    ...prev,
    statementPrint: { ...prev.statementPrint, ...patch },
  }))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <DocumentLayoutPreview
        branding={branding}
        layoutSettings={statementPrint}
        onLayoutChange={patchStatementPrint}
        title={statementPrint.title || 'Statement of Account'}
        subtitle={statementPrint.subtitle || ''}
        meta={[
          { label: 'Account', value: 'CUST-001' },
          { label: 'Period', value: '01-Jan-26 to 08-Jul-26' },
        ]}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Company name
          <input
            type="text"
            value={branding.companyName || ''}
            onChange={(e) => patchBranding({ companyName: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Address
          <textarea
            value={branding.address || ''}
            onChange={(e) => patchBranding({ address: e.target.value })}
            rows={3}
            style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Phone
            <input type="text" value={branding.phone || ''} onChange={(e) => patchBranding({ phone: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            TRN
            <input type="text" value={branding.trn || ''} onChange={(e) => patchBranding({ trn: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
        </div>
      </div>

      <DocumentLogoEditor
        branding={branding}
        layoutSettings={statementPrint}
        onChange={(patch) => applyDocumentLogoPatch(patch, { setLogoError, patchBranding })}
        onLayoutChange={patchStatementPrint}
        enableAutoLogoCleanup
      />

      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Statement title
          <input
            type="text"
            value={statementPrint.title || ''}
            onChange={(e) => patchStatementPrint({ title: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Subtitle
          <input
            type="text"
            value={statementPrint.subtitle || ''}
            onChange={(e) => patchStatementPrint({ subtitle: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Signatories</h4>
        <SignatoryEditor
          signatories={statementPrint.signatories || []}
          onChange={(signatories) => patchStatementPrint({ signatories })}
        />
      </div>

      <label style={{ fontSize: 12, color: '#6B7280' }}>
        Footer note
        <textarea
          value={statementPrint.footerNote || ''}
          onChange={(e) => patchStatementPrint({ footerNote: e.target.value })}
          rows={2}
          style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={statementPrint.showPrintNote !== false}
          onChange={(e) => patchStatementPrint({ showPrintNote: e.target.checked })}
        />
        Show generated-on timestamp in statement preview
      </label>

      <section style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Full statement preview</h4>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280' }}>
          Preview the complete statement layout with empty or sample data. Changes update live before saving.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden' }}>
            {['empty', 'sample'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreviewDataMode(value)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  background: previewDataMode === value ? '#005B96' : '#FFFFFF',
                  color: previewDataMode === value ? '#FFFFFF' : '#374151',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {value === 'empty' ? 'Empty' : 'Sample'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #005B96', background: '#EFF6FF', color: '#005B96', fontWeight: 700, cursor: 'pointer' }}
          >
            Open full preview
          </button>
        </div>
        <div style={{
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          background: '#F8FAFC',
          padding: 12,
          minHeight: 200,
          maxHeight: 420,
          overflow: 'auto',
        }}
        >
          {previewLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              Preparing statement preview…
            </div>
          ) : previewError ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#B91C1C', fontSize: 13 }}>
              {previewError}
            </div>
          ) : (
            <iframe
              title="Statement inline preview"
              srcDoc={previewHtml}
              style={{
                width: '100%',
                height: 420,
                border: 'none',
                display: 'block',
                background: '#FFFFFF',
              }}
            />
          )}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#005B96', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save statement settings'}
        </button>
        {status ? <span style={{ fontSize: 13, color: '#166534' }}>{status}</span> : null}
        {error ? <span style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span> : null}
        {logoError ? <span style={{ fontSize: 13, color: '#B91C1C' }}>{logoError}</span> : null}
      </div>

      <StatementPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={previewTitle}
        html={previewHtml}
        loading={previewLoading}
        showPrintButton
      />
    </div>
  )
}
