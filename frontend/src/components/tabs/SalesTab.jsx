// FILE: src/components/tabs/SalesTab.jsx
// Sales & Marketing — 5 sub-tabs, 5-role access, kanban pipeline, expandable lead logs

import { useState } from 'react'
import { usePermissions } from '../../hooks/usePermissions'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  card:'#ffffff', card2:'#f8f9fa',
  border:'rgba(0,104,74,0.12)', border2:'rgba(0,104,74,0.28)',
  acc:'#00684A', accH:'#13AA52',
  grn:'#22c55e', blu:'#60a5fa', red:'#f87171', amb:'#fbbf24', pur:'#c084fc', tel:'#2dd4bf',
  t1:'#1c2a33', t2:'#374151', t3:'#6b7280', t4:'#9ca3af', t5:'#d1d5db',
}

// ─── Pipeline config ───────────────────────────────────────────────────────────
const PIPE_STAGES = ['Prospect','Contacted','Qualified','Negotiating','Agreement Signed','Active']
const PIPE_COLORS = ['#6b7280','#60a5fa','#c084fc','#fbbf24','#22c55e','#00684A']

// ─── Seed data ─────────────────────────────────────────────────────────────────
const INIT_MARKETS = [
  { id:1, country:'Kazakhstan', flag:'🇰🇿', st:'Active Partner',    contact:'Nursultan Abenov', company:'KazGold Distributors',       last:'Apr 9, 2025',  next:'Quarterly review call — Apr 20',              notes:'First and strongest partner. MOU signed Feb 2025.',                 assigned:'Layla S.' },
  { id:2, country:'Uzbekistan', flag:'🇺🇿', st:'MOU Signed',        contact:'Dilnoza Yusupova', company:'Tashkent Trading Co',          last:'Apr 5, 2025',  next:'Final contract draft review — Apr 18',        notes:'Strong interest in 50kg/month. Awaiting legal sign-off.',           assigned:'Layla S.' },
  { id:3, country:'Russia',     flag:'🇷🇺', st:'Meeting Scheduled', contact:'Alexei Petrov',    company:'Moscow Metals Ltd',           last:'Apr 2, 2025',  next:'Video call Apr 15 — discuss compliance docs', notes:'Interested but cautious. Needs full compliance package.',           assigned:'Ahmed K.' },
  { id:4, country:'UAE',        flag:'🇦🇪', st:'Contacted',         contact:'Khalid Al-Rashid', company:'Dubai Commodity House',        last:'Mar 28, 2025', next:'Follow up email — Apr 14',                    notes:'Met at Dubai Expo. High potential. Awaiting proposal.',            assigned:'Ahmed K.' },
  { id:5, country:'China',      flag:'🇨🇳', st:'Not Contacted',     contact:'Li Wei',           company:'Shenzhen Gold Exchange',       last:'—',            next:'Cold outreach — email proposal by Apr 20',    notes:'Identified via trade directory. Strong volume potential.',          assigned:'Layla S.' },
  { id:6, country:'Turkey',     flag:'🇹🇷', st:'Contacted',         contact:'Mehmet Yilmaz',    company:'Istanbul Precious Metals',    last:'Mar 25, 2025', next:'Send product deck and certifications — Apr 16',notes:'Referral from KazGold. Good fit for Eastern Europe distribution.',  assigned:'Ahmed K.' },
]

const INIT_PARTNERS = [
  { id:1, name:'KazGold Distributors',   country:'Kazakhstan', contact:'Nursultan Abenov', deal:'80 kg/month',  stage:5, mgr:'Layla S.', last:'Apr 9, 2025',  next:'Quarterly review Apr 20',     docs:['MOU','Contract'] },
  { id:2, name:'Tashkent Trading Co',    country:'Uzbekistan', contact:'Dilnoza Yusupova', deal:'50 kg/month',  stage:4, mgr:'Layla S.', last:'Apr 5, 2025',  next:'Final contract review Apr 18', docs:['MOU'] },
  { id:3, name:'Moscow Metals Ltd',      country:'Russia',     contact:'Alexei Petrov',    deal:'100 kg/month', stage:3, mgr:'Ahmed K.', last:'Apr 2, 2025',  next:'Compliance docs call Apr 15',  docs:['NDA'] },
  { id:4, name:'Dubai Commodity House',  country:'UAE',        contact:'Khalid Al-Rashid', deal:'60 kg/month',  stage:2, mgr:'Ahmed K.', last:'Mar 28, 2025', next:'Send proposal Apr 14',         docs:[] },
  { id:5, name:'Istanbul Precious Metals',country:'Turkey',    contact:'Mehmet Yilmaz',    deal:'40 kg/month',  stage:1, mgr:'Ahmed K.', last:'Mar 25, 2025', next:'Send product deck Apr 16',     docs:[] },
  { id:6, name:'Shenzhen Gold Exchange', country:'China',      contact:'Li Wei',           deal:'200 kg/month', stage:0, mgr:'Layla S.', last:'—',            next:'Initial outreach Apr 20',      docs:[] },
  { id:7, name:'Almaty Commodity Board', country:'Kazakhstan', contact:'Aibek Duisov',     deal:'30 kg/month',  stage:2, mgr:'Layla S.', last:'Apr 1, 2025',  next:'Qualification call Apr 17',    docs:[] },
]

const INIT_LEADS = [
  { id:1, name:'Farida Islamova',   co:'Bishkek Gold Traders',         src:'Exhibition',       type:'Distributor',      st:'Hot',           pri:'High',   rep:'Layla S.', exp:'2025-05-15',
    log:[
      { date:'Apr 8, 2025', who:'Layla S.', txt:'Follow-up call. Very interested in 20kg/month. Requested formal proposal.', out:'Proposal sent' },
      { date:'Apr 1, 2025', who:'Ahmed K.', txt:'Initial contact at Bishkek Trade Expo. Collected business card and sent intro email.', out:'Intro email sent' },
    ]},
  { id:2, name:'Chen Jian',         co:'Hong Kong Metals Corp',        src:'LinkedIn',         type:'Buyer',            st:'Being Nurtured', pri:'High',   rep:'Ahmed K.', exp:'2025-06-01',
    log:[{ date:'Apr 6, 2025', who:'Ahmed K.', txt:'LinkedIn message replied. Interested in spot purchases initially. Wants compliance docs.', out:'Docs sent' }]},
  { id:3, name:'Boris Ivanov',      co:'Novosibirsk Refinery',         src:'Government Intro', type:'Agent',            st:'New',            pri:'Medium', rep:'Layla S.', exp:'2025-07-01',
    log:[{ date:'Apr 3, 2025', who:'Layla S.', txt:'Introduction via Kazakh Ministry of Trade. Scheduled intro call.', out:'Call scheduled Apr 18' }]},
  { id:4, name:'Sara Al-Mansoori',  co:'Abu Dhabi Investment Office',  src:'Referral',         type:'Investor Interest',st:'Hot',            pri:'High',   rep:'Ahmed K.', exp:'2025-05-01',
    log:[
      { date:'Apr 9, 2025', who:'Ahmed K.', txt:'Second meeting. Very serious about joint venture. Needs financials and compliance overview.', out:'Pending MD approval' },
      { date:'Mar 30, 2025',who:'Ahmed K.', txt:'First call via referral. Investor interested in equity stake in sourcing operation.', out:'Positive — follow up' },
    ]},
  { id:5, name:'Nguyen Van Minh',   co:'Ho Chi Minh Jewelry Alliance', src:'Cold Outreach',    type:'Distributor',      st:'Being Nurtured', pri:'Medium', rep:'Layla S.', exp:'2025-07-15',
    log:[{ date:'Apr 4, 2025', who:'Layla S.', txt:'Cold email replied. Asking for product certifications and pricing sheet.', out:'Certs sent' }]},
  { id:6, name:'Ahmed Al-Khouri',   co:'Riyadh Commodities House',     src:'Exhibition',       type:'Buyer',            st:'Lost',           pri:'Low',    rep:'Ahmed K.', exp:'',
    log:[{ date:'Mar 20, 2025',who:'Ahmed K.', txt:'Three follow-up emails with no response. Closing as lost lead.', out:'Lead closed — Lost' }]},
]

const INIT_VIS = [
  { id:1, name:'Kazakhstan Mining Expo 2025',        type:'Exhibition',               st:'Completed',  owner:'Layla S.', buda:'$8,000',  buds:'$7,400', region:'Central Asia',  expected:'80 qualified contacts',       actual:'94 contacts, 12 follow-ups',        date:'Mar 15, 2025' },
  { id:2, name:'LinkedIn Company Page Launch',       type:'Digital',                  st:'In Progress',owner:'Ahmed K.', buda:'$1,500',  buds:'$600',   region:'Global',        expected:'500 followers in 60 days',    actual:'',                                  date:'Apr 1, 2025'  },
  { id:3, name:'Gold Industry Newsletter Feature',   type:'PR',                       st:'Completed',  owner:'Layla S.', buda:'$2,000',  buds:'$2,000', region:'CIS Region',    expected:'10,000 readers',              actual:'13,400 readers — 3 inbound inquiries',date:'Mar 1, 2025'  },
  { id:4, name:'Astana Economic Forum Participation',type:'Government Event',          st:'Planned',    owner:'Layla S.', buda:'$12,000', buds:'$0',     region:'Kazakhstan',    expected:'Minister-level introductions',actual:'',                                  date:'Jun 5, 2025'  },
  { id:5, name:'KazGold Partnership Announcement',   type:'Partnership Announcement', st:'Planned',    owner:'Ahmed K.', buda:'$500',    buds:'$0',     region:'CIS / MENA',    expected:'Press coverage + inbound leads',actual:'',                                date:'May 1, 2025'  },
  { id:6, name:'Dubai Expo Gold Pavilion',           type:'Exhibition',               st:'Planned',    owner:'Ahmed K.', buda:'$15,000', buds:'$0',     region:'MENA / Global', expected:'200 qualified contacts',      actual:'',                                  date:'Oct 10, 2025' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtD(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

const BADGE_CFG = {
  'Active Partner':          { bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Active':                  { bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Completed':               { bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Hot':                     { bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Agreement Signed':        { bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Partnership Announcement':{ bg:'rgba(34,197,94,0.1)',   color:'#22c55e' },
  'Negotiating':             { bg:'rgba(251,191,36,0.1)',  color:'#fbbf24' },
  'Meeting Scheduled':       { bg:'rgba(251,191,36,0.1)',  color:'#fbbf24' },
  'Being Nurtured':          { bg:'rgba(251,191,36,0.1)',  color:'#fbbf24' },
  'Medium':                  { bg:'rgba(251,191,36,0.1)',  color:'#fbbf24' },
  'In Progress':             { bg:'rgba(96,165,250,0.1)',  color:'#60a5fa' },
  'Contacted':               { bg:'rgba(96,165,250,0.1)',  color:'#60a5fa' },
  'Digital':                 { bg:'rgba(96,165,250,0.1)',  color:'#60a5fa' },
  'Qualified':               { bg:'rgba(192,132,252,0.1)', color:'#c084fc' },
  'PR':                      { bg:'rgba(192,132,252,0.1)', color:'#c084fc' },
  'MOU Signed':              { bg:'rgba(45,212,191,0.1)',  color:'#2dd4bf' },
  'Government Event':        { bg:'rgba(45,212,191,0.1)',  color:'#2dd4bf' },
  'High':                    { bg:'rgba(248,113,113,0.1)', color:'#f87171' },
  'Lost':                    { bg:'rgba(248,113,113,0.1)', color:'#f87171' },
  'Exhibition':              { bg:'rgba(0,104,74,0.15)', color:'#00684A' },
}
function Badge({ s }) {
  const cf = BADGE_CFG[s] || { bg:'rgba(255,255,255,0.06)', color:'#9ca3af' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:cf.bg, color:cf.color, whiteSpace:'nowrap' }}>{s}</span>
}

function ProgRow({ label, pct, color, count }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
      <div style={{ width:160, color:C.t2, fontWeight:500, flexShrink:0 }}>{label}</div>
      <div style={{ flex:1, height:7, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4 }} />
      </div>
      <div style={{ width:30, textAlign:'right', fontWeight:700, color:C.t1, fontSize:12 }}>{count ?? `${pct}%`}</div>
    </div>
  )
}

function Card({ children, style = {} }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 18px', ...style }}>{children}</div>
}
function TableWrap({ children }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>{children}</div>
}
function SectionHeader({ title, subtitle, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
      <div>
        <div style={{ fontSize:17, fontWeight:700, color:C.t1 }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>{subtitle}</div>}
      </div>
      {children && <div style={{ display:'flex', gap:8, flexShrink:0, marginTop:2 }}>{children}</div>}
    </div>
  )
}
function BtnPri({ onClick, children }) {
  const [h, sH] = useState(false)
  return <button onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
    style={{ background:h?C.accH:C.acc, color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6, transition:'background .15s' }}>{children}</button>
}
function BtnSec({ onClick, children }) {
  const [h, sH] = useState(false)
  return <button onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
    style={{ background:h?'rgba(0,104,74,0.12)':'rgba(0,104,74,0.06)', color:h?C.t1:C.t2, border:`1px solid ${C.border2}`, padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>{children}</button>
}
function RestrictNotice({ text }) {
  return (
    <div style={{ background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.18)', borderRadius:9, padding:'13px 16px', fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:10, lineHeight:1.5 }}>
      <span style={{ fontSize:18, flexShrink:0 }}>🔒</span> {text}
    </div>
  )
}
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{ position:'fixed', bottom:20, right:20, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid ${C.acc}`, borderRadius:10, padding:'12px 18px', fontSize:13, color:C.t1, zIndex:2000, minWidth:240, boxShadow:'0 8px 32px rgba(0,0,0,.15)', animation:'salesToast .3s ease' }}>
      <style>{`@keyframes salesToast{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ fontWeight:700, marginBottom:2 }}>{toast.title}</div>
      <div style={{ fontSize:12, color:C.t3 }}>{toast.msg}</div>
    </div>
  )
}

// ─── Table styles ──────────────────────────────────────────────────────────────
const TH = { fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.07em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,0.02)', whiteSpace:'nowrap' }
const TD = { padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13, color:C.t2, verticalAlign:'middle' }

// ─── Modal shared ──────────────────────────────────────────────────────────────
const iSt = { width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(0,104,74,.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:C.t1, fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' }
function ML({ c }) { return <div style={{ fontSize:11, fontWeight:600, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{c}</div> }
function MI(p) { return <input {...p} style={iSt} /> }
function MS({ children, ...p }) { return <select {...p} style={{ ...iSt, appearance:'auto' }}>{children}</select> }
function MTA(p) { return <textarea {...p} style={{ ...iSt, resize:'vertical', minHeight:65 }} /> }
function MModal({ title, subtitle, onClose, onSave, saveLabel='Save', children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#ffffff', border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width:480, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:C.t1, marginBottom:4 }}>{title}</h3>
        <div style={{ fontSize:12, color:C.t3, marginBottom:18 }}>{subtitle}</div>
        {children}
        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(0,0,0,0.1)', background:'#f3f4f6', color:C.t2 }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>Cancel</button>
          <button onClick={onSave} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.acc, color:'#fff' }}
            onMouseEnter={e => e.currentTarget.style.background=C.accH}
            onMouseLeave={e => e.currentTarget.style.background=C.acc}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>{children}</div> }

// ─── MODAL: Add Market ─────────────────────────────────────────────────────────
function ModalMarket({ onClose, onAdd }) {
  const [f, sF] = useState({ country:'', flag:'', contact:'', company:'', st:'Not Contacted', assigned:'', next:'', notes:'' })
  const s = k => e => sF(p => ({ ...p, [k]:e.target.value }))
  return (
    <MModal title="Add Market" subtitle="Register a new market for outreach tracking" onClose={onClose} onSave={() => f.country.trim() && onAdd(f)} saveLabel="Add Market">
      <G2><div><ML c="Country" /><MI value={f.country} onChange={s('country')} placeholder="e.g. Kazakhstan" /></div>
          <div><ML c="Flag Emoji" /><MI value={f.flag} onChange={s('flag')} placeholder="e.g. 🇰🇿" /></div></G2>
      <G2><div><ML c="Key Contact" /><MI value={f.contact} onChange={s('contact')} placeholder="Person name" /></div>
          <div><ML c="Company" /><MI value={f.company} onChange={s('company')} placeholder="Company name" /></div></G2>
      <G2><div><ML c="Status" /><MS value={f.st} onChange={s('st')}>{['Not Contacted','Contacted','Meeting Scheduled','MOU Signed','Active Partner'].map(o=><option key={o}>{o}</option>)}</MS></div>
          <div><ML c="Assigned To" /><MI value={f.assigned} onChange={s('assigned')} placeholder="Sales rep name" /></div></G2>
      <ML c="Next Action" /><MI value={f.next} onChange={s('next')} placeholder="e.g. Schedule intro call by May 5" />
      <ML c="Notes" /><MTA value={f.notes} onChange={s('notes')} placeholder="Any context about this market..." />
    </MModal>
  )
}

// ─── MODAL: Add Partner ────────────────────────────────────────────────────────
function ModalPartner({ onClose, onAdd }) {
  const [f, sF] = useState({ name:'', country:'', contact:'', deal:'', stage:'0', mgr:'', next:'' })
  const s = k => e => sF(p => ({ ...p, [k]:e.target.value }))
  return (
    <MModal title="Add Partner / Distributor" subtitle="Add a new partner to the pipeline" onClose={onClose} onSave={() => f.name.trim() && onAdd(f)} saveLabel="Add Partner">
      <G2><div><ML c="Company Name" /><MI value={f.name} onChange={s('name')} placeholder="Company name" /></div>
          <div><ML c="Country" /><MI value={f.country} onChange={s('country')} placeholder="Country" /></div></G2>
      <G2><div><ML c="Contact Person" /><MI value={f.contact} onChange={s('contact')} placeholder="Contact name" /></div>
          <div><ML c="Deal Size Est." /><MI value={f.deal} onChange={s('deal')} placeholder="e.g. 50 kg/month" /></div></G2>
      <G2><div><ML c="Pipeline Stage" /><MS value={f.stage} onChange={s('stage')}>
            {PIPE_STAGES.map((st,i) => <option key={i} value={i}>{st}</option>)}
          </MS></div>
          <div><ML c="Managed By" /><MI value={f.mgr} onChange={s('mgr')} placeholder="Sales rep" /></div></G2>
      <ML c="Next Step & Due Date" /><MI value={f.next} onChange={s('next')} placeholder="e.g. Send NDA draft by Apr 25" />
    </MModal>
  )
}

// ─── MODAL: Add Lead ───────────────────────────────────────────────────────────
function ModalLead({ onClose, onAdd }) {
  const [f, sF] = useState({ name:'', co:'', src:'Referral', type:'Buyer', pri:'High', rep:'', exp:'' })
  const s = k => e => sF(p => ({ ...p, [k]:e.target.value }))
  return (
    <MModal title="Add Lead" subtitle="Register a new prospect or interested party" onClose={onClose} onSave={() => f.name.trim() && onAdd(f)} saveLabel="Add Lead">
      <G2><div><ML c="Lead Name" /><MI value={f.name} onChange={s('name')} placeholder="Person or company name" /></div>
          <div><ML c="Company" /><MI value={f.co} onChange={s('co')} placeholder="Company name" /></div></G2>
      <G2><div><ML c="Source" /><MS value={f.src} onChange={s('src')}>{['Referral','Exhibition','LinkedIn','Cold Outreach','Government Intro','Website','Other'].map(o=><option key={o}>{o}</option>)}</MS></div>
          <div><ML c="Lead Type" /><MS value={f.type} onChange={s('type')}>{['Buyer','Distributor','Agent','Investor Interest'].map(o=><option key={o}>{o}</option>)}</MS></div></G2>
      <G2><div><ML c="Priority" /><MS value={f.pri} onChange={s('pri')}>{['High','Medium','Low'].map(o=><option key={o}>{o}</option>)}</MS></div>
          <div><ML c="Assigned Rep" /><MI value={f.rep} onChange={s('rep')} placeholder="Sales rep name" /></div></G2>
      <ML c="Expected Conversion Date" /><input type="date" value={f.exp} onChange={s('exp')} style={iSt} />
    </MModal>
  )
}

// ─── MODAL: Add Initiative ─────────────────────────────────────────────────────
function ModalInitiative({ onClose, onAdd }) {
  const [f, sF] = useState({ name:'', type:'Exhibition', st:'Planned', owner:'', buda:'', region:'', expected:'' })
  const s = k => e => sF(p => ({ ...p, [k]:e.target.value }))
  return (
    <MModal title="Add Visibility Initiative" subtitle="Track a marketing or brand-building activity" onClose={onClose} onSave={() => f.name.trim() && onAdd(f)} saveLabel="Add Initiative">
      <G2><div><ML c="Initiative Name" /><MI value={f.name} onChange={s('name')} placeholder="e.g. xg Trade Fair 2026" /></div>
          <div><ML c="Type" /><MS value={f.type} onChange={s('type')}>{['Exhibition','Digital','PR','Government Event','Partnership Announcement'].map(o=><option key={o}>{o}</option>)}</MS></div></G2>
      <G2><div><ML c="Status" /><MS value={f.st} onChange={s('st')}>{['Planned','In Progress','Completed'].map(o=><option key={o}>{o}</option>)}</MS></div>
          <div><ML c="Owner" /><MI value={f.owner} onChange={s('owner')} placeholder="Responsible person" /></div></G2>
      <G2><div><ML c="Budget Allocated" /><MI value={f.buda} onChange={s('buda')} placeholder="e.g. $5,000" /></div>
          <div><ML c="Target Region" /><MI value={f.region} onChange={s('region')} placeholder="e.g. Central Asia" /></div></G2>
      <ML c="Expected Outcome" /><MI value={f.expected} onChange={s('expected')} placeholder="e.g. 50 qualified contacts" />
    </MModal>
  )
}

// ─── TAB: KPI Dashboard ────────────────────────────────────────────────────────
function TabKPI({ markets, partners, leads, vis, isAdmin, isMgmt, isUser, isExt }) {
  if (isExt) {
    const done = vis.filter(v => v.st === 'Completed')
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <SectionHeader title="Sales Overview — External View" subtitle="Completed initiatives and market activity" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          {done.map(v => (
            <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{v.type}</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.t1, margin:'4px 0' }}>{v.name}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:6 }}>✓ {v.actual || v.expected}</div>
            </div>
          ))}
        </div>
        <RestrictNotice text="Full sales dashboard is restricted to internal users only." />
      </div>
    )
  }

  const mktContacted = markets.filter(m => m.st !== 'Not Contacted').length
  const pipeNeg      = partners.filter(p => p.stage === 3).length
  const dealsClosed  = partners.filter(p => p.stage >= 4).length
  const convRate     = Math.round(dealsClosed / Math.max(partners.length, 1) * 100)
  const leadsTotal   = leads.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SectionHeader title="Sales KPI Dashboard" subtitle="Real-time sales pulse — Central Asia focus">
        {isAdmin && <BtnSec>⬇ Export Report</BtnSec>}
      </SectionHeader>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:11 }}>
        {[
          { lbl:'Markets Contacted',    val:mktContacted,                                      sub:`of ${markets.length} total`,     dot:C.blu },
          { lbl:'Active Negotiations',  val:<span style={{color:C.amb}}>{pipeNeg}</span>,       sub:'In pipeline',                    dot:C.amb },
          { lbl:'Leads in Pipeline',    val: isUser ? '••' : leadsTotal,                        sub: isUser ? 'Your leads only' : 'All leads', dot:C.pur },
          { lbl:'Deals Closed',         val:<span style={{color:C.grn}}>{dealsClosed}</span>,   sub:'This year',                      dot:C.grn },
          { lbl:'Outreach This Week',   val:12,                                                 sub:'Calls, emails, meetings',        dot:C.tel },
          { lbl:'Conversion Rate',      val:<span style={{color:C.acc}}>{convRate}%</span>,     sub:'Leads → Partners',               dot:C.acc },
        ].map((s,i) => (
          <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{s.lbl}</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.t1, lineHeight:1.1 }}>{s.val}</div>
            <div style={{ fontSize:11, color:C.t3, marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, display:'inline-block', flexShrink:0 }} />{s.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <div style={{ fontWeight:700, color:C.t1, marginBottom:14 }}>Pipeline Stage Overview</div>
          {PIPE_STAGES.map((stage, si) => {
            const cnt = partners.filter(p => p.stage === si).length
            const pct = Math.round(cnt / Math.max(partners.length, 1) * 100)
            return <ProgRow key={stage} label={stage} pct={pct} color={PIPE_COLORS[si]} count={cnt} />
          })}
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Card>
            <div style={{ fontWeight:700, color:C.t1, marginBottom:12 }}>Market Outreach by Status</div>
            {['Active Partner','MOU Signed','Meeting Scheduled','Contacted','Not Contacted'].map(s => {
              const cnt = markets.filter(m => m.st === s).length
              return (
                <div key={s} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                  <div style={{ color:C.t2 }}>{s}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Badge s={s} />
                    <span style={{ fontWeight:700, color:C.t1, width:20, textAlign:'right' }}>{cnt}</span>
                  </div>
                </div>
              )
            })}
          </Card>
          <Card>
            <div style={{ fontWeight:700, color:C.t1, marginBottom:12 }}>Lead Status Breakdown</div>
            {(isMgmt || isUser) && <div style={{ fontSize:12, color:C.t3, marginBottom:10 }}>Lead names are restricted. Showing counts only.</div>}
            {[['Hot',C.grn],['Being Nurtured',C.amb],['New',C.blu],['Lost',C.red]].map(([s, color]) => {
              const cnt = leads.filter(l => l.st === s).length
              const pct = Math.round(cnt / Math.max(leads.length, 1) * 100)
              return <ProgRow key={s} label={s} pct={pct} color={color} count={cnt} />
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: Market Outreach ──────────────────────────────────────────────────────
function TabMarkets({ markets, setMarkets, canEdit, isAdmin, isUser, isExt, showToast, onOpen }) {
  if (isExt) return <RestrictNotice text="Market outreach details are not available to external parties." />
  const shown = isUser ? markets.filter(m => m.assigned === 'Ahmed K.') : markets
  function del(id) {
    if (!confirm('Delete this market?')) return
    setMarkets(p => p.filter(m => m.id !== id))
    showToast('Deleted', 'Market removed')
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SectionHeader title="Market Outreach Tracker" subtitle={`${shown.length} markets${isUser ? ' assigned to you' : ''} · ${shown.filter(m => m.st !== 'Not Contacted').length} contacted`}>
        {canEdit && <BtnPri onClick={onOpen}>+ Add Market</BtnPri>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
        {shown.map(m => {
          const editable = canEdit || (isUser && m.assigned === 'Ahmed K.')
          return (
            <div key={m.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>{m.flag}</span>{m.country}
                </div>
                <Badge s={m.st} />
              </div>
              {[
                ['Contact',     <>{m.contact}<br /><span style={{ fontSize:11, color:C.t4 }}>{m.company}</span></>],
                ['Last Touch',  m.last],
                ['Next Action', <span style={{ color:C.amb }}>{m.next}</span>],
                ['Assigned',    m.assigned],
                m.notes && ['Notes', <span style={{ color:C.t3, fontSize:11 }}>{m.notes}</span>],
              ].filter(Boolean).map(([lbl, val]) => (
                <div key={lbl} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:7, fontSize:12 }}>
                  <div style={{ width:90, color:C.t4, fontWeight:600, flexShrink:0 }}>{lbl}</div>
                  <div style={{ color:C.t2, flex:1 }}>{val}</div>
                </div>
              ))}
              {editable && (
                <div style={{ display:'flex', gap:6, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                  <MktBtn>Edit</MktBtn>
                  <MktBtn onClick={() => showToast('Log Activity', 'Activity log form opens here')}>Log Activity</MktBtn>
                  {isAdmin && <MktBtn onClick={() => del(m.id)} danger>Delete</MktBtn>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MktBtn({ onClick, children, danger }) {
  const [h, sH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{ flex:1, padding:6, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', textAlign:'center', transition:'all .15s',
        background: danger ? (h ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)') : (h ? 'rgba(0,104,74,0.15)' : 'rgba(255,255,255,0.06)'),
        color: danger ? (h ? C.red : C.t3) : (h ? C.acc : C.t3) }}>
      {children}
    </button>
  )
}

// ─── TAB: Partner Pipeline (Kanban) ───────────────────────────────────────────
function TabPipeline({ partners, setPartners, canEdit, isUser, isExt, showToast, onOpen }) {
  if (isExt) return <RestrictNotice text="Partner pipeline is not available to external parties." />
  const shown = isUser ? partners.filter(p => p.mgr === 'Ahmed K.') : partners
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SectionHeader title="Partner & Distributor Pipeline" subtitle={`${shown.length} partners${isUser ? ' assigned to you' : ''} across 6 stages`}>
        {canEdit && <BtnPri onClick={onOpen}>+ Add Partner</BtnPri>}
      </SectionHeader>
      {/* Kanban board */}
      <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, scrollbarWidth:'thin' }}>
        {PIPE_STAGES.map((stage, si) => {
          const cards = shown.filter(p => p.stage === si)
          return (
            <div key={si} style={{ minWidth:220, width:220, background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, display:'flex', flexDirection:'column', flexShrink:0 }}>
              <div style={{ padding:'12px 14px 10px', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.t1 }}>Stage {si+1} — {stage}</div>
                <div style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:10, marginTop:3, display:'inline-block', background:`${PIPE_COLORS[si]}20`, color:PIPE_COLORS[si] }}>
                  {cards.length} partner{cards.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ padding:10, display:'flex', flexDirection:'column', gap:8, flex:1, minHeight:80 }}>
                {cards.map(p => (
                  <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'11px 12px', cursor:'pointer' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.t1, marginBottom:4 }}>{p.name}</div>
                    <div style={{ fontSize:11, color:C.t3, marginBottom:6 }}>🌍 {p.country}</div>
                    <div style={{ fontSize:11, color:C.amb, fontWeight:600, marginBottom:5 }}>💰 {p.deal}</div>
                    <div style={{ fontSize:11, color:C.t3 }}>👤 {p.contact}</div>
                    {p.docs.length > 0 && (
                      <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                        {p.docs.map(d => <span key={d} style={{ fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:10, background:'rgba(0,104,74,0.08)', color:C.t3 }}>{d}</span>)}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:10, color:C.t4 }}>{p.last}</div>
                      {(canEdit || (isUser && p.mgr === 'Ahmed K.')) && (
                        <button onClick={() => showToast('Move Stage', 'Stage update form opens here')}
                          style={{ padding:'3px 8px', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', borderRadius:7, background:'rgba(0,104,74,0.08)', color:C.t3 }}>
                          Move →
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize:10, color:C.amb, marginTop:4 }}>⏳ {p.next}</div>
                  </div>
                ))}
                {!cards.length && <div style={{ fontSize:11, color:C.t4, textAlign:'center', padding:'16px 0' }}>No partners</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TAB: Lead Tracking ────────────────────────────────────────────────────────
function TabLeads({ leads, setLeads, canEdit, isMgmt, isUser, isExt, showToast, onOpen }) {
  const [expandedLogs, setExpandedLogs] = useState(new Set())

  if (isExt) return <RestrictNotice text="Lead tracking is restricted to the Sales department only." />

  if (isMgmt) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <SectionHeader title="Lead Tracking — Summary View" subtitle="Lead names and contact details are restricted. Showing aggregate status only." />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
          {[
            { lbl:'Total Leads',     val:leads.length,                                               dot:C.blu },
            { lbl:'Hot Leads',       val:<span style={{color:C.grn}}>{leads.filter(l=>l.st==='Hot').length}</span>,           dot:C.grn },
            { lbl:'Being Nurtured',  val:<span style={{color:C.amb}}>{leads.filter(l=>l.st==='Being Nurtured').length}</span>, dot:C.amb },
            { lbl:'Lost',            val:<span style={{color:C.red}}>{leads.filter(l=>l.st==='Lost').length}</span>,           dot:C.red },
          ].map((s,i) => (
            <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{s.lbl}</div>
              <div style={{ fontSize:22, fontWeight:700, color:C.t1 }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function toggleLog(id) {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      // if (next.has(id)) next.delete(id) else next.add(id)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }
  function del(id) {
    if (!confirm('Delete this lead?')) return
    setLeads(p => p.filter(l => l.id !== id))
    showToast('Deleted', 'Lead removed')
  }

  const shown = isUser ? leads.filter(l => l.rep === 'Ahmed K.') : leads
  const colSpan = canEdit ? 9 : 8

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SectionHeader title="Lead Tracking" subtitle={`${shown.length} leads${isUser ? ' assigned to you' : ''}`}>
        {(canEdit || isUser) && <BtnPri onClick={onOpen}>+ Add Lead</BtnPri>}
      </SectionHeader>
      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead><tr>
              {['Lead','Source','Type','Status','Priority','Rep','Expected Conv.','Follow-up Log'].map(h => <th key={h} style={TH}>{h}</th>)}
              {canEdit && <th style={TH}>Actions</th>}
            </tr></thead>
            <tbody>
              {shown.map(l => {
                const expanded = expandedLogs.has(l.id)
                const isEditable = canEdit || (isUser && l.rep === 'Ahmed K.')
                return (
                  <>
                    <tr key={`r-${l.id}`}>
                      <td style={TD}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,104,74,0.2)', color:C.acc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{l.name[0]}</div>
                          <div>
                            <div style={{ fontWeight:600, color:C.t1 }}>{l.name}</div>
                            <div style={{ fontSize:11, color:C.t3 }}>{l.co}</div>
                          </div>
                        </div>
                      </td>
                      <td style={TD}><Badge s={l.src} /></td>
                      <td style={{ ...TD, color:C.t2 }}>{l.type}</td>
                      <td style={TD}><Badge s={l.st} /></td>
                      <td style={TD}><Badge s={l.pri} /></td>
                      <td style={TD}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(96,165,250,0.2)', color:C.blu, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{l.rep[0]}</div>
                          {l.rep}
                        </div>
                      </td>
                      <td style={{ ...TD, color:C.t3 }}>{fmtD(l.exp)}</td>
                      <td style={TD}>
                        <span onClick={() => toggleLog(l.id)}
                          style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'rgba(255,255,255,0.06)', color:C.t3, cursor:'pointer', userSelect:'none' }}>
                          {l.log.length} entries {expanded ? '▴' : '▾'}
                        </span>
                      </td>
                      {canEdit && (
                        <td style={TD}>
                          <button onClick={() => showToast('Edit Lead','Edit form opens here')} style={{ background:'none', border:'none', cursor:'pointer', color:C.acc, fontSize:12, fontWeight:600, marginRight:12, fontFamily:'inherit' }}>Edit</button>
                          <button onClick={() => del(l.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:600, fontFamily:'inherit' }}>Del</button>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr key={`log-${l.id}`}>
                        <td colSpan={colSpan} style={{ padding:'0 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ background:C.card2, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Follow-up Log</div>
                            {l.log.map((e, ei) => (
                              <div key={ei} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom: ei < l.log.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize:12 }}>
                                <div style={{ width:90, color:C.t4, flexShrink:0, fontSize:11 }}>{e.date}</div>
                                <div style={{ width:80, color:C.acc, flexShrink:0, fontSize:11, fontWeight:600 }}>{e.who}</div>
                                <div style={{ color:C.t2, flex:1 }}>{e.txt}<span style={{ color:C.grn, marginLeft:6, fontSize:11 }}>→ {e.out}</span></div>
                              </div>
                            ))}
                            {isEditable && (
                              <button onClick={() => showToast('Log Activity','Activity log form opens here')}
                                style={{ marginTop:8, padding:'5px 12px', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.border2}`, borderRadius:7, background:'rgba(255,255,255,0.06)', color:C.t2 }}>
                                + Log Activity
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Visibility & Marketing ───────────────────────────────────────────────
function TabVisibility({ vis, setVis, canEdit, isAdmin, isUser, isExt, showToast, onOpen }) {
  const shown  = isExt ? vis.filter(v => v.st === 'Completed') : vis
  function del(id) {
    if (!confirm('Delete this initiative?')) return
    setVis(p => p.filter(v => v.id !== id))
    showToast('Deleted','Initiative removed')
  }
  function markDone(id) {
    const v = vis.find(x => x.id === id)
    if (!v) return
    setVis(p => p.map(x => x.id === id ? { ...x, st:'Completed', actual: x.actual || x.expected } : x))
    showToast('Marked Complete', `${v.name} marked as completed`)
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SectionHeader title="Visibility & Marketing Initiatives" subtitle={`${shown.length} initiative${shown.length!==1?'s':''} · ${vis.filter(v=>v.st==='Completed').length} completed`}>
        {canEdit && <BtnPri onClick={onOpen}>+ Add Initiative</BtnPri>}
      </SectionHeader>
      {isExt && (
        <div style={{ fontSize:12, color:C.t3, padding:'8px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
          📋 External view — showing completed initiatives only. This demonstrates active market presence.
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
        {shown.map(v => {
          const editable = (canEdit || (isUser && v.owner === 'Ahmed K.')) && !isExt
          const spentNum = parseFloat((v.buds||'0').replace(/[^0-9.]/g,''))
          return (
            <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10, gap:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.t1 }}>{v.name}</div>
                  <div style={{ fontSize:11, color:C.t3, marginTop:3 }}>{v.date} · {v.region}</div>
                </div>
                <Badge s={v.st} />
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                <Badge s={v.type} />
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'rgba(255,255,255,0.06)', color:C.t3 }}>👤 {v.owner}</span>
              </div>
              {!isExt && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10, fontSize:12 }}>
                  <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'8px 10px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Budget Allocated</div>
                    <div style={{ color:C.grn, fontWeight:700 }}>{v.buda}</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'8px 10px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Budget Spent</div>
                    <div style={{ color: spentNum > 0 ? C.amb : C.t3, fontWeight:700 }}>{v.buds || '$0'}</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize:12, marginBottom: v.actual ? 6 : 0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Expected</div>
                <div style={{ color:C.t2 }}>{v.expected}</div>
              </div>
              {v.actual && (
                <div style={{ fontSize:12, marginTop:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.t4, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Actual Result</div>
                  <div style={{ color:C.grn, fontWeight:600 }}>✓ {v.actual}</div>
                </div>
              )}
              {editable && (
                <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}`, display:'flex', gap:6 }}>
                  <MktBtn onClick={() => showToast('Edit Initiative','Update form opens here')}>Edit</MktBtn>
                  {v.st !== 'Completed' && <MktBtn onClick={() => markDone(v.id)}>Mark Complete</MktBtn>}
                  {isAdmin && <MktBtn onClick={() => del(v.id)} danger>Delete</MktBtn>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sub-tab definitions ───────────────────────────────────────────────────────
const SUB_TABS = [
  { id:'kpi',        label:'KPI Dashboard'          },
  { id:'markets',    label:'Market Outreach'         },
  { id:'pipeline',   label:'Partner Pipeline'        },
  { id:'leads',      label:'Lead Tracking'           },
  { id:'visibility', label:'Visibility & Marketing'  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function SalesTab() {
  const perms = usePermissions()

  const [activeSubTab, setActiveSubTab] = useState('kpi')
  const [markets,  setMarkets]  = useState(INIT_MARKETS)
  const [partners, setPartners] = useState(INIT_PARTNERS)
  const [leads,    setLeads]    = useState(INIT_LEADS)
  const [vis,      setVis]      = useState(INIT_VIS)
  const [modal,    setModal]    = useState(null)  // 'market'|'partner'|'lead'|'initiative'
  const [toast,    setToast]    = useState(null)

  const isAdmin = perms.isSuperAdmin
  const isHead  = perms.isDepartmentHead
  const isMgmt  = perms.isManagement
  const isUser  = perms.isDepartmentUser
  const isExt   = perms.isExternal
  const canEdit = isAdmin || isHead

  function showToast(title, msg) {
    setToast({ title, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function addMarket(f) {
    setMarkets(p => [...p, { id:Date.now(), country:f.country.trim(), flag:f.flag||'🌍', st:f.st, contact:f.contact||'—', company:f.company||'—', last:'Today', next:f.next||'—', notes:f.notes, assigned:f.assigned||'Unassigned' }])
    setModal(null)
    showToast('Market Added', `${f.country.trim()} added to outreach tracker`)
  }
  function addPartner(f) {
    setPartners(p => [...p, { id:Date.now(), name:f.name.trim(), country:f.country, contact:f.contact, deal:f.deal||'TBD', stage:parseInt(f.stage), mgr:f.mgr||'Unassigned', last:'Today', next:f.next||'—', docs:[] }])
    setModal(null)
    showToast('Partner Added', `${f.name.trim()} added to pipeline`)
  }
  function addLead(f) {
    setLeads(p => [...p, { id:Date.now(), name:f.name.trim(), co:f.co, src:f.src, type:f.type, st:'New', pri:f.pri, rep:f.rep||'Unassigned', exp:f.exp, log:[] }])
    setModal(null)
    showToast('Lead Added', `${f.name.trim()} added to lead tracker`)
  }
  function addInitiative(f) {
    setVis(p => [...p, { id:Date.now(), name:f.name.trim(), type:f.type, st:f.st, owner:f.owner||'Unassigned', buda:f.buda||'TBD', buds:'$0', region:f.region, expected:f.expected, actual:'', date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }])
    setModal(null)
    showToast('Initiative Added', `${f.name.trim()} added`)
  }

  const shared = { markets, setMarkets, partners, setPartners, leads, setLeads, vis, setVis, canEdit, isAdmin, isHead, isMgmt, isUser, isExt, showToast }

  return (
    <div style={{ fontFamily:'Inter,system-ui,sans-serif', color:C.t1 }}>

      {/* Sub-tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:22, borderBottom:`1px solid ${C.border}`, flexWrap:'wrap' }}>
        {SUB_TABS.map(t => {
          const active = t.id === activeSubTab
          return (
            <button key={t.id} onClick={() => setActiveSubTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight: active ? 700 : 500, cursor:'pointer', border:'none', background: active ? C.acc : 'transparent', color: active ? '#fff' : C.t3, borderRadius:'7px 7px 0 0', transition:'all .15s', fontFamily:'inherit', marginBottom:-1, borderBottom: active ? `2px solid ${C.acc}` : '2px solid transparent', whiteSpace:'nowrap', flexShrink:0 }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {activeSubTab === 'kpi'        && <TabKPI        markets={markets} partners={partners} leads={leads} vis={vis} isAdmin={isAdmin} isMgmt={isMgmt} isUser={isUser} isExt={isExt} />}
      {activeSubTab === 'markets'    && <TabMarkets    {...shared} onOpen={() => setModal('market')} />}
      {activeSubTab === 'pipeline'   && <TabPipeline   {...shared} onOpen={() => setModal('partner')} />}
      {activeSubTab === 'leads'      && <TabLeads      {...shared} onOpen={() => setModal('lead')} />}
      {activeSubTab === 'visibility' && <TabVisibility {...shared} onOpen={() => setModal('initiative')} />}

      {modal === 'market'     && <ModalMarket     onClose={() => setModal(null)} onAdd={addMarket}     />}
      {modal === 'partner'    && <ModalPartner    onClose={() => setModal(null)} onAdd={addPartner}    />}
      {modal === 'lead'       && <ModalLead       onClose={() => setModal(null)} onAdd={addLead}       />}
      {modal === 'initiative' && <ModalInitiative onClose={() => setModal(null)} onAdd={addInitiative} />}

      <Toast toast={toast} />
    </div>
  )
}

export default SalesTab
