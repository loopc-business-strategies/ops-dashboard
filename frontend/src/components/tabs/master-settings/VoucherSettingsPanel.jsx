import { useState } from 'react'
import DocumentLayoutPreview from './DocumentLayoutPreview'
import DocumentLogoEditor from './DocumentLogoEditor'
import SignatoryEditor from './SignatoryEditor'
import VoucherTableHeaderEditor from './VoucherTableHeaderEditor'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function VoucherSettingsPanel({
  branding,
  onChange,
  onSave,
  saving,
  error,
  status,
}) {
  const [logoError, setLogoError] = useState('')
  const voucherPrint = branding.voucherPrint || {}

  const patchBranding = (patch) => onChange((prev) => ({ ...prev, ...patch }))
  const patchVoucherPrint = (patch) => onChange((prev) => ({
    ...prev,
    voucherPrint: { ...prev.voucherPrint, ...patch },
  }))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <DocumentLayoutPreview
        branding={branding}
        layoutSettings={voucherPrint}
        onLayoutChange={patchVoucherPrint}
        title="Payment Voucher"
        meta={[
          { label: 'PAY NO', value: 'PAY-0001' },
          { label: 'Date', value: '08-Jul-26' },
          { label: 'Prepared By', value: 'Finance Officer' },
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
        layoutSettings={voucherPrint}
        onChange={(patch) => {
          if (patch.error !== undefined) {
            setLogoError(patch.error)
            return
          }
          setLogoError('')
          patchBranding(patch)
        }}
        onLayoutChange={patchVoucherPrint}
      />

      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Table headers</h4>
        <VoucherTableHeaderEditor
          tableHeaders={voucherPrint.tableHeaders}
          onChange={(tableHeaders) => patchVoucherPrint({ tableHeaders })}
        />
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Signatories</h4>
        <SignatoryEditor
          signatories={voucherPrint.signatories || []}
          onChange={(signatories) => patchVoucherPrint({ signatories })}
        />
      </div>

      <label style={{ fontSize: 12, color: '#6B7280' }}>
        Confirmed-for label
        <input
          type="text"
          value={voucherPrint.confirmedForLabel || ''}
          onChange={(e) => patchVoucherPrint({ confirmedForLabel: e.target.value })}
          style={{ ...inputStyle, marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: 12, color: '#6B7280' }}>
        Footer note
        <textarea
          value={voucherPrint.footerNote || ''}
          onChange={(e) => patchVoucherPrint({ footerNote: e.target.value })}
          rows={2}
          style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#005B96', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save voucher settings'}
        </button>
        {status ? <span style={{ fontSize: 13, color: '#166534' }}>{status}</span> : null}
        {error ? <span style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span> : null}
        {logoError ? <span style={{ fontSize: 13, color: '#B91C1C' }}>{logoError}</span> : null}
      </div>
    </div>
  )
}
