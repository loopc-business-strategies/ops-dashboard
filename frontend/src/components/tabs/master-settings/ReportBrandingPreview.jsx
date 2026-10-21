import { DEFAULT_BRANDING, clampBrandingDimension } from '../erp/ERPBrandingUtils'

export default function ReportBrandingPreview({ branding = {} }) {
  const preview = { ...DEFAULT_BRANDING, ...branding }
  const logoWidth = clampBrandingDimension(preview.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const logoHeight = clampBrandingDimension(preview.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 140)

  return (
    <div
      data-testid="report-branding-preview"
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid #E5E7EB',
        background: '#F8FAFC',
      }}
    >
      <p style={{ marginTop: 0, marginBottom: 12, color: '#111827', fontWeight: 700 }}>Financial Report Preview</p>
      <div style={{ height: 10, background: 'var(--grad-bar)', borderRadius: 999, marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '2px solid #111827', paddingBottom: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: '1 1 320px', overflowWrap: 'anywhere' }}>
          <p style={{ margin: '0 0 4px', color: 'var(--purple)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            {preview.companyName || 'Company'}
          </p>
          <p style={{ margin: '0 0 6px', color: '#111827', fontSize: 16, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 700, lineHeight: 1.25 }}>
            ERP Financial Statement
          </p>
          <p style={{ margin: '0 0 3px', color: '#4B5563', fontSize: 11, fontWeight: 500 }}>
            {preview.entityName || DEFAULT_BRANDING.entityName}
            {preview.branchName ? ` / ${preview.branchName}` : ''}
          </p>
          {preview.legalName ? (
            <p style={{ margin: '0 0 3px', color: '#4B5563', fontSize: 11, fontWeight: 500 }}>{preview.legalName}</p>
          ) : null}
          {preview.address ? (
            <p style={{ margin: '0 0 3px', color: '#4B5563', fontSize: 11, fontWeight: 500, whiteSpace: 'pre-line' }}>{preview.address}</p>
          ) : null}
          {(preview.phone || preview.trn) ? (
            <p style={{ margin: '0 0 3px', color: '#4B5563', fontSize: 11, fontWeight: 500 }}>
              {`${preview.phone || ''}${preview.phone && preview.trn ? ' | ' : ''}${preview.trn ? `TRN: ${preview.trn}` : ''}`}
            </p>
          ) : null}
          <p style={{ margin: '0 0 3px', color: '#4B5563', fontSize: 11, fontWeight: 500 }}>
            {preview.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review
          </p>
          <p style={{ margin: 0, color: '#4B5563', fontSize: 11, fontWeight: 500 }}>Period: 01 Apr 2026 to 30 Apr 2026</p>
        </div>
        {preview.logoUrl ? (
          <div style={{ width: logoWidth, height: logoHeight, borderRadius: 6, overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E5E7EB', flex: '0 0 auto' }}>
            <img
              src={preview.logoUrl}
              alt="Report header logo"
              style={{ width: '100%', height: '100%', objectFit: preview.logoFit || 'contain', display: 'block' }}
            />
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ paddingTop: 14, borderTop: '1px solid #475569', color: '#374151', fontSize: 12 }}>
          {preview.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}
          <br />
          {preview.preparedByName || DEFAULT_BRANDING.preparedByName}
        </div>
        <div style={{ paddingTop: 14, borderTop: '1px solid #475569', color: '#374151', fontSize: 12 }}>
          {preview.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}
          <br />
          {preview.reviewedByName || DEFAULT_BRANDING.reviewedByName}
        </div>
        <div style={{ paddingTop: 14, borderTop: '1px solid #475569', color: '#374151', fontSize: 12 }}>
          {preview.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}
          <br />
          {preview.approvedByName || DEFAULT_BRANDING.approvedByName}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#334155', fontSize: 12, flexWrap: 'wrap' }}>
        <span>{preview.companyName ? `${preview.companyName} Reporting Suite` : 'Reporting Suite'}</span>
        <span>{preview.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
      </div>
    </div>
  )
}
