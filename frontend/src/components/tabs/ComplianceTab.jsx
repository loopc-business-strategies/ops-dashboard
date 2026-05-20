import { useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import complianceAPI from '../../api/compliance'
import { ErpSubTabButton, ModulePageHeading, ModuleTabColumn } from '../layout/ModuleTabChrome'

const C = {
  bg: '#f4f7f6',
  card: '#ffffff',
  border: 'rgba(0, 104, 74, 0.14)',
  borderStrong: 'rgba(0, 104, 74, 0.26)',
  primary: 'var(--purple)',
  text: '#1b2a33',
  sub: '#4d5f6d',
  muted: '#7b8b97',
  red: '#cc3a3a',
  amber: '#b38310',
  blue: '#1662c4',
}

function getComplianceTabs(t) {
  return [
    { id: 'eligibility', label: t('eligibilityStatus') },
    { id: 'approvals',   label: t('approvalsTracker') },
    { id: 'docs',        label: t('documentation') },
    { id: 'updates',     label: t('regulatoryUpdates') },
    { id: 'agreements',  label: t('agreements') },
  ]
}

const INIT_ELIGIBILITY = [
  { id: 'EL-1001', entity: 'Factory Site A', permit: 'Operating License', status: 'Eligible', lastReview: '2026-03-15', owner: 'Gov Team', notes: 'All prerequisites validated' },
  { id: 'EL-1002', entity: 'Export Unit B', permit: 'Export Clearance', status: 'Under Review', lastReview: '2026-04-03', owner: 'Compliance Ops', notes: 'Awaiting customs confirmation' },
]

const INIT_APPROVALS = [
  { id: 'AP-1101', authority: 'Trade Authority', filing: 'Quarterly Production Return', dueDate: '2026-04-25', submittedDate: '2026-04-17', status: 'Submitted', refNo: 'TA-APR-6628' },
  { id: 'AP-1102', authority: 'Customs', filing: 'Precious Metals Export Notice', dueDate: '2026-04-30', submittedDate: '—', status: 'Pending', refNo: '—' },
]

const INIT_DOCS = [
  { id: 'DC-2101', name: 'Environmental Compliance Certificate', category: 'Certificate', owner: 'Compliance Ops', version: 'v2', expiry: '2026-11-15', status: 'Active' },
  { id: 'DC-2102', name: 'Site Safety Registration', category: 'Registration', owner: 'Gov Team', version: 'v1', expiry: '2026-07-01', status: 'Expiring Soon' },
]

const INIT_UPDATES = [
  { id: 'RU-3101', title: 'New assay reporting format', source: 'Mining Regulator Circular 17', effective: '2026-05-01', impact: 'Medium', actionOwner: 'Compliance Ops', status: 'In Progress' },
  { id: 'RU-3102', title: 'Transport chain-of-custody logs mandatory', source: 'Customs Bulletin 4/2026', effective: '2026-06-01', impact: 'High', actionOwner: 'Operations', status: 'Planned' },
]

const INIT_AGREEMENTS = [
  { id: 'AG-4101', partner: 'National Refinery Board', type: 'Supply Compliance Agreement', start: '2025-07-01', end: '2026-06-30', value: 480000, status: 'Active' },
  { id: 'AG-4102', partner: 'Precious Metals Council', type: 'Audit Cooperation MoU', start: '2025-01-15', end: '2026-05-15', value: 120000, status: 'Renewal Required' },
]

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>
}

function Button({ children, onClick, variant = 'primary', disabled = false }) {
  const style = variant === 'primary'
    ? { background: C.primary, color: '#fff', border: '1px solid transparent' }
    : { background: '#fff', color: C.text, border: `1px solid ${C.borderStrong}` }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...style,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Modal({ open, title, onClose, children, width = 760 }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 14, border: `1px solid ${C.borderStrong}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  )
}

function badgeStyle(status) {
  if (status === 'Eligible' || status === 'Approved' || status === 'Active' || status === 'Implemented' || status === 'Submitted') return { bg: 'rgba(34,197,94,0.16)', c: '#1e8f4d' }
  if (status === 'Under Review' || status === 'In Progress' || status === 'Expiring Soon') return { bg: 'rgba(234,179,8,0.2)', c: '#996b07' }
  if (status === 'Pending' || status === 'Planned' || status === 'Renewal Required') return { bg: 'rgba(59,130,246,0.16)', c: '#1d5fb7' }
  return { bg: 'rgba(100,116,139,0.15)', c: '#526074' }
}

function Badge({ children }) {
  const b = badgeStyle(children)
  return <span style={{ background: b.bg, color: b.c, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

function Money(n) {
  return `$${Number(n || 0).toLocaleString()}`
}

function metric(label, value, accent = C.primary) {
  return (
    <Card style={{ padding: 12 }}>
      <div style={{ color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ color: accent, fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </Card>
  )
}

function RowActions({ canEdit, onEdit, onDelete, extra }) {
  if (!canEdit && !extra) return <span style={{ color: C.muted }}>—</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      {extra}
      {canEdit && <button onClick={onEdit} style={{ border: 'none', background: 'transparent', color: C.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>}
      {canEdit && <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Del</button>}
    </div>
  )
}

function ComplianceTab() {
  const { user, token } = useAuth()
  const perms = usePermissions()
  const { t } = useLanguage()
  const TABS = useMemo(() => getComplianceTabs(t), [t])
  const USE_SEED_DATA = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [tab, setTab] = useState('eligibility')
  const [toast, setToast] = useState('')
  const [eligibility, setEligibility] = useState(USE_SEED_DATA ? INIT_ELIGIBILITY : [])
  const [approvals, setApprovals] = useState(USE_SEED_DATA ? INIT_APPROVALS : [])
  const [docs, setDocs] = useState(USE_SEED_DATA ? INIT_DOCS : [])
  const [updates, setUpdates] = useState(USE_SEED_DATA ? INIT_UPDATES : [])
  const [agreements, setAgreements] = useState(USE_SEED_DATA ? INIT_AGREEMENTS : [])

  const [eModal, setEModal] = useState({ open: false, editId: '' })
  const [aModal, setAModal] = useState({ open: false, editId: '' })
  const [dModal, setDModal] = useState({ open: false, editId: '' })
  const [uModal, setUModal] = useState({ open: false, editId: '' })
  const [gModal, setGModal] = useState({ open: false, editId: '' })

  const [eForm, setEForm] = useState({ entity: '', permit: '', status: 'Eligible', lastReview: '', owner: '', notes: '' })
  const [aForm, setAForm] = useState({ authority: '', filing: '', dueDate: '', submittedDate: '—', status: 'Pending', refNo: '—' })
  const [dForm, setDForm] = useState({ name: '', category: 'Certificate', owner: '', version: 'v1', expiry: '', status: 'Active' })
  const [uForm, setUForm] = useState({ title: '', source: '', effective: '', impact: 'Medium', actionOwner: '', status: 'Planned' })
  const [gForm, setGForm] = useState({ partner: '', type: '', start: '', end: '', value: '', status: 'Active' })
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const norm = rows => (rows || []).map(r => ({ ...r, id: r._id?.toString() || r.id }))
    Promise.all([
      complianceAPI.eligibility.list(),
      complianceAPI.approvals.list(),
      complianceAPI.docs.list(),
      complianceAPI.updates.list(),
      complianceAPI.agreements.list(),
    ]).then(([els, apps, ds, ups, ags]) => {
      if (cancelled) return
      if (els.length)  setEligibility(norm(els))
      if (apps.length) setApprovals(norm(apps))
      if (ds.length)   setDocs(norm(ds))
      if (ups.length)  setUpdates(norm(ups))
      if (ags.length)  setAgreements(norm(ags))
      loadedRef.current = true
    }).catch(() => { loadedRef.current = true })
    return () => { cancelled = true }
  }, [token])

  const inGovTeam = user?.department === 'government'
  const canEdit = perms.isSuperAdmin || ((perms.isDepartmentHead || perms.isDepartmentUser) && inGovTeam)
  const readOnlyByRole = perms.isReadOnly || !canEdit

  const kpi = useMemo(() => {
    const pendingApprovals = approvals.filter(a => a.status === 'Pending').length
    const expiringDocs = docs.filter(d => d.status === 'Expiring Soon').length
    const highImpact = updates.filter(u => u.impact === 'High').length
    const renewals = agreements.filter(g => g.status === 'Renewal Required').length
    return { pendingApprovals, expiringDocs, highImpact, renewals }
  }, [agreements, approvals, docs, updates])

  function pushToast(text) {
    setToast(text)
    window.clearTimeout(pushToast.t)
    pushToast.t = window.setTimeout(() => setToast(''), 2200)
  }

  function nextId(prefix, rows) {
    return `${prefix}-${1000 + rows.length + 1}`
  }

  function removeRow(setter, rows, id, label) {
    if (!window.confirm(`Delete ${label}?`)) return
    setter(rows.filter(r => r.id !== id))
    // delete from API using id (= _id.toString())
    pushToast(`${label} deleted`)
  }

  function removeRowApi(setter, rows, id, label, apiResource) {
    if (!window.confirm(`Delete ${label}?`)) return
    setter(rows.filter(r => r.id !== id))
    if (id) apiResource.remove(id).catch(() => { pushToast('Delete failed. Please try again.') })
    pushToast(`${label} deleted`)
  }

  function openEligibility(row) {
    if (row) {
      setEModal({ open: true, editId: row.id })
      setEForm({ entity: row.entity, permit: row.permit, status: row.status, lastReview: row.lastReview, owner: row.owner, notes: row.notes })
      return
    }
    setEModal({ open: true, editId: '' })
    setEForm({ entity: '', permit: '', status: 'Eligible', lastReview: '', owner: '', notes: '' })
  }

  function saveEligibility() {
    if (!eForm.entity.trim() || !eForm.permit.trim()) return
    if (eModal.editId) {
      setEligibility(prev => prev.map(r => r.id === eModal.editId ? { ...r, ...eForm } : r))
      complianceAPI.eligibility.update(eModal.editId, eForm).catch(() => { pushToast('Save failed. Please try again.') })
      pushToast('Eligibility updated')
    } else {
      complianceAPI.eligibility.create(eForm).then(doc => {
        setEligibility(prev => [{ ...doc, id: doc._id?.toString() || doc.id }, ...prev])
      }).catch(() => setEligibility(prev => [{ id: nextId('EL', prev), ...eForm }, ...prev]))
      pushToast('Eligibility added')
    }
    setEModal({ open: false, editId: '' })
  }

  function openApproval(row) {
    if (row) {
      setAModal({ open: true, editId: row.id })
      setAForm({ authority: row.authority, filing: row.filing, dueDate: row.dueDate, submittedDate: row.submittedDate, status: row.status, refNo: row.refNo })
      return
    }
    setAModal({ open: true, editId: '' })
    setAForm({ authority: '', filing: '', dueDate: '', submittedDate: '—', status: 'Pending', refNo: '—' })
  }

  function saveApproval() {
    if (!aForm.authority.trim() || !aForm.filing.trim()) return
    if (aModal.editId) {
      setApprovals(prev => prev.map(r => r.id === aModal.editId ? { ...r, ...aForm } : r))
      complianceAPI.approvals.update(aModal.editId, aForm).catch(() => { pushToast('Save failed. Please try again.') })
      pushToast('Approval updated')
    } else {
      complianceAPI.approvals.create(aForm).then(doc => {
        setApprovals(prev => [{ ...doc, id: doc._id?.toString() || doc.id }, ...prev])
      }).catch(() => setApprovals(prev => [{ id: nextId('AP', prev), ...aForm }, ...prev]))
      pushToast('Approval filing added')
    }
    setAModal({ open: false, editId: '' })
  }

  function openDoc(row) {
    if (row) {
      setDModal({ open: true, editId: row.id })
      setDForm({ name: row.name, category: row.category, owner: row.owner, version: row.version, expiry: row.expiry, status: row.status })
      return
    }
    setDModal({ open: true, editId: '' })
    setDForm({ name: '', category: 'Certificate', owner: '', version: 'v1', expiry: '', status: 'Active' })
  }

  function saveDoc() {
    if (!dForm.name.trim()) return
    if (dModal.editId) {
      setDocs(prev => prev.map(r => r.id === dModal.editId ? { ...r, ...dForm } : r))
      complianceAPI.docs.update(dModal.editId, dForm).catch(() => { pushToast('Save failed. Please try again.') })
      pushToast('Document updated')
    } else {
      complianceAPI.docs.create(dForm).then(doc => {
        setDocs(prev => [{ ...doc, id: doc._id?.toString() || doc.id }, ...prev])
      }).catch(() => setDocs(prev => [{ id: nextId('DC', prev), ...dForm }, ...prev]))
      pushToast('Document added')
    }
    setDModal({ open: false, editId: '' })
  }

  function openUpdate(row) {
    if (row) {
      setUModal({ open: true, editId: row.id })
      setUForm({ title: row.title, source: row.source, effective: row.effective, impact: row.impact, actionOwner: row.actionOwner, status: row.status })
      return
    }
    setUModal({ open: true, editId: '' })
    setUForm({ title: '', source: '', effective: '', impact: 'Medium', actionOwner: '', status: 'Planned' })
  }

  function saveUpdate() {
    if (!uForm.title.trim() || !uForm.source.trim()) return
    if (uModal.editId) {
      setUpdates(prev => prev.map(r => r.id === uModal.editId ? { ...r, ...uForm } : r))
      complianceAPI.updates.update(uModal.editId, uForm).catch(() => { pushToast('Save failed. Please try again.') })
      pushToast('Regulatory update edited')
    } else {
      complianceAPI.updates.create(uForm).then(doc => {
        setUpdates(prev => [{ ...doc, id: doc._id?.toString() || doc.id }, ...prev])
      }).catch(() => setUpdates(prev => [{ id: nextId('RU', prev), ...uForm }, ...prev]))
      pushToast('Regulatory update added')
    }
    setUModal({ open: false, editId: '' })
  }

  function openAgreement(row) {
    if (row) {
      setGModal({ open: true, editId: row.id })
      setGForm({ partner: row.partner, type: row.type, start: row.start, end: row.end, value: String(row.value), status: row.status })
      return
    }
    setGModal({ open: true, editId: '' })
    setGForm({ partner: '', type: '', start: '', end: '', value: '', status: 'Active' })
  }

  function saveAgreement() {
    if (!gForm.partner.trim() || !gForm.type.trim()) return
    const payload = { ...gForm, value: Number(gForm.value || 0) }
    if (gModal.editId) {
      setAgreements(prev => prev.map(r => r.id === gModal.editId ? { ...r, ...payload } : r))
      complianceAPI.agreements.update(gModal.editId, payload).catch(() => { pushToast('Save failed. Please try again.') })
      pushToast('Agreement updated')
    } else {
      complianceAPI.agreements.create(payload).then(doc => {
        setAgreements(prev => [{ ...doc, id: doc._id?.toString() || doc.id }, ...prev])
      }).catch(() => setAgreements(prev => [{ id: nextId('AG', prev), ...payload }, ...prev]))
      pushToast('Agreement added')
    }
    setGModal({ open: false, editId: '' })
  }

  return (
    <ModuleTabColumn style={{ fontFamily: 'inherit' }}>
      <ModulePageHeading
        title="Government & Compliance"
        subtitle="Role-based compliance control center with actionable records and audit-ready data."
        right={(
          <div style={{ background: readOnlyByRole ? 'rgba(148,163,184,0.18)' : 'rgba(0,104,74,0.12)', color: readOnlyByRole ? '#556273' : C.primary, border: `1px solid ${readOnlyByRole ? 'rgba(100,116,139,0.3)' : C.borderStrong}`, borderRadius: 999, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>
            {readOnlyByRole ? 'Read Only Access' : 'Edit Access Enabled'}
          </div>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {metric('Pending Approvals', kpi.pendingApprovals, C.blue)}
        {metric('Expiring Documents', kpi.expiringDocs, C.amber)}
        {metric('High Impact Updates', kpi.highImpact, C.red)}
        {metric('Renewals Required', kpi.renewals, C.primary)}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((tabItem) => (
          <ErpSubTabButton key={tabItem.id} active={tab === tabItem.id} onClick={() => setTab(tabItem.id)}>
            {tabItem.label}
          </ErpSubTabButton>
        ))}
      </div>

      {tab === 'eligibility' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text }}>Eligibility Register</div>
            <Button onClick={() => openEligibility(null)} disabled={readOnlyByRole}>+ Add Eligibility</Button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 860 }}>
              <thead><tr style={{ background: 'rgba(0,104,74,0.06)' }}><th style={th}>Entity</th><th style={th}>Permit</th><th style={th}>Status</th><th style={th}>Last Review</th><th style={th}>Owner</th><th style={th}>Notes</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {eligibility.map(r => (
                  <tr key={r.id}><td style={td}>{r.entity}</td><td style={td}>{r.permit}</td><td style={td}><Badge>{r.status}</Badge></td><td style={td}>{r.lastReview || '—'}</td><td style={td}>{r.owner || '—'}</td><td style={td}>{r.notes || '—'}</td><td style={td}><RowActions canEdit={!readOnlyByRole} onEdit={() => openEligibility(r)} onDelete={() => removeRowApi(setEligibility, eligibility, r.id, r.entity, complianceAPI.eligibility)} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'approvals' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text }}>Approvals Tracker</div>
            <Button onClick={() => openApproval(null)} disabled={readOnlyByRole}>+ Add Filing</Button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead><tr style={{ background: 'rgba(0,104,74,0.06)' }}><th style={th}>Authority</th><th style={th}>Filing</th><th style={th}>Due</th><th style={th}>Submitted</th><th style={th}>Status</th><th style={th}>Reference</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {approvals.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{r.authority}</td><td style={td}>{r.filing}</td><td style={td}>{r.dueDate || '—'}</td><td style={td}>{r.submittedDate || '—'}</td><td style={td}><Badge>{r.status}</Badge></td><td style={td}>{r.refNo || '—'}</td>
                    <td style={td}>
                      <RowActions
                        canEdit={!readOnlyByRole}
                        onEdit={() => openApproval(r)}
                        onDelete={() => removeRowApi(setApprovals, approvals, r.id, r.filing, complianceAPI.approvals)}
                        extra={!readOnlyByRole && r.status === 'Pending' ? (
                          <button onClick={async () => {
                            const today = new Date().toISOString().slice(0, 10)
                            const prev = approvals
                            setApprovals(rows => rows.map(x => x.id === r.id ? { ...x, status: 'Submitted', submittedDate: today } : x))
                            try {
                              await complianceAPI.approvals.update(r.id, { status: 'Submitted', submittedDate: today })
                              pushToast('Marked as submitted')
                            } catch {
                              setApprovals(prev)
                              pushToast('Submit failed. Please try again.')
                            }
                          }} style={{ border: 'none', background: 'transparent', color: C.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Submit</button>
                        ) : null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'docs' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text }}>Documentation Library</div>
            <Button onClick={() => openDoc(null)} disabled={readOnlyByRole}>+ Add Document</Button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead><tr style={{ background: 'rgba(0,104,74,0.06)' }}><th style={th}>Document</th><th style={th}>Category</th><th style={th}>Owner</th><th style={th}>Version</th><th style={th}>Expiry</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {docs.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{r.name}</td><td style={td}>{r.category}</td><td style={td}>{r.owner || '—'}</td><td style={td}>{r.version}</td><td style={td}>{r.expiry || '—'}</td><td style={td}><Badge>{r.status}</Badge></td>
                    <td style={td}>
                      <RowActions
                        canEdit={!readOnlyByRole}
                        onEdit={() => openDoc(r)}
                        onDelete={() => removeRowApi(setDocs, docs, r.id, r.name, complianceAPI.docs)}
                        extra={!readOnlyByRole && r.status === 'Expiring Soon' ? (
                          <button onClick={async () => {
                            const prev = docs
                            const newVer = x => x.version === 'v1' ? 'v2' : `v${Number(String(x.version).replace('v', '')) + 1}`
                            const found = docs.find(x => x.id === r.id)
                            const nextVersion = found ? newVer(found) : 'v2'
                            setDocs(rows => rows.map(x => x.id === r.id ? { ...x, status: 'Active', version: nextVersion } : x))
                            try {
                              await complianceAPI.docs.update(r.id, { status: 'Active', version: nextVersion })
                              pushToast('Document renewed')
                            } catch {
                              setDocs(prev)
                              pushToast('Renew failed. Please try again.')
                            }
                          }} style={{ border: 'none', background: 'transparent', color: C.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Renew</button>
                        ) : null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'updates' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text }}>Regulatory Updates</div>
            <Button onClick={() => openUpdate(null)} disabled={readOnlyByRole}>+ Add Update</Button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 960 }}>
              <thead><tr style={{ background: 'rgba(0,104,74,0.06)' }}><th style={th}>Title</th><th style={th}>Source</th><th style={th}>Effective</th><th style={th}>Impact</th><th style={th}>Owner</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {updates.map(r => (
                  <tr key={r.id}><td style={td}>{r.title}</td><td style={td}>{r.source}</td><td style={td}>{r.effective || '—'}</td><td style={td}>{r.impact}</td><td style={td}>{r.actionOwner || '—'}</td><td style={td}><Badge>{r.status}</Badge></td><td style={td}><RowActions canEdit={!readOnlyByRole} onEdit={() => openUpdate(r)} onDelete={() => removeRowApi(setUpdates, updates, r.id, r.title, complianceAPI.updates)} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'agreements' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text }}>Compliance Agreements</div>
            <Button onClick={() => openAgreement(null)} disabled={readOnlyByRole}>+ Add Agreement</Button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 960 }}>
              <thead><tr style={{ background: 'rgba(0,104,74,0.06)' }}><th style={th}>Partner</th><th style={th}>Type</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Value</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {agreements.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{r.partner}</td><td style={td}>{r.type}</td><td style={td}>{r.start || '—'}</td><td style={td}>{r.end || '—'}</td><td style={td}>{Money(r.value)}</td><td style={td}><Badge>{r.status}</Badge></td>
                    <td style={td}>
                      <RowActions
                        canEdit={!readOnlyByRole}
                        onEdit={() => openAgreement(r)}
                        onDelete={() => removeRowApi(setAgreements, agreements, r.id, r.partner, complianceAPI.agreements)}
                        extra={!readOnlyByRole && r.status === 'Renewal Required' ? (
                          <button onClick={async () => {
                            const prev = agreements
                            setAgreements(rows => rows.map(x => x.id === r.id ? { ...x, status: 'Active' } : x))
                            try {
                              await complianceAPI.agreements.update(r.id, { status: 'Active' })
                              pushToast('Agreement moved to active')
                            } catch {
                              setAgreements(prev)
                              pushToast('Renew failed. Please try again.')
                            }
                          }} style={{ border: 'none', background: 'transparent', color: C.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Renew</button>
                        ) : null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={eModal.open} onClose={() => setEModal({ open: false, editId: '' })} title={eModal.editId ? 'Edit Eligibility' : 'Add Eligibility'}>
        <Grid>
          <Field label="Entity"><Input value={eForm.entity} onChange={(e) => setEForm(p => ({ ...p, entity: e.target.value }))} placeholder="Factory Site A" /></Field>
          <Field label="Permit"><Input value={eForm.permit} onChange={(e) => setEForm(p => ({ ...p, permit: e.target.value }))} placeholder="Operating License" /></Field>
          <Field label="Status"><Select value={eForm.status} onChange={(e) => setEForm(p => ({ ...p, status: e.target.value }))} options={['Eligible', 'Under Review', 'Pending']} /></Field>
          <Field label="Last Review"><Input type="date" value={eForm.lastReview} onChange={(e) => setEForm(p => ({ ...p, lastReview: e.target.value }))} /></Field>
          <Field label="Owner"><Input value={eForm.owner} onChange={(e) => setEForm(p => ({ ...p, owner: e.target.value }))} placeholder="Compliance Ops" /></Field>
          <Field label="Notes"><Input value={eForm.notes} onChange={(e) => setEForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" /></Field>
        </Grid>
        <Actions onClose={() => setEModal({ open: false, editId: '' })} onSave={saveEligibility} />
      </Modal>

      <Modal open={aModal.open} onClose={() => setAModal({ open: false, editId: '' })} title={aModal.editId ? 'Edit Approval Filing' : 'Add Approval Filing'}>
        <Grid>
          <Field label="Authority"><Input value={aForm.authority} onChange={(e) => setAForm(p => ({ ...p, authority: e.target.value }))} placeholder="Trade Authority" /></Field>
          <Field label="Filing"><Input value={aForm.filing} onChange={(e) => setAForm(p => ({ ...p, filing: e.target.value }))} placeholder="Quarterly Return" /></Field>
          <Field label="Due Date"><Input type="date" value={aForm.dueDate} onChange={(e) => setAForm(p => ({ ...p, dueDate: e.target.value }))} /></Field>
          <Field label="Submitted Date"><Input value={aForm.submittedDate} onChange={(e) => setAForm(p => ({ ...p, submittedDate: e.target.value }))} placeholder="YYYY-MM-DD or —" /></Field>
          <Field label="Status"><Select value={aForm.status} onChange={(e) => setAForm(p => ({ ...p, status: e.target.value }))} options={['Pending', 'Submitted', 'Approved']} /></Field>
          <Field label="Reference"><Input value={aForm.refNo} onChange={(e) => setAForm(p => ({ ...p, refNo: e.target.value }))} placeholder="Ref no." /></Field>
        </Grid>
        <Actions onClose={() => setAModal({ open: false, editId: '' })} onSave={saveApproval} />
      </Modal>

      <Modal open={dModal.open} onClose={() => setDModal({ open: false, editId: '' })} title={dModal.editId ? 'Edit Document' : 'Add Document'}>
        <Grid>
          <Field label="Document Name"><Input value={dForm.name} onChange={(e) => setDForm(p => ({ ...p, name: e.target.value }))} placeholder="Certificate Name" /></Field>
          <Field label="Category"><Select value={dForm.category} onChange={(e) => setDForm(p => ({ ...p, category: e.target.value }))} options={['Certificate', 'Registration', 'Policy', 'License']} /></Field>
          <Field label="Owner"><Input value={dForm.owner} onChange={(e) => setDForm(p => ({ ...p, owner: e.target.value }))} placeholder="Owner" /></Field>
          <Field label="Version"><Input value={dForm.version} onChange={(e) => setDForm(p => ({ ...p, version: e.target.value }))} placeholder="v1" /></Field>
          <Field label="Expiry"><Input type="date" value={dForm.expiry} onChange={(e) => setDForm(p => ({ ...p, expiry: e.target.value }))} /></Field>
          <Field label="Status"><Select value={dForm.status} onChange={(e) => setDForm(p => ({ ...p, status: e.target.value }))} options={['Active', 'Expiring Soon', 'Archived']} /></Field>
        </Grid>
        <Actions onClose={() => setDModal({ open: false, editId: '' })} onSave={saveDoc} />
      </Modal>

      <Modal open={uModal.open} onClose={() => setUModal({ open: false, editId: '' })} title={uModal.editId ? 'Edit Regulatory Update' : 'Add Regulatory Update'}>
        <Grid>
          <Field label="Title"><Input value={uForm.title} onChange={(e) => setUForm(p => ({ ...p, title: e.target.value }))} placeholder="New assay reporting format" /></Field>
          <Field label="Source"><Input value={uForm.source} onChange={(e) => setUForm(p => ({ ...p, source: e.target.value }))} placeholder="Regulator Circular" /></Field>
          <Field label="Effective"><Input type="date" value={uForm.effective} onChange={(e) => setUForm(p => ({ ...p, effective: e.target.value }))} /></Field>
          <Field label="Impact"><Select value={uForm.impact} onChange={(e) => setUForm(p => ({ ...p, impact: e.target.value }))} options={['Low', 'Medium', 'High']} /></Field>
          <Field label="Action Owner"><Input value={uForm.actionOwner} onChange={(e) => setUForm(p => ({ ...p, actionOwner: e.target.value }))} placeholder="Team/Owner" /></Field>
          <Field label="Status"><Select value={uForm.status} onChange={(e) => setUForm(p => ({ ...p, status: e.target.value }))} options={['Planned', 'In Progress', 'Implemented']} /></Field>
        </Grid>
        <Actions onClose={() => setUModal({ open: false, editId: '' })} onSave={saveUpdate} />
      </Modal>

      <Modal open={gModal.open} onClose={() => setGModal({ open: false, editId: '' })} title={gModal.editId ? 'Edit Agreement' : 'Add Agreement'}>
        <Grid>
          <Field label="Partner"><Input value={gForm.partner} onChange={(e) => setGForm(p => ({ ...p, partner: e.target.value }))} placeholder="Partner" /></Field>
          <Field label="Agreement Type"><Input value={gForm.type} onChange={(e) => setGForm(p => ({ ...p, type: e.target.value }))} placeholder="MoU / Contract" /></Field>
          <Field label="Start"><Input type="date" value={gForm.start} onChange={(e) => setGForm(p => ({ ...p, start: e.target.value }))} /></Field>
          <Field label="End"><Input type="date" value={gForm.end} onChange={(e) => setGForm(p => ({ ...p, end: e.target.value }))} /></Field>
          <Field label="Value ($)"><Input type="number" value={gForm.value} onChange={(e) => setGForm(p => ({ ...p, value: e.target.value }))} placeholder="0" /></Field>
          <Field label="Status"><Select value={gForm.status} onChange={(e) => setGForm(p => ({ ...p, status: e.target.value }))} options={['Active', 'Renewal Required', 'Closed']} /></Field>
        </Grid>
        <Actions onClose={() => setGModal({ open: false, editId: '' })} onSave={saveAgreement} />
      </Modal>

      {toast && (
        <div style={{ position: 'fixed', right: 16, bottom: 16, background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, zIndex: 90, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>{toast}</div>
      )}
    </ModuleTabColumn>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

function Actions({ onClose, onSave }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave}>Save</Button>
    </div>
  )
}

const th = { textAlign: 'left', padding: 9, borderBottom: `1px solid ${C.border}`, color: C.text }
const td = { padding: 9, borderBottom: `1px solid ${C.border}`, color: C.sub, verticalAlign: 'top' }

export default ComplianceTab