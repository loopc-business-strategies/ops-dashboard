// FILE: src/components/tabs/TrainingTab.jsx
// Training & Development — 11 sub-tabs, role-based access, full feature set

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import departmentStateAPI from '../../api/department-state'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  grad:   'var(--grad-brand)',
  gbar:   'var(--grad-bar)',
  green:  '#065f46', cyan:   '#00b4d8', yellow: '#ffd600',
  orange: '#9a3412', red:    '#ff4757', gold:   '#f59e0b',
  t1:'#1c2a33', t2:'#374151', t3:'#334155', t4:'#475569',
  border: 'rgba(var(--purple-rgb),0.15)', border2:'rgba(var(--purple-rgb),0.35)',
  card:'#ffffff', card2:'#f8f9fa', inp:'#f8f9fa',
  pur: 'var(--purple)',
}
const B = {
  pri:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:C.grad, color:'#fff', boxShadow:'0 4px 15px rgba(var(--purple-rgb),.35)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sec:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'var(--purple)', border:'1px solid var(--purple)', whiteSpace:'nowrap', fontFamily:'inherit' },
  ghost: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'#475569', border:`1px solid ${C.border}`, whiteSpace:'nowrap', fontFamily:'inherit' },
  succ:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(0,200,150,.15)', color:'#065f46', border:'1px solid rgba(0,200,150,.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sm:    { padding:'5px 11px', fontSize:11 },
}

function getTrainingTabs(t) {
  return [
    { id:'kpi',         label:`📊 ${t('overview')}` },
    { id:'calendar',    label:`📅 ${t('calendar')}` },
    { id:'batches',     label:`👥 ${t('batches')}` },
    { id:'attendance',  label:`📋 ${t('attendance')}` },
    { id:'resources',   label:`📚 ${t('resources')}` },
    { id:'assessments', label:`📝 ${t('assessments')}` },
    { id:'certs',       label:`🏆 ${t('certifications')}` },
    { id:'feedback',    label:`💬 ${t('feedback')}` },
    { id:'analytics',   label:`📈 ${t('analytics')}` },
    { id:'trainees',    label:`👤 ${t('trainees')}` },
    { id:'skillgap',    label:`🗓️ ${t('skillGap')}` },
  ]
}

// ─── Seed data ──────────────────────────────────────────────────────────────────
const INIT_SESSIONS = [
  { id:1, title:'Gold Safety — Module 1',   prog:'Gold Safety Essentials',   date:'Apr 13', day:13, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Completed' },
  { id:2, title:'Equipment Operation',       prog:'Equipment Operation',       date:'Apr 14', day:14, time:'10:30', trainer:'Nadia K.', batch:'Batch B', venue:'Site Floor',        st:'Scheduled' },
  { id:3, title:'Compliance Basics',         prog:'Compliance & Legal',        date:'Apr 15', day:15, time:'14:00', trainer:'Sara A.',  batch:'Batch C', venue:'Online — Zoom',     st:'Scheduled' },
  { id:4, title:'Leadership Workshop',       prog:'Leadership Development',    date:'Apr 17', day:17, time:'11:00', trainer:'James O.', batch:'Batch D', venue:'Classroom B',       st:'Scheduled' },
  { id:5, title:'Gold Safety — Module 2',   prog:'Gold Safety Essentials',   date:'Apr 20', day:20, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Scheduled' },
  { id:6, title:'Tech Skills — Excel',       prog:'Tech Skills',               date:'Apr 10', day:10, time:'13:00', trainer:'Nadia K.', batch:'Batch E', venue:'Online — Zoom',     st:'Completed' },
  { id:7, title:'Safety Drill',              prog:'Gold Safety Essentials',   date:'Apr 8',  day:8,  time:'08:00', trainer:'Sara A.',  batch:'Batch A', venue:'Site Floor',        st:'Cancelled' },
]

const INIT_BATCHES = [
  { id:1, name:'Batch A — Gold Safety',   prog:'Gold Safety Essentials',  start:'Apr 1, 2026',  end:'Apr 30, 2026',  trainer:'James O.', trainees:12, st:'Active',    completion:65 },
  { id:2, name:'Batch B — Equipment',     prog:'Equipment Operation',      start:'Apr 5, 2026',  end:'May 15, 2026',  trainer:'Nadia K.', trainees:8,  st:'Active',    completion:40 },
  { id:3, name:'Batch C — Compliance',    prog:'Compliance & Legal',       start:'Mar 15, 2026', end:'Apr 15, 2026',  trainer:'Sara A.',  trainees:15, st:'Completed', completion:100 },
  { id:4, name:'Batch D — Leadership',    prog:'Leadership Development',   start:'Apr 10, 2026', end:'May 20, 2026',  trainer:'James O.', trainees:6,  st:'Active',    completion:25 },
  { id:5, name:'Batch E — Tech Skills',   prog:'Tech Skills',              start:'Mar 1, 2026',  end:'Mar 31, 2026',  trainer:'Nadia K.', trainees:10, st:'Completed', completion:100 },
  { id:6, name:'Batch F — On Hold',       prog:'Gold Safety Essentials',  start:'May 1, 2026',  end:'May 31, 2026',  trainer:'TBD',      trainees:0,  st:'On Hold',   completion:0 },
]

const INIT_ATTENDANCE = [
  { sess:'Gold Safety — Module 1', date:'Apr 13', batch:'Batch A', present:10, absent:2, late:1, total:12 },
  { sess:'Tech Skills — Excel',    date:'Apr 10', batch:'Batch E', present:9,  absent:1, late:0, total:10 },
  { sess:'Compliance Basics',      date:'Apr 5',  batch:'Batch C', present:12, absent:2, late:1, total:15 },
  { sess:'Safety Drill',           date:'Apr 8',  batch:'Batch A', present:7,  absent:5, late:0, total:12 },
]

const INIT_RESOURCES = [
  { id:1, name:'Gold Safety Handbook v2.pdf',          prog:'Gold Safety Essentials',  type:'PDF',      by:'Nadia K.', date:'Apr 1, 2026',  views:28 },
  { id:2, name:'Equipment Operation Manual v1.pdf',    prog:'Equipment Operation',      type:'PDF',      by:'James O.', date:'Mar 20, 2026', views:14 },
  { id:3, name:'Compliance Guidelines 2026.pdf',       prog:'Compliance & Legal',       type:'PDF',      by:'Sara A.',  date:'Feb 15, 2026', views:22 },
  { id:4, name:'Leadership Skills — Video Tutorial',   prog:'Leadership Development',   type:'Video',    by:'Nadia K.', date:'Apr 5, 2026',  views:9  },
  { id:5, name:'Excel Advanced Techniques.xlsx',       prog:'Tech Skills',              type:'Document', by:'Nadia K.', date:'Mar 2, 2026',  views:31 },
  { id:6, name:'Safety Drill Checklist v2.pdf',        prog:'Gold Safety Essentials',  type:'PDF',      by:'James O.', date:'Apr 10, 2026', views:6  },
]

const INIT_ASSESSMENTS = [
  { trainee:'Ahmad Yusuf',    prog:'Gold Safety Essentials',  score:88, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Zara Malik',     prog:'Gold Safety Essentials',  score:94, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:62, pass:false, date:'Apr 13, 2026', attempt:1 },
  { trainee:'Nadia Khan',     prog:'Compliance & Legal',      score:97, pass:true,  date:'Apr 10, 2026', attempt:1 },
  { trainee:'Layla Siddiqui', prog:'Tech Skills',             score:76, pass:true,  date:'Mar 28, 2026', attempt:1 },
  { trainee:'Bilal Raza',     prog:'Equipment Operation',     score:55, pass:false, date:'Apr 14, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:74, pass:true,  date:'Apr 20, 2026', attempt:2 },
]

const INIT_CERTS = [
  { trainee:'Ahmad Yusuf',    cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_ahmad_gs1.pdf' },
  { trainee:'Zara Malik',     cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_zara_gs1.pdf' },
  { trainee:'Nadia Khan',     cert:'Compliance Officer Cert',   issued:'Apr 10, 2026', expiry:'Apr 10, 2027', st:'Issued',  doc:'cert_nadia_compliance.pdf' },
  { trainee:'Layla Siddiqui', cert:'Tech Skills Certificate',   issued:'Mar 30, 2026', expiry:'Mar 30, 2028', st:'Issued',  doc:'cert_layla_tech.pdf' },
  { trainee:'Hassan Ali',     cert:'Gold Safety Level 1',       issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Bilal Raza',     cert:'Equipment Operator Cert',   issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Omar Khan',      cert:'Leadership Certificate',    issued:'Jan 15, 2025', expiry:'Jan 15, 2026', st:'Expired', doc:'cert_omar_leadership.pdf' },
]

const INIT_FEEDBACK = [
  { trainer:'James O.', trainee:'Ahmad Yusuf',    session:'Gold Safety — Module 1', trainerRating:5, contentRating:4, venueRating:4, comment:'Very well explained. Practical examples were excellent.' },
  { trainer:'James O.', trainee:'Zara Malik',     session:'Gold Safety — Module 1', trainerRating:5, contentRating:5, venueRating:3, comment:'Great trainer. Room was a bit cold but content was perfect.' },
  { trainer:'Nadia K.', trainee:'Layla Siddiqui', session:'Tech Skills — Excel',    trainerRating:4, contentRating:5, venueRating:5, comment:'Online session was smooth. Loved the hands-on exercises.' },
  { trainer:'Sara A.',  trainee:'Nadia Khan',     session:'Compliance Basics',      trainerRating:4, contentRating:4, venueRating:4, comment:'Covered all the key regulations. Could use more case studies.' },
]

const INIT_TRAINEES = [
  { name:'Ahmad Yusuf',    dept:'Production', role:'Line Operator', email:'ahmad@ops.kz',  prog:['Gold Safety Essentials'],                       att:83,  certs:1 },
  { name:'Zara Malik',     dept:'Quality',    role:'Inspector',     email:'zara@ops.kz',   prog:['Gold Safety Essentials'],                       att:100, certs:1 },
  { name:'Hassan Ali',     dept:'Production', role:'Line Operator', email:'hassan@ops.kz', prog:['Gold Safety Essentials'],                       att:58,  certs:0 },
  { name:'Nadia Khan',     dept:'Training',   role:'Trainer',       email:'nadia@ops.kz',  prog:['Compliance & Legal','Leadership Development'],  att:92,  certs:1 },
  { name:'Layla Siddiqui', dept:'Sales',      role:'Sales Rep',     email:'layla@ops.kz',  prog:['Tech Skills'],                                  att:90,  certs:1 },
  { name:'Bilal Raza',     dept:'Operations', role:'Logistics',     email:'bilal@ops.kz',  prog:['Equipment Operation'],                          att:75,  certs:0 },
  { name:'Omar Khan',      dept:'Operations', role:'Ops Head',      email:'omar@ops.kz',   prog:['Leadership Development'],                       att:88,  certs:0 },
]

const SKILL_GAPS = [
  { dept:'Production',  skill:'Gold Processing Safety',       required:'Advanced',     current:'Basic',        gap:60, prog:'Gold Safety Essentials' },
  { dept:'Production',  skill:'Equipment Operation',          required:'Intermediate', current:'Basic',        gap:45, prog:'Equipment Operation' },
  { dept:'Operations',  skill:'Logistics Compliance',         required:'Advanced',     current:'Intermediate', gap:30, prog:'Compliance & Legal' },
  { dept:'HR',          skill:'HR Digital Tools',             required:'Advanced',     current:'Beginner',     gap:70, prog:'Tech Skills' },
  { dept:'Finance',     skill:'Advanced Excel & Reporting',   required:'Advanced',     current:'Intermediate', gap:25, prog:'Tech Skills' },
  { dept:'Sales',       skill:'Contract Negotiation',         required:'Expert',       current:'Intermediate', gap:50, prog:'Leadership Development' },
  { dept:'Compliance',  skill:'Regulatory Updates 2026',      required:'Expert',       current:'Advanced',     gap:15, prog:'Compliance & Legal' },
  { dept:'Training',    skill:'Digital Training Delivery',    required:'Advanced',     current:'Intermediate', gap:20, prog:'Tech Skills' },
]

const INIT_NOTIFS = [
  { id:'TN1', lv:'red',    read:false, title:'🔴 Overdue Task — Hassan Ali Assessment Retest',    desc:'Hassan Ali failed Gold Safety assessment. Retest scheduled but not yet completed. Due Apr 16.' },
  { id:'TN2', lv:'yellow', read:false, title:'🟡 Session Tomorrow — Equipment Operation (10:30)', desc:'Batch B session scheduled for Apr 14 at 10:30 on Site Floor. Trainer: Nadia K.' },
  { id:'TN3', lv:'orange', read:false, title:'🟠 Certificate Expiring — Omar Khan Leadership',    desc:"Omar Khan's Leadership Certificate expired Jan 2026. Renewal required immediately." },
  { id:'TN4', lv:'green',  read:false, title:'🟢 New Enrollment — Bilal Raza (Equipment Op.)',   desc:'Bilal Raza has been enrolled in Equipment Operation — Batch B starting Apr 5.' },
  { id:'TN5', lv:'red',    read:true,  title:'🔴 Low Attendance — Hassan Ali (58%)',              desc:'Hassan Ali attendance has dropped to 58% in Gold Safety. Minimum required: 75%.' },
  { id:'TN6', lv:'cyan',   read:true,  title:'🔵 Batch C Completed — Compliance & Legal',        desc:'All 15 trainees in Batch C have completed the Compliance & Legal program. Reports available.' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────
function pct(v, t) { return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100))) }
function avg(arr, key) { if (!arr.length) return 0; return (arr.reduce((a, b) => a + b[key], 0) / arr.length).toFixed(1) }

const BADGE_MAP = {
  'Active':        { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Completed':     { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Issued':        { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Pass':          { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Present':       { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'On Hold':       { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Pending':       { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Late':          { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Scheduled':     { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Expired':       { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Fail':          { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Absent':        { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Cancelled':     { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'PDF':           { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Video':         { bg:'rgba(255,112,67,.12)',  color:'#9a3412', b:'rgba(255,112,67,.3)' },
  'Document':      { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Advanced':      { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Intermediate':  { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Expert':        { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Basic':         { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Beginner':      { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
}
function Badge({ s }) {
  const cf = BADGE_MAP[s] || { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:cf.bg, color:cf.color, border:`1px solid ${cf.b}`, whiteSpace:'nowrap' }}>{s}</span>
}

function Stars({ n, size=14 }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize:size, color: i < Math.round(n) ? C.gold : C.t4 }}>★</span>
      ))}
    </span>
  )
}

function ProgBar({ p, color, height=7 }) {
  return (
    <div style={{ flex:1, height, background:'rgba(255,255,255,.06)', borderRadius:4, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${p}%`, background:color, borderRadius:4, transition:'width .5s' }} />
    </div>
  )
}
function ProgRow({ label, p, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
      <div style={{ width:160, color:C.t2, fontWeight:500, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
      <ProgBar p={p} color={color} />
      <div style={{ width:36, textAlign:'right', fontWeight:700, color:C.t1, fontSize:12 }}>{p}%</div>
    </div>
  )
}

function StatCard({ label, value, sub, dot, bottom }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:C.t1, lineHeight:1 }}>{value}</div>
      {sub && !bottom && <div style={{ fontSize:11, color:C.t3, marginTop:7, display:'flex', alignItems:'center', gap:5 }}>
        {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }} />}
        {sub}
      </div>}
      {bottom && <div style={{ marginTop:8 }}>{bottom}</div>}
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      {children}
    </div>
  )
}
function CardTitle({ children }) {
  return <div style={{ fontSize:13, fontWeight:800, color:C.t1, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>{children}</div>
}
function TableWrap({ children }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>{children}</div>
}
function TableHead({ title, subtitle, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:`1px solid ${C.border}`, flexWrap:'wrap', gap:8 }}>
      <div>
        <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display:'flex', gap:8 }}>{right}</div>}
    </div>
  )
}
const TH = { fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,.02)', whiteSpace:'nowrap' }
const TD = { padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12.5, color:C.t2, verticalAlign:'middle' }

function SH({ title, sub, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display:'flex', gap:8, flexShrink:0, marginTop:2 }}>{children}</div>}
    </div>
  )
}
function Restrict({ text }) {
  return <div style={{ background:'rgba(255,71,87,.07)', border:'1px solid rgba(255,71,87,.18)', borderRadius:10, padding:'13px 16px', fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:10, lineHeight:1.5 }}><span style={{ fontSize:20 }}>🔒</span>{text}</div>
}

// ─── Modal base ─────────────────────────────────────────────────────────────────
const IS = { width:'100%', background:'rgba(255,255,255,.05)', border:'1.5px solid rgba(var(--purple-rgb),.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:C.t1, fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' }
function ML({ children }) { return <div style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{children}</div> }
function MI(props) { return <input {...props} style={IS} /> }
function MS({ children, ...p }) { return <select {...p} style={{ ...IS, appearance:'auto' }}>{children}</select> }
function MTA(props) { return <textarea {...props} style={{ ...IS, resize:'vertical', minHeight:65 }} /> }
function Modal({ title, sub, onClose, onSave, saveLabel = 'Save', wide, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#ffffff', border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width: wide ? 720 : 560, maxWidth:'94vw', maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:C.grad, borderRadius:'14px 0 0 14px' }} />
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        <h3 style={{ fontSize:17, fontWeight:800, color:C.t1, marginBottom:4 }}>{title}</h3>
        <div style={{ fontSize:12, color:C.t3, marginBottom:18 }}>{sub}</div>
        {children}
        {onSave && <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Cancel</button>
          <button onClick={onSave} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>{saveLabel}</button>
        </div>}
        {!onSave && <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Close</button>
        </div>}
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────────
function Toast({ t }) {
  if (!t) return null
  return (
    <div style={{ position:'fixed', bottom:22, right:22, minWidth:260, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid var(--purple)`, borderRadius:10, padding:'13px 18px', zIndex:9999, boxShadow:'0 8px 30px rgba(var(--purple-rgb),.22)', animation:'toastIn .3s ease' }}>
      <style>{`@keyframes toastIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ fontWeight:700, color:C.t1, marginBottom:3 }}>{t.title}</div>
      <div style={{ fontSize:12, color:C.t3 }}>{t.msg}</div>
    </div>
  )
}

// ─── TAB: Overview ──────────────────────────────────────────────────────────────
function TabKPI({ batches, certs, sessions }) {
  const activeProgs = batches.filter(b => b.st === 'Active').length
  const avgComp = Math.round(batches.reduce((a, b) => a + b.completion, 0) / batches.length)
  const certsIssued = certs.filter(c => c.st === 'Issued').length
  const sessWeek = sessions.filter(s => s.day >= 13 && s.day <= 19 && s.st === 'Scheduled').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Overview" sub="Programme-wide metrics — April 2026">
        <button style={B.ghost}>⬇ Export Report</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Trainees" value={<span style={{color:C.cyan}}>7</span>} sub="Across all programs" dot={C.cyan} />
        <StatCard label="Active Programs" value={<span style={{color:C.green}}>{activeProgs}</span>} sub={`of ${batches.length} batches`} dot={C.green} />
        <StatCard label="Avg Completion" value={<span style={{color:C.pur}}>{avgComp}%</span>}
          bottom={<ProgBar p={avgComp} color={C.grad} height={6} />} />
        <StatCard label="Certs Issued" value={<span style={{color:C.green}}>{certsIssued}</span>} sub="This month" dot={C.green} />
        <StatCard label="Overdue Tasks" value={<span style={{color:C.red}}>2</span>} sub="Needs attention" dot={C.red} />
        <StatCard label="Sessions This Week" value={<span style={{color:C.yellow}}>{sessWeek}</span>} sub="Apr 13–19" dot={C.yellow} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Batch Completion Progress</CardTitle>
          {batches.map(b => (
            <ProgRow key={b.id} label={b.name.split('—')[0].trim()} p={b.completion}
              color={b.completion === 100 ? 'linear-gradient(90deg,#00c896,#00b4d8)' : b.st === 'On Hold' ? C.yellow : C.gbar} />
          ))}
        </Card>
        <Card>
          <CardTitle>Recent Activity</CardTitle>
          {[
            { ic:'✅', t:'Batch C Compliance completed',         s:'All 15 trainees certified',                col:C.green },
            { ic:'📝', t:'3 assessments scored today',           s:'2 passed, 1 failed — retest pending',      col:C.yellow },
            { ic:'🏆', t:'4 new certificates issued',            s:'Gold Safety Level 1 — Apr 14',             col:C.pur },
            { ic:'⚠️', t:'Low attendance: Hassan Ali 58%',       s:'Below 75% threshold — action needed',      col:C.red },
          ].map((a, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:18, flexShrink:0 }}>{a.ic}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:a.col }}>{a.t}</div>
                <div style={{ fontSize:11, color:C.t3, marginTop:2 }}>{a.s}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Calendar ──────────────────────────────────────────────────────────────
function TabCalendar({ sessions, setSessions, canEdit, isTrainee, showToast, onShowSession, setModal }) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const myBatch = 'Batch A'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Calendar" sub={`April 2026 — ${isTrainee ? 'Your sessions only' : 'All scheduled sessions'}`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'session', data:null })}>+ Add Session</button>}
      </SH>

      <div style={{ display:'flex', gap:12, marginBottom:4, fontSize:11 }}>
        {[['rgba(0,180,216,.4)','Scheduled'],['rgba(0,200,150,.4)','Completed'],['rgba(255,71,87,.4)','Cancelled']].map(([bg,lbl]) => (
          <span key={lbl} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:bg, display:'inline-block' }} />
            {lbl}
          </span>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {DAYS.map(d => <div key={d} style={{ fontSize:10, fontWeight:700, color:C.t3, textAlign:'center', padding:'4px 0', textTransform:'uppercase' }}>{d}</div>)}
        {/* April 2026 starts on Wednesday (offset 2) */}
        {[null, null, ...Array.from({ length:30 }, (_, i) => i + 1)].map((d, idx) => {
          if (!d) return <div key={idx} />
          const today = d === 13
          const daySessions = sessions.filter(s => s.day === d && (!isTrainee || s.batch === myBatch))
          return (
            <div key={d}
              onClick={() => daySessions.length ? onShowSession(daySessions[0]) : showToast(`April ${d}`, 'No sessions scheduled')}
              style={{ minHeight:70, background: today ? 'rgba(var(--purple-rgb),.08)' : 'rgba(255,255,255,.03)', border:`1px solid ${today ? 'var(--purple)' : 'rgba(255,255,255,.05)'}`, borderRadius:6, padding:5, cursor:'pointer', transition:'all .15s' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:3 }}>{d}</div>
              {daySessions.map(s => (
                <div key={s.id}
                  onClick={e => { e.stopPropagation(); onShowSession(s) }}
                  style={{ fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:3, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', background: s.st==='Completed'?'rgba(0,200,150,.2)':s.st==='Cancelled'?'rgba(255,71,87,.2)':'rgba(0,180,216,.2)', color: s.st==='Completed'?C.green:s.st==='Cancelled'?C.red:C.cyan }}>
                  {s.time} {s.title.split('—')[0].trim()}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {canEdit && !isTrainee && (
        <TableWrap>
          <TableHead title="Session List" subtitle="Quick manage sessions" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
              <thead><tr>{['Title','Date','Time','Trainer','Batch','Status','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{s.title}</td>
                    <td style={{ ...TD, color:C.t3 }}>{s.date}</td>
                    <td style={TD}>{s.time}</td>
                    <td style={TD}>{s.trainer}</td>
                    <td style={TD}>{s.batch}</td>
                    <td style={TD}><Badge s={s.st} /></td>
                    <td style={TD}>
                      <button onClick={() => setModal({ type:'session', data:s })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this session?')) { setSessions(p => p.filter(x => x.id !== s.id)); showToast('Deleted', 'Session removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrap>
      )}
    </div>
  )
}

// ─── TAB: Batches ───────────────────────────────────────────────────────────────
function TabBatches({ batches, setBatches, canEdit, isTrainee, showToast, setModal }) {
  const showData = isTrainee ? batches.filter(b => b.name.includes('Batch A')) : batches

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Batch Management" sub={`${showData.length} batches${isTrainee ? ' — your enrollment' : ''}`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'batch', data:null })}>+ Create Batch</button>}
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
        {showData.map(b => {
          const topColor = b.st === 'Active' ? C.green : b.st === 'On Hold' ? C.yellow : C.cyan
          const barColor = b.completion === 100 ? C.green : b.st === 'On Hold' ? C.yellow : C.gbar
          return (
            <div key={b.id} onClick={() => showToast('Batch Detail', `${b.name} — ${b.trainees} trainees enrolled`)}
              style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, cursor:'pointer', position:'relative', overflow:'hidden', transition:'all .15s' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:topColor }} />
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{b.name}</div>
                <Badge s={b.st} />
              </div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>📚 {b.prog}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>🧑‍🏫 Trainer: {b.trainer}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>📅 {b.start} — {b.end}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:10 }}>👥 {b.trainees} trainees</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.t3, marginBottom:4 }}>
                <span>Completion</span>
                <span style={{ fontWeight:700, color: b.completion === 100 ? C.green : C.t1 }}>{b.completion}%</span>
              </div>
              <ProgBar p={b.completion} color={barColor} height={6} />
              {canEdit && (
                <div style={{ marginTop:10, display:'flex', gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); setModal({ type:'batch', data:b }) }} style={{ ...B.sec, ...B.sm }}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); showToast('Trainees', `View all ${b.trainees} trainees in ${b.name}`) }} style={{ ...B.ghost, ...B.sm }}>View Trainees</button>
                  <button onClick={e => { e.stopPropagation(); if (window.confirm('Delete this batch?')) { setBatches(p => p.filter(x => x.id !== b.id)); showToast('Deleted', 'Batch removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TAB: Attendance ────────────────────────────────────────────────────────────
function TabAttendance({ attendance, trainees, canEdit, isTrainee, showToast, onOpenAtt }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Attendance Tracking" sub="Session-wise attendance summary">
        {canEdit && <button style={B.pri} onClick={onOpenAtt}>📋 Mark Attendance</button>}
        {!isTrainee && <button style={B.ghost}>⬇ Export</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['Session','Date','Batch','Present','Absent','Late','Total','Attendance %','Status', ...(canEdit ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {attendance.map((a, i) => {
                const p = pct(a.present, a.total)
                const rowBg = p < 75 ? 'rgba(255,71,87,.04)' : p >= 90 ? 'rgba(0,200,150,.04)' : ''
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{a.sess}</td>
                    <td style={{ ...TD, color:C.t3 }}>{a.date}</td>
                    <td style={TD}>{a.batch}</td>
                    <td style={{ ...TD, color:C.green, fontWeight:700 }}>{a.present}</td>
                    <td style={{ ...TD, color: a.absent > 0 ? C.red : C.t3, fontWeight: a.absent > 0 ? 700 : 400 }}>{a.absent}</td>
                    <td style={{ ...TD, color: a.late > 0 ? C.yellow : C.t3 }}>{a.late}</td>
                    <td style={TD}>{a.total}</td>
                    <td style={{ ...TD, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ProgBar p={p} color={p < 75 ? C.red : p >= 90 ? C.green : C.yellow} />
                        <span style={{ fontSize:12, fontWeight:700, color: p < 75 ? C.red : p >= 90 ? C.green : C.yellow, width:34, textAlign:'right' }}>{p}%</span>
                      </div>
                    </td>
                    <td style={TD}>{p < 75 ? <Badge s="Absent" /> : p >= 90 ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(0,200,150,.12)', color:C.green, border:'1px solid rgba(0,200,150,.3)' }}>Excellent</span> : <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(255,214,0,.1)', color:C.yellow, border:'1px solid rgba(255,214,0,.3)' }}>Acceptable</span>}</td>
                    {canEdit && <td style={TD}><button onClick={() => showToast('Tip', 'Use Mark Attendance to create corrected records')} style={{ ...B.ghost, ...B.sm }}>Amend</button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title="Trainee Attendance Summary" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Trainee','Program','Attendance %','Alert'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {trainees.map(t => (
                <tr key={t.name} style={{ background: t.att < 75 ? 'rgba(255,71,87,.04)' : '' }}>
                  <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{t.name[0]}</div>
                      <span style={{ fontWeight:700, color:C.t1 }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, color:C.t3 }}>{t.prog.join(', ')}</td>
                  <td style={{ ...TD, minWidth:140 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={t.att} color={t.att < 75 ? C.red : t.att >= 90 ? C.green : C.yellow} />
                      <span style={{ fontSize:12, fontWeight:700, color: t.att < 75 ? C.red : C.t1, width:34, textAlign:'right' }}>{t.att}%</span>
                    </div>
                  </td>
                  <td style={TD}>{t.att < 75 ? <Badge s="Absent" /> : <span style={{ color:C.t4 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Resources ─────────────────────────────────────────────────────────────
function TabResources({ resources, setResources, canEdit, isTrainee, showToast, setModal }) {
  const showData = isTrainee ? resources.filter(r => r.prog === 'Gold Safety Essentials') : resources

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Resource Library" sub={isTrainee ? 'Your program materials only' : 'All training materials'}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'resource', data:null })}>⬆ Upload Material</button>}
      </SH>

      <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:7, padding:'7px 14px', fontFamily:'inherit', fontSize:12, outline:'none', alignSelf:'flex-start' }}>
        <option>All Programs</option>
        {['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o => <option key={o}>{o}</option>)}
      </select>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['File Name','Program','Type','Uploaded By','Date','Views','Action'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {showData.map(r => {
                const icon = r.type === 'PDF' ? '📄' : r.type === 'Video' ? '🎬' : '📊'
                return (
                  <tr key={r.id}>
                    <td style={TD}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{icon}</span>
                        <span style={{ fontWeight:700, color:C.t1 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, color:C.t3 }}>{r.prog}</td>
                    <td style={TD}><Badge s={r.type} /></td>
                    <td style={{ ...TD, color:C.t2 }}>{r.by}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.date}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.views} views</td>
                    <td style={TD}>
                      <button onClick={() => showToast('Download', `${r.name} downloaded`)} style={{ ...B.sec, ...B.sm }}>⬇ Download</button>
                      {canEdit && <button onClick={() => setModal({ type:'resource', data:r })} style={{ ...B.ghost, ...B.sm, marginLeft:6 }}>Edit</button>}
                      {canEdit && <button onClick={() => { setResources(p => p.filter(x => x.id !== r.id)); showToast('Deleted', 'File removed') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit', marginLeft:8 }}>Del</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Assessments ───────────────────────────────────────────────────────────
function TabAssessments({ assessments, setAssessments, canEdit, isTrainee, showToast, onOpenAdd, onShowProfile, setModal }) {
  const myData = isTrainee ? assessments.filter(a => a.trainee === 'Ahmad Yusuf') : assessments
  const pass = assessments.filter(a => a.pass).length
  const passRate = pct(pass, assessments.length)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Assessments & Scores" sub={isTrainee ? 'Your results only' : 'All assessment results'}>
        {canEdit && <button style={B.pri} onClick={onOpenAdd}>+ Add Result</button>}
      </SH>

      {!isTrainee && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Total Assessments" value={<span style={{color:C.cyan}}>{assessments.length}</span>} sub="Recorded" dot={C.cyan} />
          <StatCard label="Pass Rate" value={<span style={{color:C.green}}>{passRate}%</span>} bottom={<ProgBar p={passRate} color={C.green} height={6} />} />
          <StatCard label="Avg Score" value={<span style={{color:C.pur}}>{avg(assessments,'score')}%</span>} sub="All attempts" dot={C.pur} />
        </div>
      )}

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: isTrainee ? 500 : 700 }}>
            <thead><tr>
              {[...(!isTrainee ? ['Trainee'] : []), 'Program','Score','Result','Date','Attempt', ...(!isTrainee && canEdit ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {myData.map((a, i) => (
                <tr key={i} style={{ background: a.pass ? 'rgba(0,200,150,.04)' : 'rgba(255,71,87,.04)' }}>
                  {!isTrainee && <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{a.trainee[0]}</div>
                      <button onClick={() => onShowProfile(a.trainee)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>{a.trainee}</button>
                    </div>
                  </td>}
                  <td style={TD}>{a.prog}</td>
                  <td style={{ ...TD, minWidth:120 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={a.score} color={a.score >= 75 ? C.green : C.red} />
                      <span style={{ fontSize:12, fontWeight:800, color: a.score >= 75 ? C.green : C.red, width:36, textAlign:'right' }}>{a.score}%</span>
                    </div>
                  </td>
                  <td style={TD}><Badge s={a.pass ? 'Pass' : 'Fail'} /></td>
                  <td style={{ ...TD, color:C.t3 }}>{a.date}</td>
                  <td style={{ ...TD, color: a.attempt > 1 ? C.yellow : C.t3 }}>#{a.attempt}{a.attempt > 1 ? ' (Retest)' : ''}</td>
                  {!isTrainee && canEdit && <td style={TD}>
                    <button onClick={() => setModal({ type:'assess', data:a })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                    <button onClick={() => { if (window.confirm('Delete this result?')) { setAssessments(p => p.filter((x, idx) => idx !== i)); showToast('Deleted', 'Assessment removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Certifications ────────────────────────────────────────────────────────
function TabCerts({ certs, setCerts, canEdit, canApprove, isTrainee, showToast, onShowProfile, setModal }) {
  const myData = isTrainee ? certs.filter(c => c.trainee === 'Ahmad Yusuf') : certs

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Certification Management" sub={isTrainee ? 'Your certificates' : 'All certifications'}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'cert', data:null })}>+ Issue Cert</button>}
        <button style={B.ghost}>⬇ Export List</button>
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: isTrainee ? 500 : 800 }}>
            <thead><tr>
              {[...(!isTrainee ? ['Trainee'] : []), 'Certificate','Issued','Expiry','Status','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {myData.map((c, i) => {
                const rowBg = c.st === 'Expired' ? 'rgba(255,71,87,.04)' : c.st === 'Pending' ? 'rgba(255,214,0,.03)' : ''
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    {!isTrainee && <td style={TD}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,200,150,.2)', color:C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{c.trainee[0]}</div>
                        <button onClick={() => onShowProfile(c.trainee)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>{c.trainee}</button>
                      </div>
                    </td>}
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{c.cert}</td>
                    <td style={{ ...TD, color: c.issued === '—' ? C.t4 : C.t3 }}>{c.issued}</td>
                    <td style={{ ...TD, color: c.st === 'Expired' ? C.red : c.expiry === '—' ? C.t4 : C.t3 }}>{c.expiry}{c.st === 'Expired' ? ' ⚠' : ''}</td>
                    <td style={TD}><Badge s={c.st} /></td>
                    <td style={TD}>
                      {c.doc !== '—' && <button onClick={() => showToast('Download', `${c.cert} certificate downloaded`)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>⬇ Download</button>}
                      {canApprove && c.st === 'Pending' && <button onClick={() => {
                        setCerts(p => p.map(x => x.trainee === c.trainee && x.st === 'Pending' ? {...x, st:'Issued', issued:'Apr 13, 2026', expiry:'Apr 13, 2028'} : x))
                        showToast('Certificate Approved', `${c.trainee} certificate issued`)
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:C.green, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Approve</button>}
                      {canEdit && <button onClick={() => setModal({ type:'cert', data:c })} style={{ ...B.ghost, ...B.sm, marginRight:6 }}>Edit</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete this certificate row?')) { setCerts(p => p.filter((x, idx) => idx !== i)); showToast('Deleted', 'Certificate record removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Feedback ──────────────────────────────────────────────────────────────
function TabFeedback({ feedback, setFeedback, canEdit, isTrainee, isTrainer, showToast, onOpenFeedback }) {
  if (isTrainee) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <SH title="Session Feedback" sub="Submit feedback after each completed session">
          <button style={B.pri} onClick={onOpenFeedback}>⭐ Submit Feedback</button>
        </SH>
        <div style={{ background:'rgba(var(--purple-rgb),.08)', border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 18px', fontSize:13, color:C.t2 }}>
          You can submit feedback after each completed session. Click <strong style={{ color:C.pur }}>Submit Feedback</strong> above.
        </div>
      </div>
    )
  }

  const trainers = [...new Set(feedback.map(f => f.trainer))]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Trainer Feedback & Ratings" sub={isTrainer ? 'Your feedback summary' : 'All trainer ratings'} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
        {trainers.filter(tr => !isTrainer || tr === 'James O.').map(tr => {
          const tf = feedback.filter(f => f.trainer === tr)
          const avgT = (tf.reduce((a,b) => a + b.trainerRating, 0) / tf.length).toFixed(1)
          const avgC = (tf.reduce((a,b) => a + b.contentRating,  0) / tf.length).toFixed(1)
          return (
            <Card key={tr}>
              <CardTitle>{tr}</CardTitle>
              <div style={{ textAlign:'center', marginBottom:12 }}>
                <div style={{ fontSize:32, fontWeight:800, color:C.gold }}>{avgT}</div>
                <div style={{ margin:'4px 0' }}><Stars n={parseFloat(avgT)} size={16} /></div>
                <div style={{ fontSize:11, color:C.t3 }}>{tf.length} feedback submissions</div>
              </div>
              <ProgRow label="Trainer Rating" p={Math.round(parseFloat(avgT)/5*100)} color={C.gold} />
              <ProgRow label="Content Rating" p={Math.round(parseFloat(avgC)/5*100)} color={C.pur} />
            </Card>
          )
        })}
      </div>

      {!isTrainer && (
        <TableWrap>
          <TableHead title="All Feedback Comments" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
              <thead><tr>
                {['Trainer','Trainee','Session','Trainer ★','Content ★','Venue ★','Comment'].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {feedback.map((f, i) => (
                  <tr key={i}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{f.trainer}</td>
                    <td style={TD}>{f.trainee}</td>
                    <td style={{ ...TD, color:C.t3, fontSize:11 }}>{f.session}</td>
                    <td style={TD}><Stars n={f.trainerRating} size={13} /></td>
                    <td style={TD}><Stars n={f.contentRating} size={13} /></td>
                    <td style={TD}><Stars n={f.venueRating}   size={13} /></td>
                    <td style={{ ...TD, color:C.t3, fontSize:11, maxWidth:200 }}>{f.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrap>
      )}
    </div>
  )
}

// ─── TAB: Analytics ─────────────────────────────────────────────────────────────
function TabAnalytics({ batches, canEdit, isAdmin, isHead, isMgmt }) {
  if (!isAdmin && !isHead && !isMgmt) return <Restrict text="Analytics & Reports are restricted to leadership roles." />

  const enroll = [{m:'Nov',v:3},{m:'Dec',v:5},{m:'Jan',v:8},{m:'Feb',v:6},{m:'Mar',v:12},{m:'Apr',v:7}]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Analytics & Reports" sub="Programme performance insights">
        <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:7, padding:'6px 12px', fontFamily:'inherit', fontSize:12, outline:'none' }}>
          <option>Last 3 Months</option><option>Last 6 Months</option><option>This Year</option>
        </select>
        <button style={B.ghost}>⬇ PDF</button>
        <button style={B.ghost}>⬇ Excel</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Batch Completion Rate (%)</CardTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:110 }}>
            {batches.filter(b => b.st !== 'On Hold').map(b => (
              <div key={b.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ height:b.completion, width:'100%', borderRadius:'4px 4px 0 0', background: b.completion === 100 ? 'linear-gradient(180deg,#00c896,#00b4d8)' : 'linear-gradient(180deg,var(--purple),var(--purple-light))', minHeight:4 }} />
                <div style={{ fontSize:9, fontWeight:700, color:C.t3 }}>{b.completion}%</div>
                <div style={{ fontSize:9, color:C.t3 }}>{b.name.split('—')[0].trim().split(' ')[1]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Monthly Enrollment Trend</CardTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:110 }}>
            {enroll.map(d => (
              <div key={d.m} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ height:d.v*8, width:'100%', borderRadius:'4px 4px 0 0', background:'rgba(0,180,216,.6)', minHeight:4 }} />
                <div style={{ fontSize:9, color:C.t3 }}>{d.v}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{d.m}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Program Status Breakdown</CardTitle>
          {[{l:'Active Programs',v:3,c:C.green},{l:'Completed',v:2,c:C.cyan},{l:'On Hold',v:1,c:C.yellow}].map(p => (
            <ProgRow key={p.l} label={p.l} p={Math.round(p.v/6*100)} color={p.c} />
          ))}
        </Card>
        <Card>
          <CardTitle>Trainer Performance Summary</CardTitle>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Trainer','Sessions','Avg Rating','Completion %'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[{name:'James O.', sess:8, rating:4.8, comp:82},{name:'Nadia K.', sess:6, rating:4.5, comp:100},{name:'Sara A.', sess:5, rating:4.0, comp:100}].map(t => (
                <tr key={t.name}>
                  <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{t.name}</td>
                  <td style={TD}>{t.sess}</td>
                  <td style={TD}><Stars n={t.rating} size={13} /> <span style={{ color:C.gold, fontSize:12, fontWeight:700 }}>{t.rating}</span></td>
                  <td style={{ ...TD, color: t.comp === 100 ? C.cyan : C.green, fontWeight:700 }}>{t.comp}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Trainees ──────────────────────────────────────────────────────────────
function TabTrainees({ trainees, setTrainees, canEdit, isTrainee, showToast, onShowProfile, setModal }) {
  const showData = isTrainee ? trainees.filter(t => t.name === 'Ahmad Yusuf') : trainees

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Trainee Profiles" sub={isTrainee ? 'Your profile' : `All ${trainees.length} trainees`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'trainee', data:null })}>+ Enroll Trainee</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['Trainee','Department','Role','Programs','Attendance','Certs','Profile', ...(canEdit && !isTrainee ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {showData.map(t => (
                <tr key={t.name}>
                  <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{t.name[0]}</div>
                      <div>
                        <div style={{ fontWeight:700, color:C.t1 }}>{t.name}</div>
                        <div style={{ fontSize:10, color:C.t3 }}>{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={TD}>{t.dept}</td>
                  <td style={{ ...TD, color:C.t3 }}>{t.role}</td>
                  <td style={TD}>{t.prog.map(p => <span key={p} style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'rgba(var(--purple-rgb),.15)', color:C.pur, border:'1px solid rgba(var(--purple-rgb),.3)', marginRight:3, whiteSpace:'nowrap' }}>{p.split(' ').slice(0,2).join(' ')}</span>)}</td>
                  <td style={{ ...TD, minWidth:130 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={t.att} color={t.att < 75 ? C.red : t.att >= 90 ? C.green : C.yellow} />
                      <span style={{ fontSize:11, fontWeight:700, color: t.att < 75 ? C.red : C.t1, width:34, textAlign:'right' }}>{t.att}%</span>
                    </div>
                  </td>
                  <td style={TD}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: t.certs > 0 ? 'rgba(0,200,150,.12)':'rgba(255,255,255,.05)', color: t.certs > 0 ? C.green : C.t3, border:`1px solid ${t.certs > 0 ? 'rgba(0,200,150,.3)':'rgba(255,255,255,.1)'}` }}>{t.certs} cert{t.certs !== 1 ? 's' : ''}</span></td>
                  <td style={TD}><button onClick={() => onShowProfile(t.name)} style={{ ...B.sec, ...B.sm }}>View Profile</button></td>
                  {canEdit && !isTrainee && <td style={TD}>
                    <button onClick={() => setModal({ type:'trainee', data:t })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                    <button onClick={() => { if (window.confirm(`Delete ${t.name}?`)) { setTrainees(p => p.filter(x => x.name !== t.name)); showToast('Deleted', 'Trainee removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Skill Gap ─────────────────────────────────────────────────────────────
function TabSkillGap({ canEdit, isAdmin, isHead, isUser, showToast }) {
  if (!isAdmin && !isHead && !isUser) return <Restrict text="Skill Gap Analysis is restricted to authorized training roles." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Skill Gap Analysis" sub="Required skills vs current levels by department">
        <button style={B.ghost}>⬇ Export Report</button>
      </SH>

      <Card>
        <CardTitle>Department Skill Gap Heatmap</CardTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
          {SKILL_GAPS.map((g, i) => {
            const col = g.gap >= 51 ? { bg:'rgba(255,71,87,.2)', color:C.red } : g.gap >= 21 ? { bg:'rgba(255,214,0,.15)', color:C.yellow } : { bg:'rgba(0,200,150,.15)', color:C.green }
            return (
              <div key={i} onClick={() => showToast('Assign Program', `${g.prog} assigned to ${g.dept} team`)}
                style={{ borderRadius:6, padding:'10px 8px', textAlign:'center', cursor:'pointer', background:col.bg, transition:'all .15s' }}>
                <div style={{ fontSize:11, fontWeight:700, color:col.color, marginBottom:3 }}>{g.dept}</div>
                <div style={{ fontSize:10, opacity:.8, color:col.color }}>{g.skill.split(' ').slice(0,2).join(' ')}</div>
                <div style={{ fontSize:13, fontWeight:800, color:col.color, marginTop:3 }}>{g.gap}% gap</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:14, fontSize:11 }}>
          <span style={{ color:C.red }}>⬛ High gap (&gt;50%)</span>
          <span style={{ color:C.yellow }}>⬛ Medium gap (21–50%)</span>
          <span style={{ color:C.green }}>⬛ Low gap (0–20%)</span>
        </div>
      </Card>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:850 }}>
            <thead><tr>
              {['Department','Required Skill','Required Level','Current Level','Gap %','Recommended Program','Action'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {SKILL_GAPS.map((g, i) => {
                const rowBg = g.gap >= 51 ? 'rgba(255,71,87,.04)' : g.gap >= 21 ? 'rgba(255,214,0,.03)' : 'rgba(0,200,150,.03)'
                const gapColor = g.gap >= 51 ? C.red : g.gap >= 21 ? C.yellow : C.green
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{g.dept}</td>
                    <td style={TD}>{g.skill}</td>
                    <td style={TD}><Badge s={g.required} /></td>
                    <td style={TD}><Badge s={g.current} /></td>
                    <td style={{ ...TD, color:gapColor, fontWeight:800 }}>{g.gap}%</td>
                    <td style={{ ...TD, color:C.pur }}>{g.prog}</td>
                    <td style={TD}><button onClick={() => showToast('Program Assigned', `${g.prog} assigned to close ${g.dept} skill gap`)} style={{ ...B.pri, ...B.sm }}>Assign Program</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── Modals ──────────────────────────────────────────────────────────────────────
function ModalSession({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { title:'', prog:'Gold Safety Essentials', date:'', time:'', trainer:'', venue:'Training Room A', batch:'Batch A — Gold Safety', st:'Scheduled' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Training Session' : 'Add Training Session'} sub="Schedule or update a training session" onClose={onClose} onSave={() => f.title.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Session'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Session Title</ML><MI value={f.title} onChange={s('title')} placeholder="e.g. Gold Safety Induction" /></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Date</ML><input type="date" value={f.date} onChange={s('date')} style={IS} /></div>
        <div><ML>Time</ML><input type="time" value={f.time} onChange={s('time')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainer</ML><MI value={f.trainer} onChange={s('trainer')} placeholder="Trainer name" /></div>
        <div><ML>Venue / Mode</ML><MS value={f.venue} onChange={s('venue')}>{['Training Room A','Online — Zoom','Site Floor','Classroom B'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Batch</ML><MS value={f.batch} onChange={s('batch')}>{['Batch A — Gold Safety','Batch B — Equipment','Batch C — Compliance','Batch D — Leadership'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Scheduled','Completed','Cancelled'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
    </Modal>
  )
}

function ModalBatch({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', prog:'Gold Safety Essentials', start:'', end:'', trainer:'', trainees:0, completion:0, st:'Active' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Batch' : 'Create Batch'} sub="Register or update a training batch" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Create Batch'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Batch Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Batch E — New Joiners" /></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Start Date</ML><input type="date" value={f.start} onChange={s('start')} style={IS} /></div>
        <div><ML>End Date</ML><input type="date" value={f.end} onChange={s('end')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainer</ML><MI value={f.trainer} onChange={s('trainer')} placeholder="Trainer name" /></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Active','On Hold','Completed'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee Count</ML><MI type="number" value={f.trainees} onChange={s('trainees')} min="0" /></div>
        <div><ML>Completion %</ML><MI type="number" value={f.completion} onChange={s('completion')} min="0" max="100" /></div>
      </div>
    </Modal>
  )
}

const ATT_TRAINEES = ['Ahmad Yusuf','Zara Malik','Hassan Ali','Bilal Raza','Omar Khan','Layla Siddiqui','Nadia Khan','Karim H.','Sara A.','Fatima N.','Ali B.','Tariq O.']
function ModalAttendance({ onClose, showToast, onSaveRecord }) {
  const [state, setState] = useState({})
  function set(i, v) { setState(p => ({...p,[i]:v})) }

  return (
    <Modal title="Mark Attendance" sub="Gold Safety — Module 1 · Batch A · Apr 13" onClose={onClose}
      onSave={() => {
        const p = Object.values(state).filter(v=>v==='P').length
        const a = Object.values(state).filter(v=>v==='A').length
        const l = Object.values(state).filter(v=>v==='L').length
        onSaveRecord?.({ sess:'Manual Attendance Entry', date:'Today', batch:'Batch A', present:p, absent:a, late:l, total:p+a+l })
        showToast('Attendance Saved', `Present: ${p} · Absent: ${a} · Late: ${l}`)
        onClose()
      }} saveLabel="Save Attendance">
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto', marginBottom:12 }}>
        {ATT_TRAINEES.map((t, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,.03)', borderRadius:8, border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{t}</span>
            <div style={{ display:'flex', gap:5 }}>
              {[['P','Present',C.green],['A','Absent',C.red],['L','Late',C.yellow]].map(([v,lbl,col]) => (
                <button key={v} onClick={() => set(i, v)}
                  style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', fontFamily:'inherit', transition:'all .15s',
                    background: state[i]===v ? col : `${col}18`,
                    color: state[i]===v ? (v==='A'?'#fff':'#131313') : col }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ModalAssessment({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, score:String(initial.score), attempt:String(initial.attempt) } : { trainee:'Ahmad Yusuf', prog:'Gold Safety Essentials', score:'', attempt:'1', date:'Apr 13, 2026' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Assessment Result' : 'Add Assessment Result'} sub="Record or update a trainee's assessment score" onClose={onClose}
      onSave={() => { if (!f.score) return; onSave(f) }} saveLabel={isEdit ? 'Save Changes' : 'Save Result'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee</ML><MS value={f.trainee} onChange={s('trainee')}>{['Ahmad Yusuf','Zara Malik','Hassan Ali','Nadia Khan','Layla Siddiqui','Bilal Raza'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Score (%)</ML><MI type="number" value={f.score} onChange={s('score')} placeholder="0–100" min="0" max="100" /></div>
        <div><ML>Attempt #</ML><MI type="number" value={f.attempt} onChange={s('attempt')} min="1" /></div>
      </div>
      <div><ML>Date</ML><MI value={f.date} onChange={s('date')} placeholder="Apr 13, 2026" /></div>
    </Modal>
  )
}

function ModalResource({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', prog:'Gold Safety Essentials', type:'PDF', by:'', date:'', views:0 })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Resource' : 'Upload Resource'} sub="Manage training library files" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Upload'}>
      <div><ML>File Name</ML><MI value={f.name} onChange={s('name')} placeholder="Resource file name" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Type</ML><MS value={f.type} onChange={s('type')}>{['PDF','Video','Document'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Uploaded By</ML><MI value={f.by} onChange={s('by')} placeholder="Your name" /></div>
        <div><ML>Date</ML><MI value={f.date} onChange={s('date')} placeholder="Apr 20, 2026" /></div>
      </div>
      <div><ML>Views</ML><MI type="number" value={f.views} onChange={s('views')} min="0" /></div>
    </Modal>
  )
}

function ModalCert({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { trainee:'Ahmad Yusuf', cert:'', issued:'', expiry:'', st:'Pending', doc:'' })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Certificate' : 'Issue Certificate'} sub="Create or update certification record" onClose={onClose} onSave={() => f.cert.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Issue Cert'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee</ML><MI value={f.trainee} onChange={s('trainee')} /></div>
        <div><ML>Certificate</ML><MI value={f.cert} onChange={s('cert')} placeholder="Certificate name" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Issued Date</ML><MI value={f.issued} onChange={s('issued')} placeholder="Apr 20, 2026" /></div>
        <div><ML>Expiry Date</ML><MI value={f.expiry} onChange={s('expiry')} placeholder="Apr 20, 2028" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Issued','Pending','Expired'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Doc File</ML><MI value={f.doc} onChange={s('doc')} placeholder="cert_file.pdf" /></div>
      </div>
    </Modal>
  )
}

function ModalTrainee({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, prog:Array.isArray(initial.prog) ? initial.prog.join(', ') : initial.prog } : { name:'', dept:'Operations', role:'', email:'', prog:'Gold Safety Essentials', att:0, certs:0 })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Trainee' : 'Enroll Trainee'} sub="Create or update trainee profile" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Enroll'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Name</ML><MI value={f.name} onChange={s('name')} placeholder="Full name" /></div>
        <div><ML>Email</ML><MI value={f.email} onChange={s('email')} placeholder="name@ops.kz" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Department</ML><MS value={f.dept} onChange={s('dept')}>{['Operations','Production','Quality','Training','Sales','Finance','HR'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Role</ML><MI value={f.role} onChange={s('role')} placeholder="Job title" /></div>
      </div>
      <div><ML>Programs (comma-separated)</ML><MI value={f.prog} onChange={s('prog')} placeholder="Gold Safety Essentials, Tech Skills" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Attendance %</ML><MI type="number" value={f.att} onChange={s('att')} min="0" max="100" /></div>
        <div><ML>Certificates</ML><MI type="number" value={f.certs} onChange={s('certs')} min="0" /></div>
      </div>
    </Modal>
  )
}

function ModalFeedback({ onClose, onAdd }) {
  const [ratings, setRatings] = useState({ trainer:0, content:0, venue:0 })
  const [comment, setComment] = useState('')

  function StarInput({ label, rk }) {
    return (
      <div style={{ marginBottom:14 }}>
        <ML>{label}</ML>
        <div style={{ display:'flex', gap:6 }}>
          {[1,2,3,4,5].map(v => (
            <span key={v} onClick={() => setRatings(p => ({...p,[rk]:v}))}
              style={{ fontSize:24, cursor:'pointer', color: v <= ratings[rk] ? C.gold : C.t4, transition:'transform .1s' }}>★</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Modal title="Submit Session Feedback" sub="Rate your experience for this training session" onClose={onClose}
      onSave={() => {
        if (!ratings.trainer) { return }
        onAdd({ trainerRating:ratings.trainer, contentRating:ratings.content||3, venueRating:ratings.venue||3, comment:comment||'No comment' })
      }} saveLabel="Submit Feedback">
      <StarInput label="Trainer Rating" rk="trainer" />
      <StarInput label="Content Rating" rk="content" />
      <StarInput label="Venue / Setup Rating" rk="venue" />
      <ML>Comments</ML>
      <MTA value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience..." />
    </Modal>
  )
}

function ModalProfile({ name, trainees, assessments, certs, canEdit, showToast, onClose }) {
  const t = trainees.find(x => x.name === name)
  if (!t) return null
  const myAss   = assessments.filter(a => a.trainee === name)
  const myCerts = certs.filter(c => c.trainee === name && c.st === 'Issued')

  return (
    <Modal title={t.name} sub={`${t.dept} · ${t.role} · ${t.email}`} onClose={onClose} wide
      onSave={() => { showToast('PDF Export','Individual profile report exported'); onClose() }} saveLabel="⬇ Export PDF">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:11, marginBottom:14 }}>
        {[['Attendance', `${t.att}%`, t.att < 75 ? C.red : C.green],['Certifications', t.certs, C.pur],['Programs', t.prog.length, C.cyan]].map(([lbl,val,col]) => (
          <div key={lbl} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>{lbl}</div>
            <div style={{ fontSize:20, fontWeight:800, color:col }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight:700, color:C.t1, marginBottom:8, fontSize:13 }}>Enrolled Programs</div>
      {t.prog.map(p => <ProgRow key={p} label={p.split(' ').slice(0,3).join(' ')} p={65} color={C.gbar} />)}
      {myAss.length > 0 && <>
        <div style={{ fontWeight:700, color:C.t1, margin:'14px 0 8px', fontSize:13 }}>Assessment Scores</div>
        {myAss.map((a, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
            <span style={{ color:C.t2 }}>{a.prog}</span>
            <span style={{ fontWeight:700, color: a.pass ? C.green : C.red }}>{a.score}% — {a.pass ? 'Pass' : 'Fail'}</span>
          </div>
        ))}
      </>}
      {myCerts.length > 0 && <>
        <div style={{ fontWeight:700, color:C.t1, margin:'14px 0 8px', fontSize:13 }}>Certificates</div>
        {myCerts.map((c, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
            <Badge s="Issued" />
            <span style={{ fontWeight:600, color:C.t1 }}>{c.cert}</span>
            <span style={{ color:C.t3 }}>Exp: {c.expiry}</span>
          </div>
        ))}
      </>}
      {canEdit && (
        <div style={{ marginTop:14 }}>
          <ML>Trainer Remarks</ML>
          <MTA placeholder="Add remarks about this trainee..." />
        </div>
      )}
    </Modal>
  )
}

function ModalSessionDetail({ sess, onClose, onMarkAtt }) {
  if (!sess) return null
  return (
    <Modal title={sess.title} sub="Session Details" onClose={onClose}
      onSave={onMarkAtt} saveLabel="Mark Attendance">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11, marginBottom:14 }}>
        <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>Status</div>
          <Badge s={sess.st} />
        </div>
        <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>Date & Time</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{sess.date} · {sess.time}</div>
        </div>
      </div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>📚 <strong style={{color:C.t1}}>Program:</strong> {sess.prog}</div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>🧑‍🏫 <strong style={{color:C.t1}}>Trainer:</strong> {sess.trainer}</div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>👥 <strong style={{color:C.t1}}>Batch:</strong> {sess.batch}</div>
      <div style={{ fontSize:13, color:C.t2 }}>📍 <strong style={{color:C.t1}}>Venue:</strong> {sess.venue}</div>
    </Modal>
  )
}

// ─── Notifications Panel ────────────────────────────────────────────────────────
function NotifPanel({ notifs, setNotifs, onClose }) {
  const unread = notifs.filter(n => !n.read).length
  const lvColor = { red:C.red, yellow:C.yellow, orange:C.orange, green:C.green, cyan:C.cyan }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:890 }} />
      <div style={{ position:'fixed', top:0, right:0, width:380, height:'100vh', background:'#ffffff', borderLeft:`1px solid ${C.border2}`, zIndex:900, display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,.15)' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8f9fa' }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.t1, display:'flex', alignItems:'center', gap:8 }}>
            🔔 Training Alerts
            {unread > 0 && <span style={{ background:C.red, color:'#fff', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>{unread} new</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {notifs.length === 0 && <div style={{ textAlign:'center', padding:40, color:C.t4 }}>🔔<br/>No alerts</div>}
          {notifs.map(n => {
            const col = lvColor[n.lv] || C.cyan
            return (
              <div key={n.id} style={{ background:n.read?'rgba(255,255,255,.01)':'rgba(255,255,255,.03)', border:`1px solid rgba(255,255,255,.05)`, borderLeft:`3px solid ${col}`, borderRadius:9, padding:'11px 13px', marginBottom:7, opacity: n.read ? .5 : 1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:col, marginBottom:3 }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.t3, lineHeight:1.5, marginBottom:6 }}>{n.desc}</div>
                <div style={{ display:'flex', gap:5 }}>
                  {!n.read && <button onClick={() => setNotifs(p => p.map(x => x.id===n.id ? {...x,read:true} : x))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(0,200,150,.12)', color:C.green, fontFamily:'inherit' }}>✓ Read</button>}
                  <button onClick={() => setNotifs(p => p.filter(x => x.id !== n.id))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,255,255,.06)', color:C.t3, fontFamily:'inherit' }}>✕ Dismiss</button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.border}`, display:'flex', gap:7 }}>
          <button onClick={() => setNotifs(p => p.map(n => ({...n,read:true})))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>✓ Mark all read</button>
          <button onClick={() => setNotifs(p => p.filter(n => !n.read))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.border}`, background:'rgba(255,255,255,.06)', color:C.t3 }}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TrainingTab() {
  const { token } = useAuth()
  const perms    = usePermissions()
  const isAdmin  = perms.isSuperAdmin
  const { t } = useLanguage()
  const TABS = useMemo(() => getTrainingTabs(t), [t])
  const isHead   = perms.isDepartmentHead   // Training Head
  const isMgmt   = perms.isManagement
  const isUser   = perms.isDepartmentUser   // Trainer or HR Manager
  const isExternal = perms.isExternal       // Trainee
  const canEdit  = isAdmin || isHead || isUser
  const canApprove = isAdmin || isHead

  // For display purposes: trainers see trainer view, trainees see self-only view
  const isTrainee = isExternal
  const isTrainer = isUser && !isMgmt

  const [activeTab,   setActiveTab]   = useState('kpi')
  const [sessions,    setSessions]    = useState(INIT_SESSIONS)
  const [batches,     setBatches]     = useState(INIT_BATCHES)
  const [attendance,  setAttendance]  = useState(INIT_ATTENDANCE)
  const [resources,   setResources]   = useState(INIT_RESOURCES)
  const [assessments, setAssessments] = useState(INIT_ASSESSMENTS)
  const [certs,       setCerts]       = useState(INIT_CERTS)
  const [feedback,    setFeedback]    = useState(INIT_FEEDBACK)
  const [trainees,    setTrainees]    = useState(INIT_TRAINEES)
  const [notifs,      setNotifs]      = useState(INIT_NOTIFS)

  const [modal,     setModal]     = useState({ type:null, data:null })
  const [sessDet,   setSessDet]   = useState(null)
  const [profName,  setProfName]  = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [toast,     setToast]     = useState(null)
  const loadedRef = useRef(false)
  const persistTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!token) return
    departmentStateAPI.getDepartmentState(token, 'training')
      .then((res) => {
        if (cancelled) return
        const state = res?.state
        if (!state || typeof state !== 'object') return
        if (Array.isArray(state.sessions)) setSessions(state.sessions)
        if (Array.isArray(state.batches)) setBatches(state.batches)
        if (Array.isArray(state.attendance)) setAttendance(state.attendance)
        if (Array.isArray(state.resources)) setResources(state.resources)
        if (Array.isArray(state.assessments)) setAssessments(state.assessments)
        if (Array.isArray(state.certs)) setCerts(state.certs)
        if (Array.isArray(state.feedback)) setFeedback(state.feedback)
        if (Array.isArray(state.trainees)) setTrainees(state.trainees)
        if (Array.isArray(state.notifs)) setNotifs(state.notifs)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) loadedRef.current = true
      })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!token || !loadedRef.current) return
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => {
      departmentStateAPI.saveDepartmentState(token, 'training', {
        sessions,
        batches,
        attendance,
        resources,
        assessments,
        certs,
        feedback,
        trainees,
        notifs,
      }).catch(() => {})
    }, 600)

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [token, sessions, batches, attendance, resources, assessments, certs, feedback, trainees, notifs])

  function closeModal() { setModal({ type:null, data:null }) }

  function showToast(title, msg) {
    setToast({ title, msg })
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => setToast(null), 3000)
  }

  function saveSession(f) {
    const payload = {
      id: f.id || Date.now(),
      title: f.title.trim(),
      prog: f.prog,
      date: f.date || 'Apr 30',
      day: f.day || parseInt((f.date || '').split('-')[2], 10) || 30,
      time: f.time || '09:00',
      trainer: f.trainer || 'TBD',
      batch: f.batch,
      venue: f.venue,
      st: f.st,
    }
    setSessions(p => f.id ? p.map(x => x.id === f.id ? payload : x) : [...p, payload])
    closeModal()
    showToast(f.id ? 'Session Updated' : 'Session Added', payload.title)
  }
  function saveBatch(f) {
    const payload = {
      id: f.id || Date.now(),
      name: f.name.trim(),
      prog: f.prog,
      start: f.start || 'TBD',
      end: f.end || 'TBD',
      trainer: f.trainer || 'TBD',
      trainees: Number(f.trainees) || 0,
      st: f.st,
      completion: Number(f.completion) || 0,
    }
    setBatches(p => f.id ? p.map(x => x.id === f.id ? payload : x) : [...p, payload])
    closeModal()
    showToast(f.id ? 'Batch Updated' : 'Batch Created', payload.name)
  }
  function saveResource(f) {
    const payload = {
      id: f.id || Date.now(),
      name: f.name.trim(),
      prog: f.prog,
      type: f.type,
      by: f.by || 'You',
      date: f.date || 'Today',
      views: Number(f.views) || 0,
    }
    setResources(p => f.id ? p.map(x => x.id === f.id ? payload : x) : [...p, payload])
    closeModal()
    showToast(f.id ? 'Resource Updated' : 'Resource Added', payload.name)
  }
  function saveAssessment(f) {
    const score = parseInt(f.score) || 0
    const pass  = score >= 75
    const payload = {
      id: f.id || Date.now(),
      trainee: f.trainee,
      prog: f.prog,
      score,
      pass,
      date: f.date || 'Apr 13, 2026',
      attempt: parseInt(f.attempt, 10) || 1,
    }
    setAssessments(p => f.id ? p.map(x => x.id === f.id ? payload : x) : [...p, payload])
    closeModal()
    showToast('Assessment Saved', `Score: ${score}% — ${pass ? 'PASS' : 'FAIL'}`)
  }
  function saveCert(f) {
    const payload = {
      id: f.id || Date.now(),
      trainee: f.trainee,
      cert: f.cert,
      issued: f.issued || '—',
      expiry: f.expiry || '—',
      st: f.st,
      doc: f.doc || '—',
    }
    setCerts(p => f.id ? p.map(x => (x.id || `${x.trainee}-${x.cert}`) === (f.id || `${f.trainee}-${f.cert}`) ? payload : x) : [...p, payload])
    closeModal()
    showToast(f.id ? 'Certificate Updated' : 'Certificate Added', payload.cert)
  }
  function saveTrainee(f) {
    const payload = {
      id: f.id || Date.now(),
      name: f.name,
      dept: f.dept,
      role: f.role,
      email: f.email,
      prog: Array.isArray(f.prog) ? f.prog : String(f.prog || '').split(',').map(x => x.trim()).filter(Boolean),
      att: Number(f.att) || 0,
      certs: Number(f.certs) || 0,
    }
    setTrainees(p => f.id ? p.map(x => x.id === f.id || x.name === f.name ? payload : x) : [...p, payload])
    closeModal()
    showToast(f.id ? 'Trainee Updated' : 'Trainee Enrolled', payload.name)
  }
  function addFeedback(f) {
    setFeedback(p => [...p, { trainer:'James O.', trainee:'You', session:'Equipment Operation', trainerRating:f.trainerRating, contentRating:f.contentRating, venueRating:f.venueRating, comment:f.comment }])
    closeModal()
    showToast('Feedback Submitted', 'Thank you for your feedback!')
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const shared = { sessions, setSessions, batches, setBatches, attendance, setAttendance, resources, setResources, assessments, setAssessments, certs, setCerts, feedback, setFeedback, trainees, setTrainees, notifs, setNotifs, canEdit, canApprove, isAdmin, isHead, isMgmt, isUser, isTrainee, isTrainer, showToast, setModal }

  return (
    <div style={{ fontFamily:'inherit', color:C.t1 }}>
      {/* Sub-tab bar + bell */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${C.border}`, marginBottom:22, flexWrap:'wrap', gap:4 }}>
        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
          {TABS.map(t => {
            const active = t.id === activeTab
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding:'10px 14px', fontSize:12, fontWeight: active ? 700 : 600, cursor:'pointer', border:'none', background:'transparent', color: active ? 'var(--purple)' : C.t3, borderBottom: active ? '2px solid var(--purple)' : '2px solid transparent', transition:'all .15s', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, marginBottom:-1 }}>
                {t.label}
              </button>
            )
          })}
        </div>
        <button onClick={() => setNotifOpen(true)} style={{ position:'relative', width:36, height:36, borderRadius:8, background:'rgba(var(--purple-rgb),.1)', border:`1px solid rgba(var(--purple-rgb),.25)`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:17, flexShrink:0, marginBottom:4 }}>
          🔔
          {unreadCount > 0 && <span style={{ position:'absolute', top:-5, right:-5, width:18, height:18, borderRadius:'50%', background:C.red, color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #13131f' }}>{unreadCount}</span>}
        </button>
      </div>

      {activeTab === 'kpi'         && <TabKPI         {...shared} />}
      {activeTab === 'calendar'    && <TabCalendar     {...shared} onShowSession={s => { setSessDet(s); setModal({ type:'sessDetail', data:null }) }} />}
      {activeTab === 'batches'     && <TabBatches      {...shared} />}
      {activeTab === 'attendance'  && <TabAttendance   {...shared} onOpenAtt={() => setModal({ type:'att', data:null })} />}
      {activeTab === 'resources'   && <TabResources    {...shared} />}
      {activeTab === 'assessments' && <TabAssessments  {...shared} onOpenAdd={() => setModal({ type:'assess', data:null })} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />}
      {activeTab === 'certs'       && <TabCerts        {...shared} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />}
      {activeTab === 'feedback'    && <TabFeedback     {...shared} onOpenFeedback={() => setModal({ type:'feedback', data:null })} />}
      {activeTab === 'analytics'   && <TabAnalytics    {...shared} />}
      {activeTab === 'trainees'    && <TabTrainees     {...shared} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />}
      {activeTab === 'skillgap'    && <TabSkillGap     {...shared} />}

      {modal.type === 'session'   && <ModalSession    initial={modal.data} onClose={closeModal} onSave={saveSession} />}
      {modal.type === 'batch'     && <ModalBatch      initial={modal.data} onClose={closeModal} onSave={saveBatch} />}
      {modal.type === 'resource'  && <ModalResource   initial={modal.data} onClose={closeModal} onSave={saveResource} />}
      {modal.type === 'att'       && <ModalAttendance onClose={closeModal} showToast={showToast} onSaveRecord={(r) => setAttendance(p => [r, ...p])} />}
      {modal.type === 'assess'    && <ModalAssessment initial={modal.data} onClose={closeModal} onSave={saveAssessment} />}
      {modal.type === 'cert'      && <ModalCert       initial={modal.data} onClose={closeModal} onSave={saveCert} />}
      {modal.type === 'trainee'   && <ModalTrainee    initial={modal.data} onClose={closeModal} onSave={saveTrainee} />}
      {modal.type === 'feedback'  && <ModalFeedback   onClose={closeModal} onAdd={addFeedback} />}
      {modal.type === 'profile'   && profName && <ModalProfile name={profName} trainees={trainees} assessments={assessments} certs={certs} canEdit={canEdit} showToast={showToast} onClose={closeModal} />}
      {modal.type === 'sessDetail'&& sessDet  && <ModalSessionDetail sess={sessDet} onClose={closeModal} onMarkAtt={() => { setModal({ type:'att', data:null }) }} />}

      {notifOpen && <NotifPanel notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />}
      <Toast t={toast} />
    </div>
  )
}
