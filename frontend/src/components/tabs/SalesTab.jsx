import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addContactNote,
  changeLeadStage,
  closeDeal,
  createActivity,
  createCompany,
  createContact,
  createDeal,
  createLead,
  deleteActivity,
  deleteCompany,
  deleteContact,
  deleteDeal,
  deleteLead,
  getActivities,
  getCompaniesTemplateCsv,
  getCompanies,
  getContactsTemplateCsv,
  getContacts,
  getDashboard,
  getDealsTemplateCsv,
  getDeals,
  getFollowups,
  getLeads,
  importCompaniesCsv,
  importContactsCsv,
  importDealsCsv,
  markFollowupDone,
  uploadContactDocument,
  deleteContactDocument,
  exportContactsCsv,
  exportCompaniesCsv,
  exportDealsCsv,
  updateActivity,
  updateCompany,
  updateContact,
  updateDeal,
  updateLead,
} from '../../api/crm'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'

const C = {
  bg: '#f4f7f6',
  card: '#ffffff',
  border: 'rgba(0, 104, 74, 0.14)',
  borderStrong: 'rgba(0, 104, 74, 0.28)',
  primary: '#00684A',
  text: '#1b2a33',
  sub: '#4d5f6d',
  muted: '#7b8b97',
  danger: '#e03d3d',
  warn: '#db9d1b',
}

const CONTACT_TYPES = ['All', 'Customer', 'Supplier', 'Partner', 'Prospect']
const CONTACT_STATUS = ['All', 'Active', 'Negotiating', 'Meeting Scheduled', 'Contacted', 'Qualified', 'Prospect', 'Inactive']
const LEAD_STAGES = ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Negotiating', 'Closed Won']
const DEAL_STAGES = ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Negotiating', 'Agreement Signed', 'Active', 'Closed Won', 'Closed Lost']
const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Task', 'Note', 'Demo']

const STATUS_STYLE = {
  Active: { bg: 'rgba(34,197,94,0.15)', color: '#1e8f4d' },
  Negotiating: { bg: 'rgba(168,85,247,0.15)', color: '#8a37d2' },
  'Meeting Scheduled': { bg: 'rgba(234,179,8,0.18)', color: '#b07e06' },
  Contacted: { bg: 'rgba(6,182,212,0.16)', color: '#0b91a8' },
  Qualified: { bg: 'rgba(59,130,246,0.16)', color: '#1e68ca' },
  Prospect: { bg: 'rgba(100,116,139,0.15)', color: '#526074' },
  Inactive: { bg: 'rgba(239,68,68,0.16)', color: '#b22d2d' },
  Hot: { bg: 'rgba(249,115,22,0.17)', color: '#be5a05' },
  'Very Hot': { bg: 'rgba(220,38,38,0.18)', color: '#b12121' },
  Warm: { bg: 'rgba(234,179,8,0.18)', color: '#a47708' },
  Cold: { bg: 'rgba(59,130,246,0.14)', color: '#1f65bf' },
}

function sBadge(text) {
  const s = STATUS_STYLE[text] || { bg: 'rgba(100,116,139,0.15)', color: '#526074' }
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>
}

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>
}

function Button({ children, onClick, variant = 'primary', disabled = false }) {
  const style = variant === 'primary' ? { background: C.primary, color: '#fff', border: 'none' } : { background: '#fff', color: C.text, border: `1px solid ${C.borderStrong}` }
  return (
    <button disabled={disabled} onClick={onClick} style={{
      ...style,
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 13,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      border: active ? `1px solid ${C.primary}` : `1px solid ${C.borderStrong}`,
      background: active ? 'rgba(0,104,74,0.08)' : '#fff',
      color: active ? C.primary : C.text,
      borderRadius: 999,
      padding: '7px 12px',
      fontWeight: 700,
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Modal({ open, title, children, onClose, width = 920 }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 14, border: `1px solid ${C.borderStrong}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  )
}

const CSV_GUIDES = {
  contacts: {
    title: 'Contacts CSV Guide',
    description: 'Use one row per contact. Required: firstName, lastName.',
    headers: ['firstName', 'lastName', 'email', 'phone', 'companyName', 'contactType', 'country', 'city', 'assignedRep', 'status', 'leadSource', 'estDealValue', 'volumeTargetKg', 'paymentTerms', 'priority', 'tags'],
    example: ['Nursultan', 'Abenov', 'nursultan@kazgold.example', '+7-701-555-0111', 'KazGold Distributors', 'Partner', 'Kazakhstan', 'Almaty', 'Layla S.', 'Active', 'Referral', '120000', '80', 'Net 30', 'High', 'gold|cis'],
  },
  companies: {
    title: 'Companies CSV Guide',
    description: 'Use one row per company. Required: name.',
    headers: ['name', 'type', 'country', 'city', 'website', 'industry', 'status', 'riskRating', 'notes'],
    example: ['Tashkent Trading Co', 'Prospect', 'Uzbekistan', 'Tashkent', 'https://tashkenttrade.example', 'Gold Distribution', 'Contacted', 'Medium', 'First outreach completed'],
  },
  deals: {
    title: 'Deals CSV Guide',
    description: 'Use one row per deal. Required: name. companyName/contactName should match existing records when possible.',
    headers: ['name', 'companyName', 'contactName', 'stage', 'assignedRep', 'volumeKg', 'valueUSD', 'probability', 'paymentTerms', 'expectedCloseDate'],
    example: ['KazGold Renewal 2026', 'KazGold Distributors', 'Nursultan Abenov', 'Proposal', 'Layla S.', '80', '120000', '72', 'Net 30', '2026-05-15'],
  },
}

function CsvGuideModal({ kind, onClose }) {
  const guide = kind ? CSV_GUIDES[kind] : null
  const [copyState, setCopyState] = useState('')
  if (!guide) return null

  const headersCsv = guide.headers.join(',')
  const exampleRowCsv = guide.example.map((v) => {
    const text = String(v ?? '')
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }).join(',')
  const headersPlusExampleCsv = `${headersCsv}\n${exampleRowCsv}`

  const copyText = async (text, successMessage) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopyState(successMessage)
      setTimeout(() => setCopyState(''), 1800)
    } catch {
      setCopyState('Copy failed. Please copy manually from table.')
      setTimeout(() => setCopyState(''), 2200)
    }
  }

  const handleCopyHeaders = async () => copyText(headersCsv, 'Headers copied.')
  const handleCopyExample = async () => copyText(exampleRowCsv, 'Example row copied.')
  const handleCopyHeadersAndExample = async () => copyText(headersPlusExampleCsv, 'Headers + example copied.')

  return (
    <Modal open={Boolean(kind)} onClose={onClose} title={guide.title} width={980}>
      <div style={{ color: C.sub, fontSize: 13, marginBottom: 10 }}>{guide.description}</div>
      <div style={{ overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 860 }}>
          <thead>
            <tr style={{ background: 'rgba(0,104,74,0.06)' }}>
              {guide.headers.map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${C.border}`, color: C.text, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {guide.example.map((v, idx) => (
                <td key={`${guide.headers[idx]}-${idx}`} style={{ padding: 8, borderBottom: `1px solid ${C.border}`, color: C.sub, whiteSpace: 'nowrap' }}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
        Tip: Download Template for exact headers, then copy this example row format.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: copyState.startsWith('Copy failed') ? C.danger : C.primary }}>
          {copyState || 'Copy one row and paste directly into Excel/Sheets.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant='secondary' onClick={handleCopyHeaders}>Copy Headers</Button>
          <Button variant='secondary' onClick={handleCopyExample}>Copy Example Row</Button>
          <Button variant='secondary' onClick={handleCopyHeadersAndExample}>Copy Headers + Example</Button>
          <Button variant='secondary' onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

function scoreToTemp(score) {
  if (score <= 40) return 'Cold'
  if (score <= 70) return 'Warm'
  if (score <= 90) return 'Hot'
  return 'Very Hot'
}

function scoreTotal(score) {
  return Number(score?.companyFit || 0) + Number(score?.budgetMatch || 0) + Number(score?.timeline || 0) + Number(score?.engagement || 0)
}

function currency(n) {
  return `$${Number(n || 0).toLocaleString()}`
}

function dateFmt(d) {
  if (!d) return '-'
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return '-'
  return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FormGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>{children}</div>
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function resolveDocUrl(relativePath) {
  if (!relativePath) return '#'
  if (/^https?:\/\//i.test(relativePath)) return relativePath
  return `http://localhost:5000${relativePath.startsWith('/') ? '' : '/'}${relativePath}`
}

function getContactInit(initial, reps) {
  return {
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    jobTitle: initial?.jobTitle || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    whatsApp: initial?.whatsApp || '',
    companyName: initial?.companyName || '',
    website: initial?.website || '',
    industry: initial?.industry || 'Gold Distribution',
    contactType: initial?.contactType || 'Prospect',
    country: initial?.country || '',
    city: initial?.city || '',
    assignedRep: initial?.assignedRep || reps[0] || '',
    leadSource: initial?.leadSource || 'Referral',
    estDealValue: initial?.estDealValue || 0,
    volumeTargetKg: initial?.volumeTargetKg || 0,
    paymentTerms: initial?.paymentTerms || 'Net 30',
    priority: initial?.priority || 'High',
    status: initial?.status || 'Prospect',
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : '',
    notesText: '',
  }
}

function getLeadInit(initial, reps) {
  return {
    name: initial?.name || '',
    contactId: initial?.contactId || '',
    contactName: initial?.contactName || '',
    companyName: initial?.companyName || '',
    source: initial?.source || 'Exhibition',
    dealType: initial?.dealType || '',
    stage: initial?.stage || 'Prospect',
    assignedRep: initial?.assignedRep || reps[0] || '',
    estValueUSD: initial?.estValueUSD || 0,
    volumeKg: initial?.volumeKg || 0,
    probability: initial?.probability || 50,
    expectedCloseDate: initial?.expectedCloseDate ? String(initial.expectedCloseDate).slice(0, 10) : '',
    score: {
      companyFit: initial?.score?.companyFit || 0,
      budgetMatch: initial?.score?.budgetMatch || 0,
      timeline: initial?.score?.timeline || 0,
      engagement: initial?.score?.engagement || 0,
    },
    nextAction: {
      description: initial?.nextAction?.description || '',
      dueDate: initial?.nextAction?.dueDate ? String(initial.nextAction.dueDate).slice(0, 10) : '',
      assignedTo: initial?.nextAction?.assignedTo || reps[0] || '',
      isDone: initial?.nextAction?.isDone || false,
    },
  }
}

function getCompanyInit(initial) {
  return {
    name: initial?.name || '',
    type: initial?.type || 'Prospect',
    country: initial?.country || '',
    city: initial?.city || '',
    website: initial?.website || '',
    industry: initial?.industry || '',
    status: initial?.status || 'Prospect',
    riskRating: initial?.riskRating || 'Medium',
    notes: initial?.notes || '',
  }
}

function getDealInit(initial, reps) {
  return {
    name: initial?.name || '',
    contactName: initial?.contactName || '',
    contactId: initial?.contactId || '',
    companyName: initial?.companyName || '',
    companyId: initial?.companyId || '',
    leadId: initial?.leadId || '',
    stage: initial?.stage || 'Prospect',
    assignedRep: initial?.assignedRep || reps[0] || '',
    volumeKg: initial?.volumeKg || 0,
    valueUSD: initial?.valueUSD || 0,
    probability: initial?.probability || 50,
    quotedPricePerKg: initial?.quotedPricePerKg || 0,
    paymentTerms: initial?.paymentTerms || 'Net 30',
    expectedPaymentDate: initial?.expectedPaymentDate ? String(initial.expectedPaymentDate).slice(0, 10) : '',
    expectedCloseDate: initial?.expectedCloseDate ? String(initial.expectedCloseDate).slice(0, 10) : '',
    nextAction: {
      description: initial?.nextAction?.description || '',
      dueDate: initial?.nextAction?.dueDate ? String(initial.nextAction.dueDate).slice(0, 10) : '',
      assignedTo: initial?.nextAction?.assignedTo || reps[0] || '',
      isDone: initial?.nextAction?.isDone || false,
    },
    revenueRecognized: initial?.revenueRecognized || false,
  }
}

function getActivityInit(initial, reps) {
  const now = new Date()
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T10:00`
  return {
    type: initial?.type || 'Call',
    contactId: initial?.contactId || '',
    contactName: initial?.contactName || '',
    dealId: initial?.dealId || '',
    dealName: initial?.dealName || '',
    date: initial?.date ? String(initial.date).slice(0, 16) : d,
    durationMin: initial?.durationMin || 30,
    subject: initial?.subject || '',
    outcome: initial?.outcome || 'Positive',
    notes: initial?.notes || '',
    nextAction: {
      description: initial?.nextAction?.description || '',
      dueDate: initial?.nextAction?.dueDate ? String(initial.nextAction.dueDate).slice(0, 10) : '',
      assignedTo: initial?.nextAction?.assignedTo || reps[0] || '',
      isDone: initial?.nextAction?.isDone || false,
    },
    isPrivate: initial?.isPrivate || false,
  }
}

function ContactModal({ open, onClose, onSave, initial, reps }) {
  const [f, setF] = useState(getContactInit(initial, reps))
  useEffect(() => setF(getContactInit(initial, reps)), [initial, reps])
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'EDIT CONTACT' : 'ADD NEW CONTACT'}>
      <FormGrid>
        <Input value={f.firstName} onChange={(e) => setF((p) => ({ ...p, firstName: e.target.value }))} placeholder='First Name *' />
        <Input value={f.lastName} onChange={(e) => setF((p) => ({ ...p, lastName: e.target.value }))} placeholder='Last Name *' />
        <Input value={f.jobTitle} onChange={(e) => setF((p) => ({ ...p, jobTitle: e.target.value }))} placeholder='Job Title' />
        <Input value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} placeholder='Email *' />
        <Input value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} placeholder='Phone' />
        <Input value={f.whatsApp} onChange={(e) => setF((p) => ({ ...p, whatsApp: e.target.value }))} placeholder='WhatsApp' />
        <Input value={f.companyName} onChange={(e) => setF((p) => ({ ...p, companyName: e.target.value }))} placeholder='Company Name *' />
        <Input value={f.website} onChange={(e) => setF((p) => ({ ...p, website: e.target.value }))} placeholder='Website' />
        <Input value={f.industry} onChange={(e) => setF((p) => ({ ...p, industry: e.target.value }))} placeholder='Industry' />
        <Select value={f.contactType} onChange={(e) => setF((p) => ({ ...p, contactType: e.target.value }))} options={['Customer', 'Supplier', 'Partner', 'Prospect']} />
        <Input value={f.country} onChange={(e) => setF((p) => ({ ...p, country: e.target.value }))} placeholder='Country *' />
        <Input value={f.city} onChange={(e) => setF((p) => ({ ...p, city: e.target.value }))} placeholder='City' />
        <Select value={f.assignedRep} onChange={(e) => setF((p) => ({ ...p, assignedRep: e.target.value }))} options={reps} />
        <Input value={f.leadSource} onChange={(e) => setF((p) => ({ ...p, leadSource: e.target.value }))} placeholder='Lead Source' />
        <Input type='number' value={f.estDealValue} onChange={(e) => setF((p) => ({ ...p, estDealValue: Number(e.target.value) }))} placeholder='Est. Deal Value' />
        <Input type='number' value={f.volumeTargetKg} onChange={(e) => setF((p) => ({ ...p, volumeTargetKg: Number(e.target.value) }))} placeholder='Volume Target (kg)' />
        <Input value={f.paymentTerms} onChange={(e) => setF((p) => ({ ...p, paymentTerms: e.target.value }))} placeholder='Payment Terms' />
        <Select value={f.priority} onChange={(e) => setF((p) => ({ ...p, priority: e.target.value }))} options={['High', 'Medium', 'Low']} />
        <Select value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))} options={['Active', 'Negotiating', 'Meeting Scheduled', 'Contacted', 'Qualified', 'Prospect', 'Inactive']} />
        <Input value={f.tags} onChange={(e) => setF((p) => ({ ...p, tags: e.target.value }))} placeholder='Tags comma-separated' />
      </FormGrid>
      <textarea value={f.notesText} onChange={(e) => setF((p) => ({ ...p, notesText: e.target.value }))} rows={3} placeholder='Any initial notes...' style={{ marginTop: 8, width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: 8, fontFamily: 'inherit', fontSize: 13 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ ...f, tags: f.tags ? f.tags.split(',').map((x) => x.trim()).filter(Boolean) : [], notes: f.notesText ? [{ text: f.notesText, author: 'System' }] : [] })}>Save Contact</Button>
      </div>
    </Modal>
  )
}

function LeadModal({ open, onClose, onSave, initial, reps, contacts }) {
  const [f, setF] = useState(getLeadInit(initial, reps))
  useEffect(() => setF(getLeadInit(initial, reps)), [initial, reps])
  const total = scoreTotal(f.score)
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'EDIT LEAD' : 'ADD NEW LEAD'}>
      <FormGrid>
        <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder='Lead Name *' />
        <Select value={f.stage} onChange={(e) => setF((p) => ({ ...p, stage: e.target.value }))} options={LEAD_STAGES} />
        <Select value={f.contactId} onChange={(e) => {
          const id = e.target.value
          const c = contacts.find((x) => x._id === id)
          setF((p) => ({ ...p, contactId: id, contactName: c ? `${c.firstName} ${c.lastName}` : '', companyName: c?.companyName || p.companyName }))
        }} options={['', ...contacts.map((c) => c._id)]} />
        <Input value={f.companyName} onChange={(e) => setF((p) => ({ ...p, companyName: e.target.value }))} placeholder='Company' />
        <Input value={f.source} onChange={(e) => setF((p) => ({ ...p, source: e.target.value }))} placeholder='Source' />
        <Select value={f.assignedRep} onChange={(e) => setF((p) => ({ ...p, assignedRep: e.target.value }))} options={reps} />
        <Input type='number' value={f.volumeKg} onChange={(e) => setF((p) => ({ ...p, volumeKg: Number(e.target.value) }))} placeholder='Volume (kg)' />
        <Input type='number' value={f.estValueUSD} onChange={(e) => setF((p) => ({ ...p, estValueUSD: Number(e.target.value) }))} placeholder='Est. Value (USD)' />
        <Input type='number' value={f.probability} onChange={(e) => setF((p) => ({ ...p, probability: Number(e.target.value) }))} placeholder='Probability %' />
        <Input type='date' value={f.expectedCloseDate} onChange={(e) => setF((p) => ({ ...p, expectedCloseDate: e.target.value }))} placeholder='Expected Close Date' />
        <Input type='number' value={f.score.companyFit} onChange={(e) => setF((p) => ({ ...p, score: { ...p.score, companyFit: Number(e.target.value) } }))} placeholder='Company fit (0-25)' />
        <Input type='number' value={f.score.budgetMatch} onChange={(e) => setF((p) => ({ ...p, score: { ...p.score, budgetMatch: Number(e.target.value) } }))} placeholder='Budget match (0-25)' />
        <Input type='number' value={f.score.timeline} onChange={(e) => setF((p) => ({ ...p, score: { ...p.score, timeline: Number(e.target.value) } }))} placeholder='Timeline (0-25)' />
        <Input type='number' value={f.score.engagement} onChange={(e) => setF((p) => ({ ...p, score: { ...p.score, engagement: Number(e.target.value) } }))} placeholder='Engagement (0-25)' />
        <Input value={f.nextAction.description} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, description: e.target.value } }))} placeholder='Next action' />
        <Input type='date' value={f.nextAction.dueDate} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, dueDate: e.target.value } }))} placeholder='Next action due' />
        <Select value={f.nextAction.assignedTo} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, assignedTo: e.target.value } }))} options={reps} />
      </FormGrid>
      <div style={{ marginTop: 8, fontSize: 13, color: C.sub }}>Overall score: <b>{total}/100</b> ({scoreToTemp(total)})</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(f)}>Save Lead</Button>
      </div>
    </Modal>
  )
}

function CompanyModal({ open, onClose, onSave, initial }) {
  const [f, setF] = useState(getCompanyInit(initial))
  useEffect(() => setF(getCompanyInit(initial)), [initial])
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'EDIT COMPANY' : 'ADD COMPANY'}>
      <FormGrid>
        <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder='Company Name *' />
        <Select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))} options={['Customer', 'Supplier', 'Partner', 'Prospect']} />
        <Input value={f.country} onChange={(e) => setF((p) => ({ ...p, country: e.target.value }))} placeholder='Country' />
        <Input value={f.city} onChange={(e) => setF((p) => ({ ...p, city: e.target.value }))} placeholder='City' />
        <Input value={f.website} onChange={(e) => setF((p) => ({ ...p, website: e.target.value }))} placeholder='Website' />
        <Input value={f.industry} onChange={(e) => setF((p) => ({ ...p, industry: e.target.value }))} placeholder='Industry' />
        <Select value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))} options={['Active', 'Negotiating', 'Meeting Scheduled', 'Contacted', 'Qualified', 'Prospect', 'Inactive']} />
        <Select value={f.riskRating} onChange={(e) => setF((p) => ({ ...p, riskRating: e.target.value }))} options={['Low', 'Medium', 'High']} />
      </FormGrid>
      <textarea value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder='Notes' style={{ marginTop: 8, width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: 8, fontFamily: 'inherit', fontSize: 13 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(f)}>Save Company</Button>
      </div>
    </Modal>
  )
}

function DealModal({ open, onClose, onSave, initial, reps, companies, contacts, leads, canSeeDealFinancials }) {
  const [f, setF] = useState(getDealInit(initial, reps))
  useEffect(() => setF(getDealInit(initial, reps)), [initial, reps])
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'EDIT DEAL' : 'CREATE DEAL'}>
      <FormGrid>
        <Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder='Deal Name *' />
        <Select value={f.companyId} onChange={(e) => {
          const id = e.target.value
          const co = companies.find((x) => x._id === id)
          setF((p) => ({ ...p, companyId: id, companyName: co?.name || '' }))
        }} options={['', ...companies.map((c) => c._id)]} />
        <Select value={f.contactId} onChange={(e) => {
          const id = e.target.value
          const c = contacts.find((x) => x._id === id)
          setF((p) => ({ ...p, contactId: id, contactName: c ? `${c.firstName} ${c.lastName}` : '' }))
        }} options={['', ...contacts.map((c) => c._id)]} />
        <Select value={f.leadId} onChange={(e) => setF((p) => ({ ...p, leadId: e.target.value }))} options={['', ...leads.map((l) => l._id)]} />
        <Select value={f.stage} onChange={(e) => setF((p) => ({ ...p, stage: e.target.value }))} options={DEAL_STAGES} />
        <Select value={f.assignedRep} onChange={(e) => setF((p) => ({ ...p, assignedRep: e.target.value }))} options={reps} />
        <Input type='number' value={f.volumeKg} onChange={(e) => setF((p) => ({ ...p, volumeKg: Number(e.target.value) }))} placeholder='Volume (kg)' />
        <Input type='number' value={f.valueUSD} onChange={(e) => setF((p) => ({ ...p, valueUSD: Number(e.target.value) }))} placeholder='Deal Value (USD)' />
        <Input type='number' value={f.probability} onChange={(e) => setF((p) => ({ ...p, probability: Number(e.target.value) }))} placeholder='Probability %' />
        <Input type='date' value={f.expectedCloseDate} onChange={(e) => setF((p) => ({ ...p, expectedCloseDate: e.target.value }))} placeholder='Expected Close Date' />
        <Input value={f.nextAction.description} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, description: e.target.value } }))} placeholder='Next action' />
        <Input type='date' value={f.nextAction.dueDate} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, dueDate: e.target.value } }))} placeholder='Next action due' />
        <Select value={f.nextAction.assignedTo} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, assignedTo: e.target.value } }))} options={reps} />
      </FormGrid>
      {canSeeDealFinancials && (
        <FormGrid>
          <Input type='number' value={f.quotedPricePerKg} onChange={(e) => setF((p) => ({ ...p, quotedPricePerKg: Number(e.target.value) }))} placeholder='Quoted price per kg' />
          <Input value={f.paymentTerms} onChange={(e) => setF((p) => ({ ...p, paymentTerms: e.target.value }))} placeholder='Payment Terms' />
          <Input type='date' value={f.expectedPaymentDate} onChange={(e) => setF((p) => ({ ...p, expectedPaymentDate: e.target.value }))} placeholder='Expected Payment Date' />
          <Select value={String(f.revenueRecognized)} onChange={(e) => setF((p) => ({ ...p, revenueRecognized: e.target.value === 'true' }))} options={['false', 'true']} />
        </FormGrid>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(f)}>Save Deal</Button>
      </div>
    </Modal>
  )
}

function ActivityModal({ open, onClose, onSave, initial, reps, contacts, deals }) {
  const [f, setF] = useState(getActivityInit(initial, reps))
  useEffect(() => setF(getActivityInit(initial, reps)), [initial, reps])
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'EDIT ACTIVITY' : 'LOG ACTIVITY'}>
      <FormGrid>
        <Select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))} options={ACTIVITY_TYPES} />
        <Select value={f.contactId} onChange={(e) => {
          const id = e.target.value
          const c = contacts.find((x) => x._id === id)
          setF((p) => ({ ...p, contactId: id, contactName: c ? `${c.firstName} ${c.lastName}` : '' }))
        }} options={['', ...contacts.map((c) => c._id)]} />
        <Select value={f.dealId} onChange={(e) => {
          const id = e.target.value
          const d = deals.find((x) => x._id === id)
          setF((p) => ({ ...p, dealId: id, dealName: d?.name || '' }))
        }} options={['', ...deals.map((d) => d._id)]} />
        <Input type='datetime-local' value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} placeholder='Date/time' />
        <Input type='number' value={f.durationMin} onChange={(e) => setF((p) => ({ ...p, durationMin: Number(e.target.value) }))} placeholder='Duration (min)' />
        <Input value={f.subject} onChange={(e) => setF((p) => ({ ...p, subject: e.target.value }))} placeholder='Subject *' />
        <Select value={f.outcome} onChange={(e) => setF((p) => ({ ...p, outcome: e.target.value }))} options={['Positive', 'Neutral', 'Negative', 'Follow-up needed']} />
        <Input value={f.nextAction.description} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, description: e.target.value } }))} placeholder='Next action' />
        <Input type='date' value={f.nextAction.dueDate} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, dueDate: e.target.value } }))} placeholder='Next action due' />
        <Select value={f.nextAction.assignedTo} onChange={(e) => setF((p) => ({ ...p, nextAction: { ...p.nextAction, assignedTo: e.target.value } }))} options={reps} />
      </FormGrid>
      <textarea value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder='Notes / Summary' style={{ marginTop: 8, width: '100%', border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: 8, fontFamily: 'inherit', fontSize: 13 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(f)}>Save Activity</Button>
      </div>
    </Modal>
  )
}

function CloseDealModal({ open, onClose, onSave, deal }) {
  const [outcome, setOutcome] = useState('won')
  const [f, setF] = useState({ finalValue: 0, closeDate: '', contractSigned: true, paymentConfirmed: true, reason: 'Price too high', competitor: '', notes: '' })
  useEffect(() => {
    if (!open) return
    setOutcome('won')
    setF({ finalValue: Number(deal?.valueUSD || 0), closeDate: new Date().toISOString().slice(0, 10), contractSigned: true, paymentConfirmed: true, reason: 'Price too high', competitor: '', notes: '' })
  }, [open, deal])
  return (
    <Modal open={open} onClose={onClose} title='CLOSE DEAL' width={700}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <TabBtn active={outcome === 'won'} onClick={() => setOutcome('won')}>Won</TabBtn>
        <TabBtn active={outcome === 'lost'} onClick={() => setOutcome('lost')}>Lost</TabBtn>
      </div>
      {outcome === 'won' ? (
        <FormGrid>
          <Input type='number' value={f.finalValue} onChange={(e) => setF((p) => ({ ...p, finalValue: Number(e.target.value) }))} placeholder='Final Value' />
          <Input type='date' value={f.closeDate} onChange={(e) => setF((p) => ({ ...p, closeDate: e.target.value }))} placeholder='Close Date' />
          <Select value={String(f.paymentConfirmed)} onChange={(e) => setF((p) => ({ ...p, paymentConfirmed: e.target.value === 'true' }))} options={['true', 'false']} />
          <Select value={String(f.contractSigned)} onChange={(e) => setF((p) => ({ ...p, contractSigned: e.target.value === 'true' }))} options={['true', 'false']} />
        </FormGrid>
      ) : (
        <FormGrid>
          <Select value={f.reason} onChange={(e) => setF((p) => ({ ...p, reason: e.target.value }))} options={['Price too high', 'Lost to competitor', 'No budget', 'No decision']} />
          <Input value={f.competitor} onChange={(e) => setF((p) => ({ ...p, competitor: e.target.value }))} placeholder='Competitor' />
          <Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} placeholder='Notes' />
        </FormGrid>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant='secondary' onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(outcome === 'won' ? { outcome: 'won', finalValue: f.finalValue, closeDate: f.closeDate, contractSigned: f.contractSigned, paymentConfirmed: f.paymentConfirmed } : { outcome: 'lost', reason: f.reason, competitor: f.competitor, notes: f.notes })}>Close Deal</Button>
      </div>
    </Modal>
  )
}

function FollowupGroups({ followups, onMarkDone, onEdit }) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const overdue = followups.filter((f) => f.nextAction?.dueDate && new Date(f.nextAction.dueDate) < start)
  const today = followups.filter((f) => f.nextAction?.dueDate && new Date(f.nextAction.dueDate) >= start && new Date(f.nextAction.dueDate) <= end)
  const week = followups.filter((f) => {
    if (!f.nextAction?.dueDate) return false
    const d = new Date(f.nextAction.dueDate)
    const in7 = new Date(now)
    in7.setDate(now.getDate() + 7)
    return d > end && d <= in7
  })
  const upcoming = followups.filter((f) => {
    if (!f.nextAction?.dueDate) return false
    const d = new Date(f.nextAction.dueDate)
    const in7 = new Date(now)
    in7.setDate(now.getDate() + 7)
    return d > in7
  })

  const Section = ({ title, rows, color }) => (
    <Card style={{ borderColor: color, marginBottom: 10 }}>
      <div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((f) => (
          <div key={f._id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{dateFmt(f.nextAction?.dueDate)} - {f.nextAction?.description || '-'} - {f.nextAction?.assignedTo || '-'}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{f.subject}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Button variant='secondary' onClick={() => onMarkDone(f._id)}>Mark Done</Button>
              <Button variant='secondary' onClick={() => onEdit(f)}>Reschedule</Button>
              <Button variant='secondary' onClick={() => onEdit(f)}>Reassign</Button>
            </div>
          </div>
        ))}
        {!rows.length && <div style={{ fontSize: 12, color: C.sub }}>No items.</div>}
      </div>
    </Card>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
        <Card><div style={{ fontSize: 11, color: C.muted }}>OVERDUE</div><div style={{ fontSize: 20, fontWeight: 800, color: C.danger }}>{overdue.length}</div></Card>
        <Card><div style={{ fontSize: 11, color: C.muted }}>DUE TODAY</div><div style={{ fontSize: 20, fontWeight: 800, color: C.warn }}>{today.length}</div></Card>
        <Card><div style={{ fontSize: 11, color: C.muted }}>THIS WEEK</div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{week.length}</div></Card>
        <Card><div style={{ fontSize: 11, color: C.muted }}>UPCOMING</div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{upcoming.length}</div></Card>
      </div>
      <Section title='OVERDUE' rows={overdue} color='rgba(239,68,68,0.35)' />
      <Section title='DUE TODAY' rows={today} color='rgba(234,179,8,0.35)' />
      <Section title='THIS WEEK' rows={week} color='rgba(0,104,74,0.28)' />
      <Section title='UPCOMING' rows={upcoming} color='rgba(100,116,139,0.3)' />
    </div>
  )
}

function ContactProfile({ contact, tab, setTab, activities, deals, canSeeKyc, onLogActivity, onAddNote, onUploadDocument, onDeleteDocument, docBusy }) {
  const [noteText, setNoteText] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>{contact.firstName} {contact.lastName}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{contact.jobTitle || '-'} - {contact.companyName || '-'}</div>
          <div style={{ marginTop: 6 }}>{sBadge(`${contact.status}${contact.contactType ? ` • ${contact.contactType}` : ''}`)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant='secondary' onClick={onLogActivity}>+ Log Activity</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {['Overview', 'Activity Timeline', 'Deals & Pipeline', 'Documents', 'Notes', 'KYC & Compliance'].map((t) => {
          if (t === 'KYC & Compliance' && !canSeeKyc) return null
          return <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>{t}</TabBtn>
        })}
      </div>

      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Card>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Contact Details</div>
            <div style={{ fontSize: 13, color: C.sub, display: 'grid', gap: 6 }}>
              <div>Email: {contact.email || '-'}</div>
              <div>Phone: {contact.phone || '-'}</div>
              <div>WhatsApp: {contact.whatsApp || '-'}</div>
              <div>Website: {contact.website || '-'}</div>
              <div>Assigned Rep: {contact.assignedRep || '-'}</div>
              <div>Created: {dateFmt(contact.createdAt)}</div>
              <div>Last Updated: {dateFmt(contact.updatedAt)}</div>
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Business Details</div>
            <div style={{ fontSize: 13, color: C.sub, display: 'grid', gap: 6 }}>
              <div>Company: {contact.companyName || '-'}</div>
              <div>Type: {contact.contactType || '-'}</div>
              <div>Volume Target: {contact.volumeTargetKg || 0} kg/month</div>
              <div>Est. Deal Value: {currency(contact.estDealValue)}</div>
              <div>KYC Status: {contact.kyc?.status || '-'}</div>
              <div>Payment Terms: {contact.paymentTerms || '-'}</div>
              <div>Source: {contact.leadSource || '-'}</div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'Activity Timeline' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {activities.map((a) => <Card key={a._id}><div style={{ fontSize: 13, fontWeight: 700 }}>{dateFmt(a.date)} - {a.type} - {a.subject}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{a.notes || '-'}</div></Card>)}
          {!activities.length && <div style={{ color: C.sub, fontSize: 13 }}>No activity for this contact.</div>}
        </div>
      )}

      {tab === 'Deals & Pipeline' && (
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Deals with this Contact</div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 8 }}>Deal Name</th><th style={{ padding: 8 }}>Volume</th><th style={{ padding: 8 }}>Value</th><th style={{ padding: 8 }}>Stage</th><th style={{ padding: 8 }}>Due</th></tr></thead>
              <tbody>
                {deals.map((d) => <tr key={d._id} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: 8 }}>{d.name}</td><td style={{ padding: 8 }}>{d.volumeKg || 0} kg</td><td style={{ padding: 8 }}>{currency(d.valueUSD)}</td><td style={{ padding: 8 }}>{d.stage}</td><td style={{ padding: 8 }}>{dateFmt(d.expectedCloseDate)}</td></tr>)}
                {!deals.length && <tr><td colSpan={5} style={{ padding: 8, color: C.sub }}>No deals for this contact.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>Total Pipeline Value with this contact: {currency(deals.reduce((s, d) => s + (d.valueUSD || 0), 0))}</div>
        </Card>
      )}

      {tab === 'Documents' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Documents</div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: docBusy ? 'not-allowed' : 'pointer', opacity: docBusy ? 0.6 : 1 }}>
              <span style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, background: '#fff' }}>Upload Document</span>
              <input
                type='file'
                accept='.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt'
                disabled={docBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUploadDocument(file)
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {(contact.kyc?.documents || []).map((d, i) => (
            <div key={`${d._id || d.name}-${i}`} style={{ fontSize: 12, color: C.sub, padding: '8px 0', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <a href={resolveDocUrl(d.relativePath)} target='_blank' rel='noreferrer' style={{ color: C.primary, fontWeight: 700, textDecoration: 'none' }}>{d.name || 'Document'}</a>
                <div>{d.status || 'Pending'} {d.verifiedDate ? `- ${d.verifiedDate}` : ''}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{d.uploadedByName || '-'} {d.uploadedAt ? `- ${dateFmt(d.uploadedAt)}` : ''}</div>
              </div>
              {d._id && <Button variant='secondary' disabled={docBusy} onClick={() => onDeleteDocument(d._id)}>Delete</Button>}
            </div>
          ))}
          {!(contact.kyc?.documents || []).length && <div style={{ color: C.sub, fontSize: 13 }}>No documents.</div>}
        </Card>
      )}

      {tab === 'Notes' && (
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Internal Notes</div>
          {(contact.notes || []).map((n, i) => <div key={`${n.createdAt || i}-${i}`} style={{ borderTop: i ? `1px solid ${C.border}` : 'none', padding: '8px 0' }}><div style={{ fontSize: 12, color: C.sub }}>{dateFmt(n.createdAt)} - {n.author || '-'}</div><div style={{ fontSize: 13, color: C.text }}>{n.text}</div></div>)}
          {!(contact.notes || []).length && <div style={{ color: C.sub, fontSize: 13 }}>No notes yet.</div>}
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder='Add internal note...' style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: 8, fontFamily: 'inherit', fontSize: 13 }} />
            <div><Button onClick={() => { onAddNote(noteText); setNoteText('') }}>+ Add Note</Button></div>
          </div>
        </Card>
      )}

      {tab === 'KYC & Compliance' && canSeeKyc && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontWeight: 800 }}>KYC STATUS</div>{sBadge(contact.kyc?.status || 'Not Started')}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: C.sub, display: 'grid', gap: 6 }}>
            <div>Risk Rating: {contact.kyc?.riskRating || '-'}</div>
            <div>Next Review: {contact.kyc?.nextReview || '-'}</div>
            <div>AML: {contact.kyc?.amlClear ? 'CLEAR' : 'Pending'}</div>
            <div>PEP: {contact.kyc?.pepClear ? 'CLEAR' : 'Pending'}</div>
            <div>Sanctions: {contact.kyc?.sanctionsClear ? 'CLEAR' : 'Pending'}</div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function SalesTab() {
  const { user } = useAuth()
  const perms = usePermissions()
  const { t } = useLanguage()
  const role = user?.role || ''
  const dep = (user?.department || '').toLowerCase()

  const isSuperAdmin = perms.isSuperAdmin
  const isSalesHead = isSuperAdmin || (role === 'department_head' && dep === 'sales')
  const isSalesRep = isSuperAdmin || isSalesHead || (role === 'department_user' && dep === 'sales')
  const isMarketManager = role === 'department_head' && dep === 'marketing'
  const isFinanceManager = role === 'department_head' && dep === 'finance'
  const canViewSalesCRM = isSalesRep || isMarketManager || isFinanceManager || perms.isManagement
  const canCreateDeal = isSuperAdmin || isSalesHead
  const canSeeReports = isSuperAdmin || isSalesHead
  const canDeleteAny = isSuperAdmin
  const canSeeKyc = isSuperAdmin || isSalesHead
  const canSeeDealFinancials = isSuperAdmin || isSalesHead || isFinanceManager

  const [section, setSection] = useState('dashboard')
  const [dashboard, setDashboard] = useState({ totalContacts: 0, activeLeads: 0, hotLeads: 0, dealsClosedWon: 0, pipelineValue: 0, winRate: 0, overdueFollowups: 0, revenueThisMonth: 0 })
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [leads, setLeads] = useState([])
  const [deals, setDeals] = useState([])
  const [activities, setActivities] = useState([])
  const [followups, setFollowups] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [filters, setFilters] = useState({ type: 'All', status: 'All', rep: 'All', search: '' })

  const [contactModal, setContactModal] = useState(false)
  const [contactEditing, setContactEditing] = useState(null)
  const [leadModal, setLeadModal] = useState(false)
  const [leadEditing, setLeadEditing] = useState(null)
  const [companyModal, setCompanyModal] = useState(false)
  const [companyEditing, setCompanyEditing] = useState(null)
  const [dealModal, setDealModal] = useState(false)
  const [dealEditing, setDealEditing] = useState(null)
  const [activityModal, setActivityModal] = useState(false)
  const [activityEditing, setActivityEditing] = useState(null)
  const [closeDealModal, setCloseDealModal] = useState(false)
  const [closeDealTarget, setCloseDealTarget] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)
  const [contactProfileTab, setContactProfileTab] = useState('Overview')
  const [leadView, setLeadView] = useState('Kanban')
  const [docBusy, setDocBusy] = useState(false)
  const [csvGuideKind, setCsvGuideKind] = useState('')

  const contactImportRef = useRef(null)
  const companyImportRef = useRef(null)
  const dealImportRef = useRef(null)

  const reps = useMemo(() => {
    const set = new Set()
    contacts.forEach((c) => c.assignedRep && set.add(c.assignedRep))
    leads.forEach((l) => l.assignedRep && set.add(l.assignedRep))
    deals.forEach((d) => d.assignedRep && set.add(d.assignedRep))
    return Array.from(set)
  }, [contacts, leads, deals])

  const loadAll = async () => {
    if (!canViewSalesCRM) return
    setBusy(true)
    try {
      const [d, c, co, l, de, a, f] = await Promise.all([getDashboard(), getContacts(filters), getCompanies(), getLeads(), getDeals(), getActivities(), getFollowups()])
      setDashboard(d?.data || {})
      setContacts(c?.data || [])
      setCompanies(co?.data || [])
      setLeads(l?.data || [])
      setDeals(de?.data || [])
      setActivities(a?.data || [])
      setFollowups(f?.data || [])
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to load CRM data')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewSalesCRM])

  useEffect(() => {
    if (!canViewSalesCRM) return
    const t = setTimeout(() => { getContacts(filters).then((r) => setContacts(r?.data || [])).catch(() => {}) }, 280)
    return () => clearTimeout(t)
  }, [filters, canViewSalesCRM])

  const contactTypeCounts = useMemo(() => {
    const res = { All: contacts.length, Customer: 0, Supplier: 0, Partner: 0, Prospect: 0 }
    contacts.forEach((c) => { res[c.contactType] = (res[c.contactType] || 0) + 1 })
    return res
  }, [contacts])

  const contactsByType = useMemo(() => (filters.type === 'All' ? contacts : contacts.filter((c) => c.contactType === filters.type)), [contacts, filters.type])
  const leadByStage = useMemo(() => {
    const map = {}
    LEAD_STAGES.forEach((s) => { map[s] = [] })
    leads.forEach((l) => { if (!map[l.stage]) map[l.stage] = []; map[l.stage].push(l) })
    return map
  }, [leads])
  const totalPipelineValue = useMemo(() => deals.filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage)).reduce((s, d) => s + (d.valueUSD || 0), 0), [deals])

  const saveContact = async (payload) => {
    try {
      if (contactEditing?._id) await updateContact(contactEditing._id, payload)
      else await createContact(payload)
      setContactModal(false)
      setContactEditing(null)
      await loadAll()
      setMsg('Contact saved')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to save contact')
    }
  }

  const saveLead = async (payload) => {
    try {
      payload.temperature = scoreToTemp(scoreTotal(payload.score))
      if (leadEditing?._id) await updateLead(leadEditing._id, payload)
      else await createLead(payload)
      setLeadModal(false)
      setLeadEditing(null)
      await loadAll()
      setMsg('Lead saved')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to save lead')
    }
  }

  const saveCompany = async (payload) => {
    try {
      if (companyEditing?._id) await updateCompany(companyEditing._id, payload)
      else await createCompany(payload)
      setCompanyModal(false)
      setCompanyEditing(null)
      await loadAll()
      setMsg('Company saved')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to save company')
    }
  }

  const saveDeal = async (payload) => {
    try {
      if (!canCreateDeal && !dealEditing?._id) { setMsg('Sales Rep cannot create deals'); return }
      if (dealEditing?._id) await updateDeal(dealEditing._id, payload)
      else await createDeal(payload)
      setDealModal(false)
      setDealEditing(null)
      await loadAll()
      setMsg('Deal saved')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to save deal')
    }
  }

  const saveActivity = async (payload) => {
    try {
      if (activityEditing?._id) await updateActivity(activityEditing._id, payload)
      else await createActivity(payload)
      setActivityModal(false)
      setActivityEditing(null)
      await loadAll()
      setMsg('Activity saved')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to save activity')
    }
  }

  const closeDealAction = async (payload) => {
    try {
      await closeDeal(closeDealTarget._id, payload)
      setCloseDealModal(false)
      setCloseDealTarget(null)
      await loadAll()
      setMsg('Deal closed')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to close deal')
    }
  }

  const deleteEntity = async (kind, id) => {
    try {
      if (kind === 'contact') await deleteContact(id)
      if (kind === 'lead') await deleteLead(id)
      if (kind === 'company') await deleteCompany(id)
      if (kind === 'deal') await deleteDeal(id)
      if (kind === 'activity') await deleteActivity(id)
      await loadAll()
      setMsg('Deleted')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Delete failed')
    }
  }

  const markDone = async (id) => {
    try {
      await markFollowupDone(id)
      await loadAll()
      setMsg('Follow-up marked done')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to mark done')
    }
  }

  const refreshSelectedContact = (contactId, allContacts = contacts) => {
    const refreshed = allContacts.find((c) => c._id === contactId)
    if (refreshed) setSelectedContact(refreshed)
  }

  const handleUploadContactDocument = async (file) => {
    if (!selectedContact?._id || !file) return
    try {
      setDocBusy(true)
      const res = await uploadContactDocument(selectedContact._id, file)
      const updated = res?.data
      if (updated) {
        setSelectedContact(updated)
        setContacts((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      } else {
        await loadAll()
      }
      setMsg('Document uploaded')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to upload document')
    } finally {
      setDocBusy(false)
    }
  }

  const handleDeleteContactDocument = async (docId) => {
    if (!selectedContact?._id || !docId) return
    try {
      setDocBusy(true)
      const res = await deleteContactDocument(selectedContact._id, docId)
      const updated = res?.data
      if (updated) {
        setSelectedContact(updated)
        setContacts((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      } else {
        await loadAll()
      }
      setMsg('Document deleted')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to delete document')
    } finally {
      setDocBusy(false)
    }
  }

  const handleExport = async (kind) => {
    try {
      let blob
      let fileName
      if (kind === 'contacts') {
        blob = await exportContactsCsv()
        fileName = 'crm-contacts.csv'
      } else if (kind === 'companies') {
        blob = await exportCompaniesCsv()
        fileName = 'crm-companies.csv'
      } else {
        blob = await exportDealsCsv()
        fileName = 'crm-deals.csv'
      }
      downloadBlob(blob, fileName)
      setMsg('CSV export downloaded')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to export CSV')
    }
  }

  const handleDownloadTemplate = async (kind) => {
    try {
      let blob
      let fileName
      if (kind === 'contacts') {
        blob = await getContactsTemplateCsv()
        fileName = 'crm-contacts-template.csv'
      } else if (kind === 'companies') {
        blob = await getCompaniesTemplateCsv()
        fileName = 'crm-companies-template.csv'
      } else {
        blob = await getDealsTemplateCsv()
        fileName = 'crm-deals-template.csv'
      }
      downloadBlob(blob, fileName)
      setMsg('Template downloaded')
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to download template')
    }
  }

  const handleImport = async (kind, file) => {
    if (!file) return
    try {
      setBusy(true)
      let res
      if (kind === 'contacts') res = await importContactsCsv(file)
      else if (kind === 'companies') res = await importCompaniesCsv(file)
      else res = await importDealsCsv(file)
      await loadAll()
      setMsg(`Imported ${res?.imported || 0} ${kind}`)
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Failed to import CSV')
    } finally {
      setBusy(false)
    }
  }

  const quickActions = [
    { label: '+ Add Contact', show: canViewSalesCRM, onClick: () => { setContactEditing(null); setContactModal(true) } },
    { label: '+ Add Lead', show: canViewSalesCRM, onClick: () => { setLeadEditing(null); setLeadModal(true) } },
    { label: '+ Log Activity', show: canViewSalesCRM, onClick: () => { setActivityEditing(null); setActivityModal(true) } },
    { label: '+ Create Deal', show: canCreateDeal, onClick: () => { setDealEditing(null); setDealModal(true) } },
    { label: 'Reports', show: canSeeReports, onClick: () => setMsg('Report export section can be plugged next') },
  ].filter((x) => x.show)

  const dashCards = [
    { k: 'totalContacts', label: 'TOTAL CONTACTS', value: dashboard.totalContacts || 0, hint: 'All types' },
    { k: 'activeLeads', label: 'ACTIVE LEADS', value: dashboard.activeLeads || 0, hint: 'In pipeline' },
    { k: 'hotLeads', label: 'HOT LEADS', value: `${dashboard.hotLeads || 0} 🔴`, hint: 'Act now' },
    { k: 'dealsClosedWon', label: 'DEALS CLOSED', value: `${dashboard.dealsClosedWon || 0} 🟢`, hint: 'This year' },
    { k: 'pipelineValue', label: 'PIPELINE VALUE', value: currency(dashboard.pipelineValue), hint: 'Estimated' },
    { k: 'winRate', label: 'WIN RATE', value: `${dashboard.winRate || 0}% 🟡`, hint: '' },
    { k: 'overdueFollowups', label: 'FOLLOW-UP OVERDUE', value: `${dashboard.overdueFollowups || 0} 🔴`, hint: 'Past due' },
    { k: 'revenueThisMonth', label: 'REVENUE THIS MONTH', value: currency(dashboard.revenueThisMonth), hint: '' },
  ]

  const visibleDashCards = dashCards.filter((x) => {
    if (isSuperAdmin || isSalesHead) return true
    if (isSalesRep) return ['totalContacts', 'activeLeads', 'hotLeads', 'overdueFollowups', 'revenueThisMonth'].includes(x.k)
    if (isMarketManager) return x.k !== 'revenueThisMonth'
    if (isFinanceManager) return ['pipelineValue', 'revenueThisMonth'].includes(x.k)
    return true
  })

  if (!canViewSalesCRM) return <Card><div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Sales CRM</div><div style={{ color: C.sub, fontSize: 13 }}>You do not have access to Sales CRM.</div></Card>

  return (
    <div style={{ background: C.bg, borderRadius: 14, padding: 12 }}>
      {msg && <div style={{ marginBottom: 10, background: 'rgba(0,104,74,0.08)', border: `1px solid ${C.border}`, color: C.primary, padding: '8px 10px', borderRadius: 8, fontSize: 12 }}>{msg}</div>}

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TabBtn active={section === 'dashboard'} onClick={() => setSection('dashboard')}>{t('crmDashboard')}</TabBtn>
            <TabBtn active={section === 'contacts'} onClick={() => setSection('contacts')}>{t('contacts')}</TabBtn>
            <TabBtn active={section === 'leads'} onClick={() => setSection('leads')}>{t('leads')}</TabBtn>
            <TabBtn active={section === 'companies'} onClick={() => setSection('companies')}>{t('companies')}</TabBtn>
            <TabBtn active={section === 'deals'} onClick={() => setSection('deals')}>{t('deals')}</TabBtn>
            <TabBtn active={section === 'activities'} onClick={() => setSection('activities')}>{t('activities')}</TabBtn>
            <TabBtn active={section === 'followups'} onClick={() => setSection('followups')}>{t('followups')}</TabBtn>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {quickActions.map((a) => <Button key={a.label} onClick={a.onClick}>{a.label}</Button>)}
          </div>
        </div>
      </Card>

      {section === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
            {visibleDashCards.map((x) => <Card key={x.k}><div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{x.label}</div><div style={{ fontSize: 24, color: C.text, fontWeight: 800, marginTop: 8 }}>{x.value}</div><div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{x.hint}</div></Card>)}
          </div>
          <Card><div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>CRM Quick Actions</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{quickActions.map((a) => <Button key={a.label} onClick={a.onClick}>{a.label}</Button>)}</div>{isSalesRep && !isSalesHead && <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>Sales Rep restrictions applied: deal creation and reports hidden.</div>}</Card>
        </>
      )}

      {section === 'contacts' && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Contacts Management</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => { setContactEditing(null); setContactModal(true) }}>+ Add Contact</Button>
                <Button variant='secondary' onClick={() => contactImportRef.current?.click()}>Import CSV</Button>
                <Button variant='secondary' onClick={() => handleDownloadTemplate('contacts')}>Template</Button>
                <Button variant='secondary' onClick={() => setCsvGuideKind('contacts')}>Guide</Button>
                <Button variant='secondary' onClick={() => handleExport('contacts')}>Export</Button>
                <input ref={contactImportRef} type='file' accept='.csv' style={{ display: 'none' }} onChange={(e) => { handleImport('contacts', e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {CONTACT_TYPES.map((t) => <TabBtn key={t} active={filters.type === t} onClick={() => setFilters((p) => ({ ...p, type: t }))}>{t === 'All' ? 'All Contacts' : `${t}s`} ({contactTypeCounts[t] || 0})</TabBtn>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: 8, marginBottom: 10 }}>
              <Select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} options={CONTACT_TYPES} />
              <Select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} options={CONTACT_STATUS} />
              <Select value={filters.rep} onChange={(e) => setFilters((p) => ({ ...p, rep: e.target.value }))} options={['All', ...reps]} />
              <Button variant='secondary' onClick={() => setFilters({ type: 'All', status: 'All', rep: 'All', search: '' })}>Reset</Button>
              <Input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder='Search name, company, email...' />
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 8 }}>AVT</th><th style={{ padding: 8 }}>NAME</th><th style={{ padding: 8 }}>COMPANY</th><th style={{ padding: 8 }}>TYPE</th><th style={{ padding: 8 }}>COUNTRY</th><th style={{ padding: 8 }}>STATUS</th><th style={{ padding: 8 }}>REP</th><th style={{ padding: 8 }}>ACTIONS</th></tr></thead>
                <tbody>
                  {contactsByType.map((c) => (
                    <tr key={c._id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: 8, fontWeight: 700 }}>{`${(c.firstName || '').charAt(0)}${(c.lastName || '').charAt(0)}`.toUpperCase()}</td>
                      <td style={{ padding: 8 }}>{c.firstName} {c.lastName}</td>
                      <td style={{ padding: 8 }}>{c.companyName || '-'}</td>
                      <td style={{ padding: 8 }}>{c.contactType}</td>
                      <td style={{ padding: 8 }}>{c.country || '-'}</td>
                      <td style={{ padding: 8 }}>{sBadge(c.status)}</td>
                      <td style={{ padding: 8 }}>{c.assignedRep || '-'}</td>
                      <td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Button variant='secondary' onClick={() => { setSelectedContact(c); setContactProfileTab('Overview') }}>View</Button>
                        <Button variant='secondary' onClick={() => { setContactEditing(c); setContactModal(true) }}>Edit</Button>
                        {canDeleteAny && <Button variant='secondary' onClick={() => deleteEntity('contact', c._id)}>Delete</Button>}
                      </td>
                    </tr>
                  ))}
                  {!contactsByType.length && <tr><td colSpan={8} style={{ padding: 12, color: C.sub }}>No contacts found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Modal open={!!selectedContact} onClose={() => setSelectedContact(null)} title='CONTACT PROFILE' width={1080}>
            {selectedContact && (
              <ContactProfile
                contact={selectedContact}
                tab={contactProfileTab}
                setTab={setContactProfileTab}
                activities={activities.filter((a) => a.contactId === selectedContact._id)}
                deals={deals.filter((d) => d.contactId === selectedContact._id || d.contactName === `${selectedContact.firstName} ${selectedContact.lastName}`)}
                canSeeKyc={canSeeKyc}
                onLogActivity={() => { setSelectedContact(null); setActivityEditing({ contactId: selectedContact._id, contactName: `${selectedContact.firstName} ${selectedContact.lastName}` }); setActivityModal(true) }}
                onAddNote={async (txt) => {
                  if (!txt) return
                  await addContactNote(selectedContact._id, { text: txt, isPrivate: false })
                  await loadAll()
                  refreshSelectedContact(selectedContact._id)
                }}
                onUploadDocument={handleUploadContactDocument}
                onDeleteDocument={handleDeleteContactDocument}
                docBusy={docBusy}
              />
            )}
          </Modal>
        </>
      )}

      {section === 'leads' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Lead Pipeline</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => { setLeadEditing(null); setLeadModal(true) }}>+ Add Lead</Button>
              <TabBtn active={leadView === 'List'} onClick={() => setLeadView('List')}>List View</TabBtn>
              <TabBtn active={leadView === 'Kanban'} onClick={() => setLeadView('Kanban')}>Kanban View</TabBtn>
            </div>
          </div>
          {leadView === 'Kanban' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(210px, 1fr))', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {LEAD_STAGES.map((st) => (
                <Card key={st} style={{ minHeight: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><div style={{ fontWeight: 800, fontSize: 12 }}>{st.toUpperCase()}</div><div style={{ fontSize: 12, color: C.sub }}>({(leadByStage[st] || []).length})</div></div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(leadByStage[st] || []).map((l) => {
                      const total = scoreTotal(l.score)
                      return (
                        <div key={l._id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontWeight: 700, color: C.text }}>{l.name}</div>{sBadge(scoreToTemp(total))}</div>
                          <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{l.source || '-'}</div>
                          <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Rep: {l.assignedRep || '-'}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>Est: {currency(l.estValueUSD)} | {l.volumeKg || 0} kg</div>
                          <div style={{ fontSize: 11, color: C.sub }}>Next: {dateFmt(l.nextAction?.dueDate || l.expectedCloseDate)}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <Button variant='secondary' onClick={() => { setLeadEditing(l); setLeadModal(true) }}>View</Button>
                            <Button variant='secondary' onClick={() => { setActivityEditing({ leadId: l._id, contactName: l.contactName, dealName: l.name }); setActivityModal(true) }}>Log</Button>
                          </div>
                          <div style={{ marginTop: 6 }}><Select value={l.stage} onChange={async (e) => { try { await changeLeadStage(l._id, e.target.value, 'Stage changed from board'); await loadAll() } catch {} }} options={LEAD_STAGES} /></div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 8 }}>LEAD</th><th style={{ padding: 8 }}>COMPANY</th><th style={{ padding: 8 }}>STAGE</th><th style={{ padding: 8 }}>SCORE</th><th style={{ padding: 8 }}>VALUE</th><th style={{ padding: 8 }}>REP</th><th style={{ padding: 8 }}>ACTIONS</th></tr></thead>
                <tbody>
                  {leads.map((l) => <tr key={l._id} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: 8 }}>{l.name}</td><td style={{ padding: 8 }}>{l.companyName || '-'}</td><td style={{ padding: 8 }}>{l.stage}</td><td style={{ padding: 8 }}>{scoreTotal(l.score)}/100</td><td style={{ padding: 8 }}>{currency(l.estValueUSD)}</td><td style={{ padding: 8 }}>{l.assignedRep || '-'}</td><td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button variant='secondary' onClick={() => { setLeadEditing(l); setLeadModal(true) }}>Edit</Button>{canDeleteAny && <Button variant='secondary' onClick={() => deleteEntity('lead', l._id)}>Delete</Button>}</td></tr>)}
                  {!leads.length && <tr><td colSpan={7} style={{ padding: 12, color: C.sub }}>No leads found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === 'companies' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Company / Account Management</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => { setCompanyEditing(null); setCompanyModal(true) }}>+ Add Company</Button>
              <Button variant='secondary' onClick={() => companyImportRef.current?.click()}>Import</Button>
              <Button variant='secondary' onClick={() => handleDownloadTemplate('companies')}>Template</Button>
              <Button variant='secondary' onClick={() => setCsvGuideKind('companies')}>Guide</Button>
              <Button variant='secondary' onClick={() => handleExport('companies')}>Export</Button>
              <input ref={companyImportRef} type='file' accept='.csv' style={{ display: 'none' }} onChange={(e) => { handleImport('companies', e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 8 }}>COMPANY</th><th style={{ padding: 8 }}>TYPE</th><th style={{ padding: 8 }}>COUNTRY</th><th style={{ padding: 8 }}>CONTACTS</th><th style={{ padding: 8 }}>DEALS</th><th style={{ padding: 8 }}>VALUE</th><th style={{ padding: 8 }}>STATUS</th><th style={{ padding: 8 }}>ACTIONS</th></tr></thead>
              <tbody>
                {companies.map((co) => <tr key={co._id} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: 8 }}>{co.name}</td><td style={{ padding: 8 }}>{co.type}</td><td style={{ padding: 8 }}>{co.country || '-'}</td><td style={{ padding: 8 }}>{co.contactCount || 0}</td><td style={{ padding: 8 }}>{co.dealCount || 0}</td><td style={{ padding: 8 }}>{currency(co.totalValue || 0)}</td><td style={{ padding: 8 }}>{sBadge(co.status)}</td><td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button variant='secondary' onClick={() => { setCompanyEditing(co); setCompanyModal(true) }}>Edit</Button>{canDeleteAny && <Button variant='secondary' onClick={() => deleteEntity('company', co._id)}>Delete</Button>}</td></tr>)}
                {!companies.length && <tr><td colSpan={8} style={{ padding: 12, color: C.sub }}>No companies yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {section === 'deals' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Deals / Opportunities</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Total Pipeline Value: {currency(totalPipelineValue)} across {deals.filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage)).length} active deals</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button disabled={!canCreateDeal} onClick={() => { setDealEditing(null); setDealModal(true) }}>+ Create Deal</Button>
              <Button variant='secondary' onClick={() => dealImportRef.current?.click()} disabled={!canCreateDeal}>Import CSV</Button>
              <Button variant='secondary' onClick={() => handleDownloadTemplate('deals')}>Template</Button>
              <Button variant='secondary' onClick={() => setCsvGuideKind('deals')}>Guide</Button>
              <Button variant='secondary' onClick={() => handleExport('deals')}>Export CSV</Button>
              <input ref={dealImportRef} type='file' accept='.csv' style={{ display: 'none' }} onChange={(e) => { handleImport('deals', e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </div>
          {!canCreateDeal && <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>Role rule: Sales Rep cannot create deals.</div>}
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 8 }}>DEAL NAME</th><th style={{ padding: 8 }}>COMPANY</th><th style={{ padding: 8 }}>KG</th><th style={{ padding: 8 }}>VALUE</th><th style={{ padding: 8 }}>STAGE</th><th style={{ padding: 8 }}>CLOSE DATE</th><th style={{ padding: 8 }}>REP</th><th style={{ padding: 8 }}>ACTIONS</th></tr></thead>
              <tbody>
                {deals.map((d) => <tr key={d._id} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: 8 }}>{d.name}</td><td style={{ padding: 8 }}>{d.companyName || '-'}</td><td style={{ padding: 8 }}>{d.volumeKg || 0}</td><td style={{ padding: 8 }}>{currency(d.valueUSD)}</td><td style={{ padding: 8 }}>{sBadge(d.stage)}</td><td style={{ padding: 8 }}>{dateFmt(d.expectedCloseDate)}</td><td style={{ padding: 8 }}>{d.assignedRep || '-'}</td><td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button variant='secondary' onClick={() => { setDealEditing(d); setDealModal(true) }}>Edit</Button>{(isSuperAdmin || isSalesHead) && !['Closed Won', 'Closed Lost'].includes(d.stage) && <Button variant='secondary' onClick={() => { setCloseDealTarget(d); setCloseDealModal(true) }}>Close</Button>}{canDeleteAny && <Button variant='secondary' onClick={() => deleteEntity('deal', d._id)}>Delete</Button>}</td></tr>)}
                {!deals.length && <tr><td colSpan={8} style={{ padding: 12, color: C.sub }}>No deals yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {section === 'activities' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Activity Timeline</div><Button onClick={() => { setActivityEditing(null); setActivityModal(true) }}>+ Log Activity</Button></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {activities.map((a) => <div key={a._id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><div style={{ fontWeight: 700, color: C.text }}>{dateFmt(a.date)} - {a.type} - {a.contactName || '-'}</div><div style={{ fontSize: 12, color: C.sub }}>{a.createdByName || '-'}</div></div><div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>{a.subject}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{a.notes || '-'}</div>{a.nextAction?.description && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Next: {a.nextAction.description} ({dateFmt(a.nextAction.dueDate)})</div>}<div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Button variant='secondary' onClick={() => { setActivityEditing(a); setActivityModal(true) }}>Edit</Button><Button variant='secondary' onClick={() => deleteEntity('activity', a._id)}>Delete</Button></div></div>)}
            {!activities.length && <div style={{ color: C.sub, fontSize: 13 }}>No activities logged.</div>}
          </div>
        </Card>
      )}

      {section === 'followups' && <Card><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Follow-up Dashboard</div><Button onClick={() => { setActivityEditing(null); setActivityModal(true) }}>+ Add Follow-up</Button></div><FollowupGroups followups={followups} onMarkDone={markDone} onEdit={(f) => { setActivityEditing(f); setActivityModal(true) }} /></Card>}

      <ContactModal open={contactModal} onClose={() => { setContactModal(false); setContactEditing(null) }} onSave={saveContact} initial={contactEditing} reps={reps.length ? reps : [user?.name || '']} />
      <LeadModal open={leadModal} onClose={() => { setLeadModal(false); setLeadEditing(null) }} onSave={saveLead} initial={leadEditing} reps={reps.length ? reps : [user?.name || '']} contacts={contacts} />
      <CompanyModal open={companyModal} onClose={() => { setCompanyModal(false); setCompanyEditing(null) }} onSave={saveCompany} initial={companyEditing} />
      <DealModal open={dealModal} onClose={() => { setDealModal(false); setDealEditing(null) }} onSave={saveDeal} initial={dealEditing} reps={reps.length ? reps : [user?.name || '']} companies={companies} contacts={contacts} leads={leads} canSeeDealFinancials={canSeeDealFinancials} />
      <ActivityModal open={activityModal} onClose={() => { setActivityModal(false); setActivityEditing(null) }} onSave={saveActivity} initial={activityEditing} reps={reps.length ? reps : [user?.name || '']} contacts={contacts} deals={deals} />
      <CloseDealModal open={closeDealModal} onClose={() => { setCloseDealModal(false); setCloseDealTarget(null) }} onSave={closeDealAction} deal={closeDealTarget} />
      <CsvGuideModal kind={csvGuideKind} onClose={() => setCsvGuideKind('')} />

      {busy && <div style={{ position: 'fixed', right: 12, bottom: 12, background: C.primary, color: '#fff', padding: '7px 10px', borderRadius: 8, fontSize: 12 }}>Loading CRM...</div>}
    </div>
  )
}
