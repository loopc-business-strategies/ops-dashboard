import { useMemo, useState } from 'react'
import DocumentLayoutPreview from './DocumentLayoutPreview'
import DocumentLogoEditor from './DocumentLogoEditor'
import LogoSizeSlider from './LogoSizeSlider'
import SignatoryEditor from './SignatoryEditor'
import VoucherTableHeaderEditor from './VoucherTableHeaderEditor'
import VoucherPreviewModal from '../voucher/VoucherPreviewModal'
import VoucherPrintPanel from '../voucher/VoucherPrintPanel'
import {
  VOUCHER_PREVIEW_TYPES,
  buildVoucherPreviewPrintModel,
} from '../voucher/voucherPreviewSamples'
import { applyDocumentLogoPatch } from './documentLogoChange'
import { resolveErpUserTenantKey } from '../erp/resolveErpUserTenant'

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
  user = null,
}) {
  const [logoError, setLogoError] = useState('')
  const [previewVoucherType, setPreviewVoucherType] = useState('payment')
  const [previewDataMode, setPreviewDataMode] = useState('empty')
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const voucherPrint = branding.voucherPrint || {}
  const isLoopcTenant = resolveErpUserTenantKey(user) === 'loopc'

  const patchBranding = (patch) => onChange((prev) => ({ ...prev, ...patch }))
  const patchVoucherPrint = (patch) => onChange((prev) => ({
    ...prev,
    voucherPrint: { ...prev.voucherPrint, ...patch },
  }))

  const previewPrintModel = useMemo(() => buildVoucherPreviewPrintModel({
    mode: previewDataMode,
    voucherType: previewVoucherType,
    branding,
    user,
  }), [previewDataMode, previewVoucherType, branding, user])

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

      <LogoSizeSlider
        branding={branding}
        onChange={patchBranding}
        disabled={!branding.logoUrl}
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
        onChange={(patch) => applyDocumentLogoPatch(patch, { setLogoError, patchBranding })}
        onLayoutChange={patchVoucherPrint}
        enableAutoLogoCleanup={isLoopcTenant}
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

      <section style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Full voucher preview</h4>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280' }}>
          Preview the complete voucher layout with empty or sample data. Changes update live before saving.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
            Type
            <select
              value={previewVoucherType}
              onChange={(e) => setPreviewVoucherType(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #D1D5DB' }}
            >
              {VOUCHER_PREVIEW_TYPES.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
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
          maxHeight: 420,
          overflow: 'auto',
        }}
        >
          <VoucherPrintPanel printModel={previewPrintModel} renderMode="preview" />
        </div>
      </section>

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

      <VoucherPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        mode="settings"
        voucherType={previewVoucherType}
        previewMode={previewDataMode}
        printModel={previewPrintModel}
        onVoucherTypeChange={setPreviewVoucherType}
        onPreviewModeChange={setPreviewDataMode}
      />
    </div>
  )
}
