import { useEffect, useState } from 'react'
import { ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import { buildAutoStockCode } from '../erpTabUtils'
import ERPBrandingSettingsSection from './ERPBrandingSettingsSection'
import { useAuth } from '../../../../context/AuthContext'
import { isVoucher24HourLockEnabled } from '../../../../config/tenantBranding'
import { canManageAccountingPeriods } from '../accessPolicy'
import erpAccountingAPI from '../../../../api/erp-accounting'

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
  const { token, user } = useAuth()
  const lock24hFeature = isVoucher24HourLockEnabled(user?.company)
  const canManageLock = canManageAccountingPeriods(user)
  const [lock24hEnabled, setLock24hEnabled] = useState(true)
  const [lock24hLoading, setLock24hLoading] = useState(false)
  const [lock24hSaving, setLock24hSaving] = useState(false)
  const [lock24hError, setLock24hError] = useState('')
  const [lock24hNotice, setLock24hNotice] = useState('')

  useEffect(() => {
    if (!lock24hFeature || !token) return undefined
    let cancelled = false
    setLock24hLoading(true)
    setLock24hError('')
    erpAccountingAPI.getAccountingControls(token)
      .then((data) => {
        if (cancelled) return
        setLock24hEnabled(data?.voucher24HourLockEnabled !== false)
      })
      .catch((err) => {
        if (cancelled) return
        setLock24hError(err?.response?.data?.message || 'Failed to load accounting controls')
      })
      .finally(() => {
        if (!cancelled) setLock24hLoading(false)
      })
    return () => { cancelled = true }
  }, [lock24hFeature, token])

  const handleToggle24hLock = async () => {
    if (!canManageLock || lock24hSaving) return
    const next = !lock24hEnabled
    setLock24hSaving(true)
    setLock24hError('')
    setLock24hNotice('')
    try {
      const data = await erpAccountingAPI.updateAccountingControls(token, {
        voucher24HourLockEnabled: next,
      })
      setLock24hEnabled(data?.voucher24HourLockEnabled !== false)
      setLock24hNotice(next
        ? '24-Hour Voucher / JV Lock is ON for this company.'
        : '24-Hour Voucher / JV Lock is OFF for this company. Period closing still applies.')
    } catch (err) {
      setLock24hError(err?.response?.data?.message || 'Failed to update setting')
    } finally {
      setLock24hSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Settings</h3>
      </div>

      {masterDocumentSettingsEnabled ? (
        <div style={{ marginBottom: '1.25rem', background: 'var(--brand-soft)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--brand-border)' }}>
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

      {lock24hFeature && (
        <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
          <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.35rem', fontWeight: '700' }}>ACCOUNTING CONTROLS</h4>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px' }}>
              <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: 700, fontSize: '0.95rem' }}>
                24-Hour Voucher / JV Lock
              </p>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem', lineHeight: 1.45 }}>
                Automatically locks vouchers and journal entries 24 hours after creation.
                After the 24-hour period expires, the entry becomes view-only and cannot be edited or deleted.
                Only Super Admin can change this setting. Period closing still applies when this is OFF.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle24hLock}
              disabled={!canManageLock || lock24hLoading || lock24hSaving}
              aria-pressed={lock24hEnabled}
              style={{
                minWidth: 72,
                height: 36,
                borderRadius: 999,
                border: 'none',
                cursor: canManageLock ? 'pointer' : 'not-allowed',
                fontWeight: 800,
                fontSize: '0.8rem',
                color: '#fff',
                background: lock24hEnabled ? '#15803d' : '#94a3b8',
                opacity: lock24hLoading || lock24hSaving ? 0.7 : 1,
              }}
            >
              {lock24hLoading ? '…' : (lock24hEnabled ? 'ON' : 'OFF')}
            </button>
          </div>
          {!canManageLock && (
            <p style={{ margin: '0.65rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>
              View only — Super Admin required to change this setting.
            </p>
          )}
          {lock24hError && (
            <p style={{ margin: '0.65rem 0 0', color: '#b91c1c', fontSize: '0.8rem' }}>{lock24hError}</p>
          )}
          {lock24hNotice && (
            <p style={{ margin: '0.65rem 0 0', color: '#166534', fontSize: '0.8rem' }}>{lock24hNotice}</p>
          )}
        </div>
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
