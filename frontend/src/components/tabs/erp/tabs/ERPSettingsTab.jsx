import { ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import {
  LOGO_UPLOAD_ACCEPT,
  DEFAULT_BRANDING,
  clampBrandingDimension,
  normalizeBrandingKey,
  brandingOptionLabel,
} from '../ERPBrandingUtils'
import { buildAutoStockCode } from '../erpTabUtils'

export default function ERPSettingsTab({
  C,
  selectedBrandingKey,
  setSelectedBrandingKey,
  handleSelectBrandingProfile,
  brandingProfiles,
  brandingForm,
  setBrandingForm,
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
              <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
                <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.4rem', fontWeight: '700' }}>Logo Settings</h4>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                  Upload one company logo here. It is used automatically by vouchers, statements, report printouts, and PDF exports for the active tenant.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(3, minmax(130px, 0.7fr)) auto', gap: '0.65rem', alignItems: 'center' }}>
                  <select value={selectedBrandingKey} onChange={(e) => handleSelectBrandingProfile(e.target.value)} style={ERP_MODAL_INPUT_STYLE}>
                    {brandingProfiles.map((profile) => (
                      <option key={profile.key} value={profile.key}>{brandingOptionLabel(profile)}{profile.isDefault ? ' (Default)' : ''}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="80"
                    max="260"
                    placeholder="Width"
                    value={brandingForm.logoWidth}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <input
                    type="number"
                    min="32"
                    max="120"
                    placeholder="Height"
                    value={brandingForm.logoHeight}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  />
                  <select
                    value={brandingForm.logoFit}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoFit: e.target.value }))}
                    style={ERP_MODAL_INPUT_STYLE}
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="fill">Fill</option>
                  </select>
                  <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 0 }}>
                    Upload Logo
                    <input type="file" accept={LOGO_UPLOAD_ACCEPT} onChange={(e) => handleBrandingLogoFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  </label>
                </div>
                <p style={{ margin: '0.45rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>Supported logo files: PNG and SVG up to 3 MB.</p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                  <div style={{ width: '180px', height: '64px', border: '1px dashed #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {brandingForm.logoUrl ? <img src={brandingForm.logoUrl} alt="Current logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No logo</span>}
                  </div>
                  <button type="button" disabled={saving || !canManageAccounts} onClick={handleSaveBranding} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: canManageAccounts ? 'pointer' : 'not-allowed', opacity: canManageAccounts ? 1 : 0.65 }}>
                    {saving ? 'Saving...' : 'Save Logo Settings'}
                  </button>
                </div>
              </div>
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
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: C.ink, marginBottom: '1rem', fontWeight: '700' }}>Report Branding</h4>
                <form onSubmit={handleSaveBranding} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}`, marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(2, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <select value={selectedBrandingKey} onChange={(e) => handleSelectBrandingProfile(e.target.value)} style={ERP_MODAL_INPUT_STYLE}>
                      {brandingProfiles.map((profile) => (
                        <option key={profile.key} value={profile.key}>{brandingOptionLabel(profile)}{profile.isDefault ? ' (Default)' : ''}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Profile Key"
                      value={brandingForm.key}
                      onChange={(e) => {
                        const nextKey = normalizeBrandingKey(e.target.value)
                        setSelectedBrandingKey(nextKey)
                        setBrandingForm((prev) => ({ ...prev, key: nextKey }))
                      }}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(brandingForm.isDefault)}
                        onChange={(e) => setBrandingForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                      />
                      Set as default entity
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <button type="button" onClick={handleCreateBrandingDraft} style={{ padding: '0.45rem 0.85rem', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}>
                      + New Entity Profile
                    </button>
                    <span style={{ color: C.inkSoft, fontSize: '0.82rem', alignSelf: 'center' }}>Each profile can represent a separate legal entity, branch, or reporting unit.</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                      placeholder="Entity Name"
                      value={brandingForm.entityName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, entityName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Branch / Unit"
                      value={brandingForm.branchName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, branchName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Company Name"
                      value={brandingForm.companyName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, companyName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Legal Name"
                      value={brandingForm.legalName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, legalName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Company Address"
                      value={brandingForm.address}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, address: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Company Phone"
                      value={brandingForm.phone}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, phone: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="TRN / Tax Registration"
                      value={brandingForm.trn}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, trn: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Report Subtitle"
                      value={brandingForm.reportSubtitle}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportSubtitle: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Footer Text"
                      value={brandingForm.reportFooter}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportFooter: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', alignItems: 'start', marginBottom: '0.75rem' }}>
                    <input
                      placeholder="Logo URL or paste data URL"
                      value={brandingForm.logoUrl}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <label style={{ ...ERP_MODAL_INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 0 }}>
                      Upload Logo
                      <input
                        type="file"
                        accept={LOGO_UPLOAD_ACCEPT}
                        onChange={(e) => handleBrandingLogoFile(e.target.files?.[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <p style={{ margin: '-0.35rem 0 0.75rem', color: C.inkSoft, fontSize: '0.78rem' }}>Supported logo files: PNG and SVG up to 3 MB.</p>
                  {brandingForm.logoUrl && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                        <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Source Logo</p>
                        <img src={brandingForm.logoUrl} alt="Brand logo source" style={{ maxHeight: '72px', maxWidth: '220px', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                        <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Header Crop Result</p>
                        <div style={{ width: `${clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, border: '1px solid #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {brandingPreviewLogo ? <img src={brandingPreviewLogo} alt="Brand logo processed preview" style={{ width: '100%', height: '100%', objectFit: 'fill' }} /> : null}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input
                      type="number"
                      min="80"
                      max="260"
                      placeholder="Logo Width"
                      value={brandingForm.logoWidth}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      type="number"
                      min="32"
                      max="120"
                      placeholder="Logo Height"
                      value={brandingForm.logoHeight}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <select
                      value={brandingForm.logoFit}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoFit: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    >
                      <option value="contain">Contain</option>
                      <option value="cover">Cover / Crop</option>
                      <option value="fill">Fill / Stretch</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.p2}`, background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}>
                    <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.ink, fontWeight: '700' }}>Company Profile Preview</p>
                    <div style={{ height: '10px', background: 'var(--grad-brand)', borderRadius: '999px', marginBottom: '14px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '2px solid #111827', paddingBottom: '0.9rem', marginBottom: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
                        <p style={{ margin: '0 0 0.35rem', color: '#065F46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{brandingPreview.companyName || DEFAULT_BRANDING.companyName}</p>
                        <p style={{ margin: '0 0 0.35rem', color: '#111827', fontSize: '1.3rem', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 }}>ERP Financial Statement</p>
                        <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.entityName || DEFAULT_BRANDING.entityName}{brandingPreview.branchName ? ` / ${brandingPreview.branchName}` : ''}</p>
                        {brandingPreview.legalName ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.legalName}</p> : null}
                        {brandingPreview.address ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem', whiteSpace: 'pre-line' }}>{brandingPreview.address}</p> : null}
                        {(brandingPreview.phone || brandingPreview.trn) ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{`${brandingPreview.phone || ''}${brandingPreview.phone && brandingPreview.trn ? ' | ' : ''}${brandingPreview.trn ? `TRN: ${brandingPreview.trn}` : ''}`}</p> : null}
                        <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review</p>
                        <p style={{ margin: 0, color: '#4B5563', fontSize: '0.8rem' }}>Period: 01 Apr 2026 to 30 Apr 2026</p>
                      </div>
                      {brandingPreviewLogo ? (
                        <div style={{ width: `${clampBrandingDimension(brandingPreview.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingPreview.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, borderRadius: '0.35rem', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E5E7EB', flex: '0 0 auto' }}>
                          <img src={brandingPreviewLogo} alt="Export header preview logo" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                      <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}<br />{brandingPreview.preparedByName || DEFAULT_BRANDING.preparedByName}</div>
                      <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}<br />{brandingPreview.reviewedByName || DEFAULT_BRANDING.reviewedByName}</div>
                      <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}<br />{brandingPreview.approvedByName || DEFAULT_BRANDING.approvedByName}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: '#334155', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                      <span>{brandingPreview.companyName || DEFAULT_BRANDING.companyName} Reporting Suite</span>
                      <span>{brandingPreview.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input
                      placeholder="Prepared By Title"
                      value={brandingForm.preparedByTitle}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByTitle: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Prepared By Name"
                      value={brandingForm.preparedByName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Reviewed By Title"
                      value={brandingForm.reviewedByTitle}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByTitle: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Reviewed By Name"
                      value={brandingForm.reviewedByName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Approved By Title"
                      value={brandingForm.approvedByTitle}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByTitle: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Approved By Name"
                      value={brandingForm.approvedByName}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByName: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="submit" disabled={saving || !canManageAccounts} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: canManageAccounts ? 'pointer' : 'not-allowed', opacity: canManageAccounts ? 1 : 0.65 }}>
                      {saving ? 'Saving...' : 'Save Branding'}
                    </button>
                    <button type="button" onClick={() => setBrandingForm(reportBranding)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                      Reset Changes
                    </button>
                    <span style={{ color: C.inkSoft, fontSize: '0.82rem' }}>Use separate profiles per branch or legal entity. Uploaded logos give the most reliable PDF result.</span>
                  </div>
                </form>
              </div>
              <div style={{ background: C.p1, padding: '1.5rem', borderRadius: '0.5rem', borderLeft: `4px solid ${C.s1}` }}>
                <h4 style={{ color: C.t1, marginBottom: '1rem', fontWeight: '600' }}>📋 System Information</h4>
                <ul style={{ color: C.t2, fontSize: '0.875rem', listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Central Ledger System: Every transaction creates one ledger entry</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Auto Journal Logic: Debit/Credit pairs auto-populated based on mappings</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Role-Based Access: Finance and Super Admin only</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Multi-Currency: configurable base currency and exchange rates</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Reports: Trial Balance, Ledger, and Dashboard all from ledger data</li>
                </ul>
              </div>
            </div>
  )
}
