import { useCallback, useEffect, useState } from 'react'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  previewReportDigest,
  sendReportDigest,
} from '../../api/notifications'
import {
  ensureWebPushSubscription,
  isWebPushAvailable,
} from '../../utils/webPushRegister'
import { useAuth } from '../../context/AuthContext'
import { isMasterDocumentSettingsEnabled } from '../../config/tenantBranding'
import { useReportBrandingSettings } from './master-settings/useReportBrandingSettings'
import MasterSettingsSectionModal from './master-settings/MasterSettingsSectionModal'
import VoucherSettingsPanel from './master-settings/VoucherSettingsPanel'
import StatementSettingsPanel from './master-settings/StatementSettingsPanel'
import ReportSettingsPanel from './master-settings/ReportSettingsPanel'

const UI = {
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '1.1rem 1.2rem' },
  ink: '#1C2A33',
  muted: '#6B7280',
  primary: '#005B96',
  border: '#E5E7EB',
}

const TOPIC_GROUPS = [
  {
    title: 'Vouchers',
    topics: [
      { key: 'voucher_submitted', label: 'Submitted', desc: 'When a voucher is submitted for approval.' },
      { key: 'voucher_approved', label: 'Approved', desc: 'When a voucher is approved.' },
      { key: 'voucher_posted', label: 'Posted', desc: 'When a voucher is posted to the ledger.' },
      { key: 'voucher_returned', label: 'Returned', desc: 'When a voucher is returned for revision.' },
      { key: 'voucher_rejected', label: 'Rejected', desc: 'When a voucher is rejected.' },
    ],
  },
  {
    title: 'Journal vouchers',
    topics: [
      { key: 'jv_posted', label: 'JV / Bank JV posted', desc: 'When a manual journal or bank JV is posted.' },
    ],
  },
  {
    title: 'Due & overdue',
    topics: [
      { key: 'task_due', label: 'Tasks due today', desc: 'Daily reminder for tasks due today.' },
      { key: 'task_overdue', label: 'Tasks overdue', desc: 'Daily reminder for overdue tasks.' },
      { key: 'vendor_due', label: 'Vendor payments due', desc: 'Vendor payments due soon.' },
      { key: 'vendor_overdue', label: 'Vendor payments overdue', desc: 'Overdue vendor payments.' },
    ],
  },
  {
    title: 'Chat',
    topics: [
      { key: 'chat_message', label: 'Chat messages', desc: 'New chat and DM messages.' },
      { key: 'chat_mention', label: 'Mentions', desc: 'When someone mentions you in chat.' },
    ],
  },
  {
    title: 'Reports & alerts',
    topics: [
      { key: 'report_digest', label: 'Daily report digest', desc: 'Scheduled and on-demand report summaries.' },
      { key: 'gold_price_alert', label: 'Gold price alerts', desc: 'When gold price moves significantly.' },
      { key: 'low_stock', label: 'Low stock', desc: 'Inventory low-stock alerts.' },
    ],
  },
]

function SwitchToggle({ checked, onChange, label, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0', borderBottom: `1px solid ${UI.border}` }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: UI.ink }}>{label}</p>
        {desc && <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: UI.muted }}>{desc}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={checked}
        style={{ width: 44, height: 24, borderRadius: 999, border: 'none', background: checked ? UI.primary : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
      </button>
    </div>
  )
}

export default function MasterSettingsTab() {
  const { token, user, company } = useAuth()
  const tenantKey = String(user?.company || company?.key || company || '').trim().toLowerCase()
  const documentSettingsEnabled = isMasterDocumentSettingsEnabled(tenantKey)

  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState('')
  const [webPushMsg, setWebPushMsg] = useState('')
  const [webPushAvailable, setWebPushAvailable] = useState(false)
  const [activeSection, setActiveSection] = useState(null)

  const {
    branding,
    setBranding,
    loading: brandingLoading,
    saving: brandingSaving,
    error: brandingError,
    status: brandingStatus,
    save: saveBranding,
  } = useReportBrandingSettings({ token, enabled: documentSettingsEnabled })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotificationPreferences()
      setPrefs(data.notificationPreferences)
    } catch (e) {
      setStatus(e?.response?.data?.message || e.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    void isWebPushAvailable().then(setWebPushAvailable)
  }, [])

  const persist = useCallback(async (next) => {
    setSaving(true)
    setStatus('')
    try {
      const data = await updateNotificationPreferences(next)
      setPrefs(data.notificationPreferences)
      setStatus('Saved')
    } catch (e) {
      setStatus(e?.response?.data?.message || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [])

  const toggleTopic = (key) => {
    if (!prefs) return
    const next = {
      ...prefs,
      topics: { ...prefs.topics, [key]: !prefs.topics[key] },
    }
    setPrefs(next)
    void persist(next)
  }

  const toggleDigestFlag = (key) => {
    if (!prefs) return
    const next = {
      ...prefs,
      reportDigest: { ...prefs.reportDigest, [key]: !prefs.reportDigest[key] },
    }
    setPrefs(next)
    void persist(next)
  }

  const setDigestTime = (timeLocal) => {
    if (!prefs) return
    const next = { ...prefs, reportDigest: { ...prefs.reportDigest, timeLocal } }
    setPrefs(next)
    void persist(next)
  }

  const toggleDigestEnabled = () => {
    if (!prefs) return
    const next = {
      ...prefs,
      reportDigest: { ...prefs.reportDigest, enabled: !prefs.reportDigest.enabled },
    }
    setPrefs(next)
    void persist(next)
  }

  const runPreview = async () => {
    setStatus('')
    try {
      const data = await previewReportDigest()
      setPreview(data.text || '')
    } catch (e) {
      setStatus(e?.response?.data?.message || e.message || 'Preview failed')
    }
  }

  const runSend = async () => {
    setStatus('')
    try {
      const data = await sendReportDigest()
      setPreview(data.text || '')
      setStatus('Report sent to your devices')
    } catch (e) {
      setStatus(e?.response?.data?.message || e.message || 'Send failed')
    }
  }

  const enableWebPush = async () => {
    setWebPushMsg('')
    const result = await ensureWebPushSubscription()
    if (result.ok) {
      setWebPushMsg('Browser notifications enabled (if permission was granted).')
      return
    }
    const reasons = {
      'not-configured': 'Web push is not configured on the API (WEB_PUSH_PUBLIC_KEY).',
      'permission-denied': 'Notification permission was denied in the browser.',
      unsupported: 'This browser does not support Web Push.',
      'insecure-context': 'Web Push requires HTTPS.',
    }
    setWebPushMsg(reasons[result.reason] || result.reason || 'Could not enable browser notifications')
  }

  if (loading || !prefs || (documentSettingsEnabled && brandingLoading)) {
    return (
      <div style={{ padding: 24, color: UI.muted }}>Loading Master Settings…</div>
    )
  }

  const closeSection = () => setActiveSection(null)

  const renderSettingsLauncher = (title, sectionId, description) => (
    <section style={UI.card}>
      <button
        type="button"
        onClick={() => setActiveSection(sectionId)}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          color: UI.ink,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 18, color: UI.muted, lineHeight: 1 }} aria-hidden>›</span>
      </button>
      <p style={{ margin: '8px 0 0', color: UI.muted, fontSize: 13 }}>{description}</p>
    </section>
  )

  const renderNotificationSettings = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {TOPIC_GROUPS.map((group) => (
        <section key={group.title} style={UI.card}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: UI.ink }}>{group.title}</h3>
          {group.topics.map((topic) => (
            <SwitchToggle
              key={topic.key}
              checked={prefs.topics[topic.key] !== false}
              onChange={() => toggleTopic(topic.key)}
              label={topic.label}
              desc={topic.desc}
            />
          ))}
        </section>
      ))}

      <section style={UI.card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: UI.ink }}>Report digest schedule</h3>
        <SwitchToggle
          checked={prefs.reportDigest.enabled !== false}
          onChange={toggleDigestEnabled}
          label="Enable scheduled digest"
          desc="Sends once per day at the time below (your timezone)."
        />
        <label style={{ display: 'block', marginTop: 12, fontSize: 13, color: UI.muted }}>
          Time (local)
          <input
            type="time"
            value={String(prefs.reportDigest.timeLocal || '08:00').slice(0, 5)}
            onChange={(e) => setDigestTime(e.target.value)}
            style={{ display: 'block', marginTop: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${UI.border}`, width: 140 }}
          />
        </label>
        <SwitchToggle checked={prefs.reportDigest.includeExpensesToday !== false} onChange={() => toggleDigestFlag('includeExpensesToday')} label="Expenses today" />
        <SwitchToggle checked={prefs.reportDigest.includeSalesToday !== false} onChange={() => toggleDigestFlag('includeSalesToday')} label="Sales / receipts today" />
        <SwitchToggle checked={prefs.reportDigest.includeBankCashBalance !== false} onChange={() => toggleDigestFlag('includeBankCashBalance')} label="Bank & cash balance" />
        <SwitchToggle checked={prefs.reportDigest.includeGoldPrice !== false} onChange={() => toggleDigestFlag('includeGoldPrice')} label="Gold price" />
      </section>

      <section style={UI.card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: UI.ink }}>Send report now</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: UI.muted }}>Preview or push the digest to your bell and mobile/browser.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void runPreview()} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: UI.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Preview
          </button>
          <button type="button" onClick={() => void runSend()} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${UI.primary}`, background: '#fff', color: UI.primary, fontWeight: 700, cursor: 'pointer' }}>
            Send now
          </button>
        </div>
        {preview && (
          <pre style={{ marginTop: 12, padding: 12, background: '#F8FAFC', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', color: UI.ink }}>
            {preview}
          </pre>
        )}
      </section>

      <section style={UI.card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: UI.ink }}>Web push (browser)</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: UI.muted }}>
          {webPushAvailable
            ? 'Enable notifications in this browser for alerts when the tab is in the background.'
            : 'Web push is not configured on this deployment (API WEB_PUSH_PUBLIC_KEY or VITE_WEB_PUSH_PUBLIC_KEY).'}
        </p>
        {webPushAvailable && (
          <button type="button" onClick={() => void enableWebPush()} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: UI.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Enable browser notifications
          </button>
        )}
        {webPushMsg && <p style={{ marginTop: 8, fontSize: 13, color: UI.ink }}>{webPushMsg}</p>}
      </section>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div>
        <h2 style={{ margin: 0, color: UI.ink, fontSize: 22, fontWeight: 800 }}>Master Settings</h2>
        <p style={{ margin: '6px 0 0', color: UI.muted, fontSize: 14 }}>
          Notification topics, voucher, statement, and financial report branding, digest schedule, and browser push preferences.
        </p>
      </div>

      {documentSettingsEnabled && renderSettingsLauncher(
        'Voucher Settings',
        'voucher',
        'Logo, company details, table headers, and signatories for all voucher prints.',
      )}

      {documentSettingsEnabled && renderSettingsLauncher(
        'Statement Settings',
        'statement',
        'Logo, company details, and signatories for Account Summary statement print and preview.',
      )}

      {documentSettingsEnabled && renderSettingsLauncher(
        'Report Settings',
        'report',
        'Entity details, report subtitle/footer, and signatories for P&L and financial report exports.',
      )}

      {renderSettingsLauncher(
        'Notification Settings',
        'notification',
        'Open to view all notification topics, digest schedule, and web push options.',
      )}

      {(status || saving) && (
        <p style={{ fontSize: 13, color: saving ? UI.muted : UI.ink }}>{saving ? 'Saving…' : status}</p>
      )}

      <MasterSettingsSectionModal
        open={activeSection === 'voucher'}
        onClose={closeSection}
        title="Voucher Settings"
        wide
      >
        <VoucherSettingsPanel
          branding={branding}
          onChange={setBranding}
          onSave={saveBranding}
          saving={brandingSaving}
          error={brandingError}
          status={brandingStatus}
          user={user}
        />
      </MasterSettingsSectionModal>

      <MasterSettingsSectionModal
        open={activeSection === 'statement'}
        onClose={closeSection}
        title="Statement Settings"
        wide
      >
        <StatementSettingsPanel
          branding={branding}
          onChange={setBranding}
          onSave={saveBranding}
          saving={brandingSaving}
          error={brandingError}
          status={brandingStatus}
          user={user}
        />
      </MasterSettingsSectionModal>

      <MasterSettingsSectionModal
        open={activeSection === 'report'}
        onClose={closeSection}
        title="Report Settings"
      >
        <ReportSettingsPanel
          branding={branding}
          onChange={setBranding}
          onSave={saveBranding}
          saving={brandingSaving}
          error={brandingError}
          status={brandingStatus}
        />
      </MasterSettingsSectionModal>

      <MasterSettingsSectionModal
        open={activeSection === 'notification'}
        onClose={closeSection}
        title="Notification Settings"
      >
        {renderNotificationSettings()}
      </MasterSettingsSectionModal>
    </div>
  )
}
