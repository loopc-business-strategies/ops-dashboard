import ReportBrandingPreview from './ReportBrandingPreview'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function ReportSettingsPanel({
  branding,
  onChange,
  onSave,
  saving,
  error,
  status,
}) {
  const patchBranding = (patch) => onChange((prev) => ({ ...prev, ...patch }))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
        Company name, address, phone, TRN, and logo are shared from Voucher Settings and Statement Settings above.
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Entity name
            <input
              type="text"
              value={branding.entityName || ''}
              onChange={(e) => patchBranding({ entityName: e.target.value })}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Branch / unit
            <input
              type="text"
              value={branding.branchName || ''}
              onChange={(e) => patchBranding({ branchName: e.target.value })}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Legal name
            <input
              type="text"
              value={branding.legalName || ''}
              onChange={(e) => patchBranding({ legalName: e.target.value })}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
        </div>

        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Report subtitle
          <input
            type="text"
            value={branding.reportSubtitle || ''}
            onChange={(e) => patchBranding({ reportSubtitle: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>

        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Report footer
          <input
            type="text"
            value={branding.reportFooter || ''}
            onChange={(e) => patchBranding({ reportFooter: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Report signatories</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Prepared by title
            <input type="text" value={branding.preparedByTitle || ''} onChange={(e) => patchBranding({ preparedByTitle: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Prepared by name
            <input type="text" value={branding.preparedByName || ''} onChange={(e) => patchBranding({ preparedByName: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Reviewed by title
            <input type="text" value={branding.reviewedByTitle || ''} onChange={(e) => patchBranding({ reviewedByTitle: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Reviewed by name
            <input type="text" value={branding.reviewedByName || ''} onChange={(e) => patchBranding({ reviewedByName: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Authorized signatory title
            <input type="text" value={branding.approvedByTitle || ''} onChange={(e) => patchBranding({ approvedByTitle: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Authorized signatory name
            <input type="text" value={branding.approvedByName || ''} onChange={(e) => patchBranding({ approvedByName: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
        </div>
      </div>

      <ReportBrandingPreview branding={branding} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#005B96', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save report settings'}
        </button>
        {status ? <span style={{ fontSize: 13, color: '#166534' }}>{status}</span> : null}
        {error ? <span style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span> : null}
      </div>
    </div>
  )
}
