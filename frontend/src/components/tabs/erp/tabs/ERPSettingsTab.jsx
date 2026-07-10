import { ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import { buildAutoStockCode } from '../erpTabUtils'
import ERPBrandingSettingsSection from './ERPBrandingSettingsSection'

export default function ERPSettingsTab({
  C,
  masterDocumentSettingsEnabled = false,
  selectedBrandingKey,
  setSelectedBrandingKey,
  handleSelectBrandingProfile,
  brandingProfiles,
  brandingForm,
  setBrandingForm,
  reportBranding,
  handleBrandingLogoFile,
  saving,
  canManageAccounts,
  handleSaveBranding,
  inventoryStockCodeSettings,
  setInventoryStockCodeSettings,
  handleCreateBrandingDraft,
  brandingPreviewLogo,
  brandingPreview,
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Settings</h3>
      </div>

      {masterDocumentSettingsEnabled ? (
        <div style={{ marginBottom: '1.25rem', background: '#EFF6FF', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #BFDBFE' }}>
          <p style={{ margin: 0, color: '#1E3A8A', fontSize: '0.875rem' }}>
            Branding for vouchers, statements, and financial reports is configured in <strong>Master Settings</strong>.
          </p>
        </div>
      ) : (
        <ERPBrandingSettingsSection
          C={C}
          selectedBrandingKey={selectedBrandingKey}
          setSelectedBrandingKey={setSelectedBrandingKey}
          handleSelectBrandingProfile={handleSelectBrandingProfile}
          brandingProfiles={brandingProfiles}
          brandingForm={brandingForm}
          setBrandingForm={setBrandingForm}
          reportBranding={reportBranding}
          handleBrandingLogoFile={handleBrandingLogoFile}
          saving={saving}
          canManageAccounts={canManageAccounts}
          handleSaveBranding={handleSaveBranding}
          handleCreateBrandingDraft={handleCreateBrandingDraft}
          brandingPreviewLogo={brandingPreviewLogo}
          brandingPreview={brandingPreview}
        />
      )}

      <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
        <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.4rem', fontWeight: '700' }}>Inventory Stock Code Format</h4>
        <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
          Configure auto stock-code format used in ERP Inventory mapping.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
          <select
            value={inventoryStockCodeSettings.format}
            onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, format: e.target.value }))}
            style={ERP_MODAL_INPUT_STYLE}
          >
            <option value="metal-purity">GOLD-9999</option>
            <option value="prefix-metal-purity">RM-GOLD-9999</option>
          </select>
          <input
            placeholder="Prefix"
            value={inventoryStockCodeSettings.prefix}
            onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
            disabled={inventoryStockCodeSettings.format !== 'prefix-metal-purity'}
            style={inventoryStockCodeSettings.format !== 'prefix-metal-purity' ? { ...ERP_MODAL_INPUT_STYLE, background: '#F8FAFC', color: C.inkSoft } : ERP_MODAL_INPUT_STYLE}
          />
        </div>
        <p style={{ margin: '0.6rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
          Preview: {buildAutoStockCode({ mainStock: 'gold', customMainStock: '', metalType: 'gold', purity: '999.9' }, inventoryStockCodeSettings)}
        </p>
      </div>

      <div style={{ background: C.p1, padding: '1.5rem', borderRadius: '0.5rem', borderLeft: `4px solid ${C.s1}` }}>
        <h4 style={{ color: C.t1, marginBottom: '1rem', fontWeight: '600' }}>System Information</h4>
        <ul style={{ color: C.t2, fontSize: '0.875rem', listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '0.5rem' }}>Central Ledger System: Every transaction creates one ledger entry</li>
          <li style={{ marginBottom: '0.5rem' }}>Auto Journal Logic: Debit/Credit pairs auto-populated based on mappings</li>
          <li style={{ marginBottom: '0.5rem' }}>Role-Based Access: Finance and Super Admin only</li>
          <li style={{ marginBottom: '0.5rem' }}>Multi-Currency: configurable base currency and exchange rates</li>
          <li style={{ marginBottom: '0.5rem' }}>Reports: Trial Balance, Ledger, and Dashboard all from ledger data</li>
        </ul>
      </div>
    </div>
  )
}
