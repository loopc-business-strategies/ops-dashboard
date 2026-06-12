// FILE: src/components/tabs/OperationsTab.jsx
// Operations & Logistics — 11 sub-tabs, role-based access, full feature set

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import erpAPI from '../../api/erp'
import projectsAPI from '../../api/projects'
import authAPI from '../../api/auth'
import hrAPI from '../../api/hr'
import {
  listOperationsLegalDocuments,
  listOperationsLegalFolders,
  createOperationsLegalFolder,
  deleteOperationsLegalFolder,
  uploadOperationsLegalDocument,
  deleteOperationsLegalDocument,
  fetchOperationsLegalDocumentBlob,
  normalizeLegalDocumentId,
} from '../../api/operationsLegalDocuments'
import { ErpSubTabButton, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'
import AccountCombobox from '../AccountCombobox'

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
  pri:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:'var(--grad-brand)', color:'#fff', boxShadow:'0 4px 15px rgba(var(--purple-rgb),.35)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sec:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'var(--purple)', border:'1px solid var(--purple)', whiteSpace:'nowrap', fontFamily:'inherit' },
  ghost: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'#475569', border:`1px solid rgba(var(--purple-rgb),0.15)`, whiteSpace:'nowrap', fontFamily:'inherit' },
  warn:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(255,112,67,.15)', color:'#9a3412', border:'1px solid rgba(255,112,67,.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  succ:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(0,200,150,.15)', color:'#065f46', border:'1px solid rgba(0,200,150,.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sm:    { padding:'5px 11px', fontSize:11 },
}

function getOpsTabs(t) {
  return [
    { id:'kpi',       label:`📊 ${t('kpiOverview')}` },
    { id:'checklist', label:`✅ ${t('readiness')}` },
    { id:'supply',    label:`🏭 ${t('supplyChain')}` },
    { id:'gold',      label:`🥇 ${t('goldSourcing')}` },
    { id:'routes',    label:`🚛 ${t('transport')}` },
    { id:'security',  label:`🔒 ${t('security')}` },
    { id:'vendors',   label:`📄 ${t('contracts')}` },
    { id:'inventory', label:`📦 ${t('inventory')}` },
    { id:'legal-docs', label:`📑 ${t('opsLegalDocuments')}` },
    { id:'map',       label:`🗺️ ${t('liveMap')}` },
    { id:'analytics', label:`📈 ${t('analytics')}` },
    { id:'projects',     label:`📋 ${t('opsProjectsNav')}` },
  ]
}

// ─── Seed data ──────────────────────────────────────────────────────────────────
const INIT_SUPPLIERS = [
  { id:1, name:'SinoTech Ltd',    cat:'Machinery',   od:'Mar 12, 2025', ed:'Apr 20, 2025', ad:'Apr 25, 2025', qty:'3 units', qr:'3 units', pay:'Fully Paid',   qc:'Passed',  st:'Completed',       notes:'Crusher delivered on time' },
  { id:2, name:'KazMach Co',      cat:'Machinery',   od:'Apr 5, 2025',  ed:'Apr 30, 2025', ad:'—',            qty:'1 unit',  qr:'0',       pay:'Advance Paid', qc:'Pending', st:'Pending External',notes:'Conveyor belt in customs' },
  { id:3, name:'EuroEquip GmbH',  cat:'Machinery',   od:'—',            ed:'Jun 15, 2025', ad:'—',            qty:'1 unit',  qr:'0',       pay:'Not Paid',     qc:'Pending', st:'Not Started',     notes:'Refinery pump pending' },
  { id:4, name:'ChemEx Corp',     cat:'Chemicals',   od:'Apr 10, 2025', ed:'Apr 28, 2025', ad:'—',            qty:'500 kg',  qr:'0',       pay:'Advance Paid', qc:'Pending', st:'In Progress',     notes:'Reagents in transit' },
  { id:5, name:'LocalSupply KZ',  cat:'Consumables', od:'Apr 1, 2025',  ed:'Apr 10, 2025', ad:'Apr 9, 2025',  qty:'Bulk',    qr:'Bulk',    pay:'Fully Paid',   qc:'Passed',  st:'Completed',       notes:'Site consumables delivered' },
]

const INIT_GOLD = [
  { id:1, code:'GS-001', name:'Altyn Partners (Confidential)',      vol:120, actual:96,  stage:'Contract Signed',   cst:'Active',    comp:'Yes', officer:'Omar K.',  region:'East KZ',    risk:'Low',    lastAct:'Apr 10, 2025', nextAction:'Quarterly review call Apr 20' },
  { id:2, code:'GS-002', name:'Northern Highlands Collective',      vol:80,  actual:52,  stage:'Final Negotiation', cst:'Pending',   comp:'No',  officer:'Omar K.',  region:'North KZ',   risk:'Medium', lastAct:'Apr 5, 2025',  nextAction:'Send contract draft by Apr 18' },
  { id:3, code:'GS-003', name:'KazGold Artisanal Network',          vol:50,  actual:18,  stage:'MoU Stage',         cst:'Draft',     comp:'No',  officer:'Aidar B.', region:'Central KZ', risk:'Medium', lastAct:'Mar 28, 2025', nextAction:'MoU signing meeting Apr 22' },
  { id:4, code:'GS-004', name:'CrossBorder Commodities',            vol:0,   actual:0,   stage:'On Hold',           cst:'Suspended', comp:'No',  officer:'—',        region:'South KZ',   risk:'High',   lastAct:'Feb 15, 2025', nextAction:'Compliance review required' },
]

const INIT_ROUTES = [
  { id:1, name:'Route KAZ-1 (Primary)',   origin:'Almaty',           dest:'Site Alpha',             carrier:'KazTrans LLC',    mode:'Road', eta:'6 hrs',  st:'Active',    risk:'Low',    lastInc:'None',      insurance:'Active', gps:'Active',   checkpoints:'4/4', notes:'Armed escort after km 240' },
  { id:2, name:'Route KAZ-2 (Alternate)', origin:'Shymkent',         dest:'Site Alpha',             carrier:'SteppeLogistics', mode:'Road', eta:'9 hrs',  st:'On Hold',   risk:'Medium', lastInc:'Mar 28',    insurance:'Active', gps:'Inactive', checkpoints:'2/4', notes:'Security clearance review' },
  { id:3, name:'Route AIR-1',             origin:'Almaty Airport',   dest:'Site Airstrip',          carrier:'KazAir Cargo',    mode:'Air',  eta:'45 min', st:'Active',    risk:'Low',    lastInc:'None',      insurance:'Active', gps:'Active',   checkpoints:'2/2', notes:'High-value shipments only' },
  { id:4, name:'Route RAIL-1',            origin:'Astana Rail Hub',  dest:'Site Rail Siding',       carrier:'KTZ Freight',     mode:'Rail', eta:'18 hrs', st:'Suspended', risk:'High',   lastInc:'Apr 2',     insurance:'Active', gps:'Inactive', checkpoints:'1/5', notes:'Suspended — security review' },
]

const INIT_SEC_VENDORS = [
  { id:1, vendor:'SecureForce KZ', proto:'Approved',       escort:'Yes',     lastRev:'Apr 5, 2025',  nextRev:'Jul 5, 2025',  incidents:2, threat:'Medium', route:'KAZ-1, KAZ-2' },
  { id:2, vendor:'AlphaGuard Ltd', proto:'Pending Review', escort:'Pending', lastRev:'Mar 15, 2025', nextRev:'May 15, 2025', incidents:0, threat:'Low',    route:'AIR-1' },
]

const INIT_INCIDENTS = [
  { id:'INC-003', date:'Apr 2, 2025',  route:'Route RAIL-1', vendor:'Internal',        type:'Route Breach',          sev:'High',   st:'Under Investigation', res:'Investigation ongoing' },
  { id:'INC-002', date:'Mar 28, 2025', route:'Route KAZ-2',  vendor:'SecureForce KZ',  type:'Escort Delay',          sev:'Medium', st:'Resolved',            res:'Escort breakdown resolved. Protocol updated.' },
  { id:'INC-001', date:'Mar 15, 2025', route:'Route KAZ-1',  vendor:'Internal',        type:'Documentation Issue',   sev:'Low',    st:'Resolved',            res:'Customs paperwork corrected within 24hrs' },
]

const INIT_VENDORS = [
  { id:1, name:'SecureForce KZ',    svc:'Armed Security',    val:'$180,000', signed:'Yes',     exp:'Dec 31, 2025', terms:'Monthly',       mgr:'Omar K.', rating:5, renewal:'Active',             days:261 },
  { id:2, name:'KazTrans LLC',      svc:'Road Freight',      val:'$95,000',  signed:'Yes',     exp:'Sep 30, 2025', terms:'Per Shipment',  mgr:'Bilal R.',rating:4, renewal:'Renewal Due',        days:169 },
  { id:3, name:'ChemEx Corp',       svc:'Chemical Supply',   val:'$42,000',  signed:'Yes',     exp:'Oct 15, 2025', terms:'Net 30',        mgr:'Omar K.', rating:3, renewal:'Active',             days:184 },
  { id:4, name:'SteppeLogistics',   svc:'Alternate Freight', val:'$60,000',  signed:'No',      exp:'—',            terms:'TBD',           mgr:'Bilal R.',rating:2, renewal:'Under Negotiation',  days:null },
  { id:5, name:'AlphaGuard Ltd',    svc:'Security Backup',   val:'$75,000',  signed:'Pending', exp:'Nov 1, 2025',  terms:'Monthly',       mgr:'Omar K.', rating:3, renewal:'Active',             days:201 },
  { id:6, name:'KAZ Equipment Svc', svc:'Maintenance',       val:'$28,000',  signed:'Yes',     exp:'Aug 1, 2025',  terms:'Quarterly',     mgr:'Bilal R.',rating:4, renewal:'Renewal Due',        days:109 },
]

const INIT_INVENTORY = [
  { id:'INV-001', item:'Drive Belt (Heavy)',      stock:2,   min:3,   sup:'KAZ Equipment Svc', last:'Apr 13, 2025', st:'Critical' },
  { id:'INV-002', item:'Filter Kit (Industrial)', stock:8,   min:5,   sup:'ChemEx Corp',        last:'Apr 10, 2025', st:'Sufficient' },
  { id:'INV-003', item:'Spindle Bearing Set',     stock:1,   min:2,   sup:'EuroEquip GmbH',     last:'Apr 3, 2025',  st:'Low Stock' },
  { id:'INV-004', item:'Lubricant Oil (5L)',       stock:12,  min:4,   sup:'LocalSupply KZ',     last:'Apr 12, 2025', st:'Sufficient' },
  { id:'INV-005', item:'Processing Reagent',       stock:180, min:200, sup:'ChemEx Corp',        last:'Apr 8, 2025',  st:'Low Stock' },
  { id:'INV-006', item:'Safety Equipment Kit',     stock:0,   min:5,   sup:'LocalSupply KZ',     last:'Mar 20, 2025', st:'Critical' },
]

const INIT_CHECKLIST = [
  { item:'Site Access Roads Secured',           assign:'Ahmad Y.',  st:'Done',        due:'Apr 5',  by:'Ahmad Y.',  ts:'Apr 5 09:00' },
  { item:'Machinery Procurement Confirmed',     assign:'Omar K.',   st:'Done',        due:'Apr 8',  by:'Omar K.',   ts:'Apr 8 11:30' },
  { item:'Security Vendor Contracts Signed',    assign:'Omar K.',   st:'Done',        due:'Apr 10', by:'Omar K.',   ts:'Apr 10 14:00' },
  { item:'Customs Clearance — All Equipment',   assign:'Bilal R.',  st:'In Progress', due:'Apr 20', by:'—',         ts:'—' },
  { item:'Route KAZ-1 Safety Audit',            assign:'Ahmad Y.',  st:'Done',        due:'Apr 7',  by:'Ahmad Y.',  ts:'Apr 7 16:00' },
  { item:'Inventory Minimum Levels Met',        assign:'Bilal R.',  st:'Blocked',     due:'Apr 16', by:'—',         ts:'—' },
  { item:'Gold Sourcing Channel Compliance',    assign:'Omar K.',   st:'In Progress', due:'Apr 22', by:'—',         ts:'—' },
  { item:'Vendor Payment Schedules Confirmed',  assign:'Omar F.',   st:'Done',        due:'Apr 12', by:'Omar F.',   ts:'Apr 12 10:00' },
  { item:'Emergency Response Protocol Updated', assign:'Ahmad Y.',  st:'In Progress', due:'Apr 25', by:'—',         ts:'—' },
  { item:'Staff Safety Induction Completed',    assign:'Fatima N.', st:'Done',        due:'Apr 10', by:'Fatima N.', ts:'Apr 10 09:00' },
  { item:'Insurance Certificates Renewed',      assign:'Omar F.',   st:'Done',        due:'Apr 15', by:'Omar F.',   ts:'Apr 14 15:30' },
]

const INIT_NOTIFS = [
  { id:'ON1', lv:'crit', read:false, title:'🔴 Contract Expiring in 169 Days — KazTrans LLC',      desc:'KazTrans LLC contract expires Sep 30. Renewal process should start now.',                           time:'Today' },
  { id:'ON2', lv:'high', read:false, title:'🟠 Security Review Overdue — Route RAIL-1',            desc:'Route RAIL-1 suspended. Security review was due Apr 10 and has not been completed.',                time:'2 hrs ago' },
  { id:'ON3', lv:'crit', read:false, title:'🔴 Incident Reported — Route RAIL-1',                  desc:'Route breach INC-003 reported Apr 2. Investigation ongoing. Escalation required.',                  time:'2 days ago' },
  { id:'ON4', lv:'med',  read:false, title:'🟡 Delivery Overdue — KazMach Conveyor Belt',          desc:'KazMach Co conveyor belt expected Apr 30 but currently held at Almaty customs. Action needed.',     time:'Today' },
  { id:'ON5', lv:'med',  read:false, title:'🟡 Gold Channel Compliance Issue — GS-002 & GS-003',  desc:'Two gold sourcing channels have incomplete compliance documentation. Review by Apr 22.',              time:'Yesterday' },
  { id:'ON6', lv:'suc',  read:true,  title:'🟢 New Delivery Confirmed — SinoTech Ltd',             desc:'Crusher Unit A from SinoTech Ltd delivered and accepted. Quality check passed.',                    time:'Apr 10' },
  { id:'ON7', lv:'high', read:true,  title:'🟠 GPS Inactive on Route KAZ-2',                       desc:'GPS tracking is not active on Route KAZ-2. Security risk. Update required.',                        time:'Apr 8' },
  { id:'ON8', lv:'crit', read:false, title:'🔴 Safety Equipment Kit — Stock Zero',                 desc:'Safety Equipment Kit has zero stock. Minimum is 5 units. Immediate restock required.',              time:'Today' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────
function pct(v, t) { return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100))) }
function stars(n) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < n ? C.gold : C.t4, fontSize:14 }}>★</span>
  ))
}

const BADGE_MAP = {
  'Completed':             { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Active':                { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Approved':              { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Passed':                { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Sufficient':            { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Fully Paid':            { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Yes':                   { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Resolved':              { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Done':                  { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Contract Signed':       { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'In Progress':           { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Under review':        { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Advance Paid':          { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Pending':               { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Pending Review':        { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Low Stock':             { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'On Hold':               { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Renewal Due':           { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Under Negotiation':     { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Under Investigation':   { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Final Negotiation':     { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'MoU Stage':             { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Pending External':      { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Not Started':           { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'No':                    { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Suspended':             { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Not Paid':              { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Inactive':              { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'To Do':                 { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Draft':                 { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Critical':              { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Blocked':               { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Overdue':               { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'High':                  { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Medium':                { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Low':                   { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Road':                  { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Air':                   { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Rail':                  { bg:'rgba(245,158,11,.12)',  color:'#f59e0b', b:'rgba(245,158,11,.3)' },
}
function Badge({ s }) {
  const cf = BADGE_MAP[s] || { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:cf.bg, color:cf.color, border:`1px solid ${cf.b}`, whiteSpace:'nowrap' }}>{s}</span>
}

function ProgBar({ pct: p, color, height=7 }) {
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
      <ProgBar pct={p} color={color} />
      <div style={{ width:38, textAlign:'right', fontWeight:700, color:C.t1, fontSize:12 }}>{p}%</div>
    </div>
  )
}

function StatCard({ label, value, sub, dot }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:C.t1, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.t3, marginTop:7, display:'flex', alignItems:'center', gap:5 }}>
        {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }} />}
        {sub}
      </div>}
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
function CardTitle({ children, right }) {
  return <div style={{ fontSize:13, fontWeight:800, color:C.t1, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>{children}{right && <div>{right}</div>}</div>
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

const TH = { fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,0.02)', whiteSpace:'nowrap' }
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

function Restrict({ text, amber }) {
  const col = amber ? C.gold : C.red
  return (
    <div style={{ background:`${col}10`, border:`1px solid ${col}25`, borderRadius:10, padding:'13px 16px', fontSize:13, color:col, display:'flex', alignItems:'center', gap:10, lineHeight:1.5 }}>
      <span style={{ fontSize:20 }}>🔒</span>{text}
    </div>
  )
}

// ─── Modal base ─────────────────────────────────────────────────────────────────
const IS = { width:'100%', background:'rgba(255,255,255,.05)', border:'1.5px solid rgba(var(--purple-rgb),.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:C.t1, fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' }
function ML({ children }) { return <div style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{children}</div> }
function MI(props) { return <input {...props} style={IS} /> }
function MS({ children, ...p }) { return <select {...p} style={{ ...IS, appearance:'auto' }}>{children}</select> }
function MTA(props) { return <textarea {...props} style={{ ...IS, resize:'vertical', minHeight:65 }} /> }

function Modal({ title, sub, onClose, onSave, saveLabel = 'Save', children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#ffffff', border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width:580, maxWidth:'94vw', maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:C.grad, borderRadius:'14px 0 0 14px' }} />
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        <h3 style={{ fontSize:17, fontWeight:800, color:C.t1, marginBottom:4 }}>{title}</h3>
        <div style={{ fontSize:12, color:C.t3, marginBottom:18 }}>{sub}</div>
        {children}
        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Cancel</button>
          <button onClick={onSave} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────────
function Toast({ t }) {
  if (!t) return null
  return (
    <div style={{ position:'fixed', bottom:22, right:22, minWidth:260, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid var(--purple)`, borderRadius:10, padding:'13px 18px', zIndex:9999, boxShadow:'0 8px 30px rgba(var(--purple-rgb),.22)' }}>
      <style>{`@keyframes toastIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ fontWeight:700, color:C.t1, marginBottom:3, animation:'toastIn .3s ease' }}>{t.title}</div>
      <div style={{ fontSize:12, color:C.t3 }}>{t.msg}</div>
    </div>
  )
}

const LEGAL_DOC_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.zip',
].join(',')

function formatLegalDocSize(bytes) {
  const size = Number(bytes || 0)
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** Avoid showing JavaScript NaN / empty garbage for uploader name. */
function formatLegalDocUploader(name) {
  if (name == null || name === '') return '—'
  const s = String(name).trim()
  if (!s || s === 'NaN' || s === 'undefined' || s === 'null') return '—'
  return s
}

/** Returns preview UI kind. `.docx` uses client-side render (docx-preview); legacy `.doc` stays download-only. */
function legalDocPreviewKind(mime, fileName = '') {
  const m = String(mime || '').toLowerCase()
  const base = String(fileName || '').trim().toLowerCase()
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : ''
  if (m === 'application/pdf') return 'iframe'
  if (m.startsWith('image/')) return 'img'
  if (m === 'text/plain' || m === 'text/csv') return 'text'
  const docxMime = m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const looksDocx = ext === 'docx' || docxMime || (m === 'application/octet-stream' && ext === 'docx')
  if (looksDocx) return 'docx'
  return 'none'
}

function LegalDocxPreviewBody({ arrayBuffer, showToast }) {
  const hostRef = useRef(null)
  const toastRef = useRef(showToast)
  toastRef.current = showToast
  useEffect(() => {
    const el = hostRef.current
    if (!el || !arrayBuffer) return undefined
    let cancelled = false
    el.innerHTML = ''
    ;(async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled) return
        await renderAsync(arrayBuffer, el, undefined, { inWrapper: true })
      } catch (e) {
        if (!cancelled) {
          el.innerHTML = ''
          const p = document.createElement('p')
          p.style.cssText = 'padding:16px;color:#b91c1c;font-size:13px;line-height:1.5'
          p.textContent = e?.message || 'Could not render Word preview.'
          el.appendChild(p)
          toastRef.current?.('Preview', e?.message || 'Word preview failed.')
        }
      }
    })()
    return () => {
      cancelled = true
      if (el) el.innerHTML = ''
    }
  }, [arrayBuffer])
  return (
    <div
      ref={hostRef}
      className="legal-docx-preview-host"
      style={{ padding: '12px 16px', minHeight: 280, fontSize: 12, color: C.t2 }}
    />
  )
}

function LegalDocumentsCard({ canEdit, showToast }) {
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const selectAllCheckboxRef = useRef(null)

  /** 'all' | 'unfiled' | folder Mongo id */
  const [folderScope, setFolderScope] = useState('all')
  const [folders, setFolders] = useState([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  /** Right-click menu on a folder chip: `{ folder, x, y }` */
  const [folderContextMenu, setFolderContextMenu] = useState(null)
  const legalFolderContextFileRef = useRef(null)
  const legalFolderContextTargetRef = useRef(null)
  /** Normalized document _id strings for bulk select / share / download */
  const [selectedLegalDocIds, setSelectedLegalDocIds] = useState([])

  const visibleDocIds = useMemo(
    () => documents.map((d) => normalizeLegalDocumentId(d._id)).filter(Boolean),
    [documents],
  )
  const selectedInViewCount = useMemo(
    () => visibleDocIds.filter((id) => selectedLegalDocIds.includes(id)).length,
    [visibleDocIds, selectedLegalDocIds],
  )
  const allVisibleSelected = visibleDocIds.length > 0 && selectedInViewCount === visibleDocIds.length

  useEffect(() => {
    const el = selectAllCheckboxRef.current
    if (el) el.indeterminate = selectedInViewCount > 0 && !allVisibleSelected
  }, [selectedInViewCount, allVisibleSelected])

  useEffect(() => {
    setSelectedLegalDocIds([])
  }, [folderScope])

  useEffect(() => {
    const valid = new Set(visibleDocIds)
    setSelectedLegalDocIds((prev) => prev.filter((id) => valid.has(id)))
  }, [visibleDocIds])

  useEffect(() => {
    if (!folderContextMenu) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setFolderContextMenu(null) }
    const onDown = (e) => {
      const t = e.target
      if (t && typeof t.closest === 'function' && t.closest('[data-legal-folder-context-menu]')) return
      setFolderContextMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown, true)
    }
  }, [folderContextMenu])

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true)
    try {
      const data = await listOperationsLegalFolders()
      setFolders(Array.isArray(data.folders) ? data.folders : [])
    } catch {
      setFolders([])
    } finally {
      setFoldersLoading(false)
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const opts = {}
      if (folderScope === 'unfiled') opts.folderId = 'unfiled'
      else if (folderScope !== 'all') opts.folderId = folderScope
      const data = await listOperationsLegalDocuments(opts)
      const rows = Array.isArray(data.documents) ? data.documents : []
      setDocuments(
        rows.map((row) => {
          const nid = normalizeLegalDocumentId(row._id)
          return nid ? { ...row, _id: nid } : row
        }),
      )
    } catch {
      setDocuments([])
      showToastRef.current('Legal documents', 'Could not load document list.')
    } finally {
      setLoading(false)
    }
  }, [folderScope])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadDocuments() }, [loadDocuments])

  const closePreview = useCallback(() => {
    if (preview?.objectUrl) {
      try { URL.revokeObjectURL(preview.objectUrl) } catch { /* ignore */ }
    }
    setPreview(null)
  }, [preview])

  const openPreview = useCallback(async (doc) => {
    const id = normalizeLegalDocumentId(doc?._id)
    const kind = legalDocPreviewKind(doc.mimeType, doc.originalName)
    if (!id) {
      showToastRef.current('Preview', 'Missing document id.')
      return
    }
    if (kind === 'none') {
      setPreview({
        objectUrl: null,
        name: doc.originalName,
        kind: 'office',
        docId: id,
      })
      return
    }
    try {
      const blob = await fetchOperationsLegalDocumentBlob(id, { preview: true })
      if (kind === 'text') {
        const text = await blob.text()
        setPreview({ objectUrl: null, name: doc.originalName, kind: 'text', text })
        return
      }
      if (kind === 'docx') {
        const docxArrayBuffer = await blob.arrayBuffer()
        setPreview({
          objectUrl: null,
          name: doc.originalName,
          kind: 'docx',
          docxArrayBuffer,
          docId: id,
        })
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      if (kind === 'iframe' || kind === 'img') {
        setPreview({ objectUrl, name: doc.originalName, kind, docId: id })
      } else {
        URL.revokeObjectURL(objectUrl)
        setPreview({
          objectUrl: null,
          name: doc.originalName,
          kind: 'office',
          docId: id,
        })
      }
    } catch (err) {
      showToastRef.current('Preview', err?.message || 'Could not load file.')
    }
  }, [])

  const downloadToDisk = useCallback(async (doc) => {
    const id = normalizeLegalDocumentId(doc?._id || doc?.docId)
    const filename = doc?.originalName || doc?.name || 'document'
    if (!id) {
      showToastRef.current('Download', 'Invalid document.')
      return
    }
    try {
      const blob = await fetchOperationsLegalDocumentBlob(id, { download: true })
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.rel = 'noreferrer'
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      showToastRef.current('Download', err?.message || 'Could not download file.')
    }
  }, [])

  const getSelectedLegalDocs = useCallback(() => {
    const want = new Set(selectedLegalDocIds)
    return documents.filter((d) => want.has(normalizeLegalDocumentId(d._id)))
  }, [documents, selectedLegalDocIds])

  const shareLegalDocRows = useCallback(async (rows, contextSuffix) => {
    if (!rows.length) {
      showToastRef.current(
        'Share',
        contextSuffix ? `No documents ${contextSuffix}.` : 'Select one or more documents.',
      )
      return
    }
    const names = rows.map((r) => r.originalName || 'document').join('\n')
    try {
      const files = []
      for (const doc of rows) {
        const id = normalizeLegalDocumentId(doc._id)
        const blob = await fetchOperationsLegalDocumentBlob(id, { download: true })
        const name = doc.originalName || 'document'
        const type = doc.mimeType || blob.type || 'application/octet-stream'
        files.push(new File([blob], name, { type }))
      }
      const textIntro = contextSuffix
        ? `${files.length} file(s) ${contextSuffix}`
        : `${files.length} file(s) from Legal Documents`
      const sharePayload = {
        title: 'Operations — Legal documents',
        text: textIntro,
        files,
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
          await navigator.share(sharePayload)
        } else {
          await navigator.share({
            title: sharePayload.title,
            text: `${sharePayload.text}\n\n${names}`,
          })
        }
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(names)
        showToastRef.current(
          'Share',
          'This browser does not support sending files from the page. File names were copied — use Download selected to save copies, or paste the list into email or chat.',
        )
        return
      }
      showToastRef.current('Share', 'Sharing is not supported here. Use Download selected.')
    } catch (e) {
      if (e?.name === 'AbortError') return
      showToastRef.current('Share failed', e?.message || 'Could not share.')
    }
  }, [])

  const shareSelectedLegalDocs = useCallback(async () => {
    await shareLegalDocRows(getSelectedLegalDocs(), '')
  }, [getSelectedLegalDocs, shareLegalDocRows])

  const shareFolderDocuments = useCallback(async (folder) => {
    const fid = normalizeLegalDocumentId(folder._id)
    if (!fid) {
      showToastRef.current('Share', 'Invalid folder.')
      return
    }
    setFolderContextMenu(null)
    try {
      const data = await listOperationsLegalDocuments({ folderId: fid })
      const rows = (Array.isArray(data.documents) ? data.documents : []).map((row) => {
        const nid = normalizeLegalDocumentId(row._id)
        return nid ? { ...row, _id: nid } : row
      }).filter((row) => normalizeLegalDocumentId(row._id))
      await shareLegalDocRows(rows, `from folder "${folder.name}"`)
    } catch (e) {
      showToastRef.current('Share', e?.message || 'Could not load folder documents.')
    }
  }, [shareLegalDocRows])

  const downloadSelectedLegalDocs = useCallback(async () => {
    const rows = getSelectedLegalDocs()
    if (!rows.length) {
      showToastRef.current('Download', 'Select one or more documents.')
      return
    }
    for (let i = 0; i < rows.length; i++) {
      await downloadToDisk(rows[i])
      if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 280))
    }
    showToastRef.current('Download', `${rows.length} download(s) started.`)
  }, [getSelectedLegalDocs, downloadToDisk])

  const uploadTargetFolderId = folderScope !== 'all' && folderScope !== 'unfiled' ? folderScope : null

  const uploadLegalDocumentFile = useCallback(async (file, overrideFolderId) => {
    if (!file) return
    const effectiveFolderId = overrideFolderId !== undefined ? overrideFolderId : uploadTargetFolderId
    const folderParam = effectiveFolderId && /^[a-f\d]{24}$/i.test(String(effectiveFolderId))
      ? String(effectiveFolderId)
      : undefined
    setUploading(true)
    try {
      const data = await uploadOperationsLegalDocument(file, { folderId: folderParam })
      if (data.success && data.document) {
        const nid = normalizeLegalDocumentId(data.document._id)
        const d = nid ? { ...data.document, _id: nid } : data.document
        if (!nid) {
          await loadDocuments()
        } else {
          const inView = folderScope === 'all'
            || (folderScope === 'unfiled' && !d.folderId)
            || (String(folderScope) === String(d.folderId))
          if (inView) setDocuments((prev) => [d, ...prev])
          else await loadDocuments()
        }
        showToastRef.current('Uploaded', file.name)
      } else {
        showToastRef.current('Upload failed', data.message || 'Unknown error')
      }
    } catch (err) {
      showToastRef.current('Upload failed', err.response?.data?.message || err.message || 'Unknown error')
    } finally {
      setUploading(false)
    }
  }, [folderScope, loadDocuments, uploadTargetFolderId])

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    await uploadLegalDocumentFile(file)
  }

  const onLegalFolderContextFilePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const fid = legalFolderContextTargetRef.current
    legalFolderContextTargetRef.current = null
    if (!file || !fid) return
    await uploadLegalDocumentFile(file, fid)
  }

  const onDelete = async (doc) => {
    const docId = normalizeLegalDocumentId(doc._id)
    if (!docId) {
      showToastRef.current('Delete', 'This document has no valid id. Try refreshing the list.')
      return
    }
    if (!window.confirm(`Delete “${doc.originalName}”?`)) return
    try {
      await deleteOperationsLegalDocument(docId)
      if (preview && normalizeLegalDocumentId(preview.docId) === docId) {
        closePreview()
      }
      setSelectedLegalDocIds((prev) => prev.filter((id) => id !== docId))
      setDocuments((prev) => prev.filter((d) => normalizeLegalDocumentId(d._id) !== docId))
      showToastRef.current('Deleted', doc.originalName)
    } catch (err) {
      const body = err.response?.data
      const msg = (typeof body?.message === 'string' && body.message.trim())
        || (typeof body === 'string' && body.trim())
        || err.message
        || 'Could not remove document.'
      showToastRef.current('Delete failed', msg)
    }
  }

  const onCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    try {
      const data = await createOperationsLegalFolder(name)
      if (data.success && data.folder) {
        await loadFolders()
        setFolderScope(String(data.folder._id))
        setNewFolderOpen(false)
        setNewFolderName('')
        showToastRef.current('Folder created', name)
      } else {
        showToastRef.current('Folder', data.message || 'Could not create folder.')
      }
    } catch (err) {
      showToastRef.current('Folder', err.response?.data?.message || err.message || 'Could not create folder.')
    } finally {
      setCreatingFolder(false)
    }
  }

  const onDeleteFolder = async (folder) => {
    const fid = normalizeLegalDocumentId(folder._id)
    if (!fid) {
      showToastRef.current('Folder', 'Invalid folder id. Try refreshing.')
      return
    }
    if (!window.confirm(`Delete folder “${folder.name}”? (Must be empty.)`)) return
    try {
      await deleteOperationsLegalFolder(fid)
      await loadFolders()
      if (String(folderScope) === fid) setFolderScope('all')
      showToastRef.current('Folder deleted', folder.name)
    } catch (err) {
      const body = err.response?.data
      const msg = (typeof body?.message === 'string' && body.message.trim())
        || err.message
        || 'Could not delete folder.'
      showToastRef.current('Folder', msg)
    }
  }

  const chip = (active) => ({
    ...(active ? B.pri : B.ghost),
    ...B.sm,
    borderRadius: 999,
    whiteSpace: 'nowrap',
  })

  return (
    <>
      <Card>
        <CardTitle
          right={canEdit ? (
            <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
              <span style={{ ...B.sec, ...B.sm }}>＋ Add document</span>
              <input
                type="file"
                accept={LEGAL_DOC_ACCEPT}
                disabled={uploading}
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
            </label>
          ) : null}
        >
          Legal Documents
        </CardTitle>
        {canEdit && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4, lineHeight: 1.4 }}>
            Select a folder below, then use <strong>Add document</strong> to save the file into that folder.
            Choose <strong>All</strong> or <strong>Unfiled</strong> to upload without a folder.
            {' '}
            <strong>Right-click</strong> a folder name for <strong>New file</strong>, <strong>Share</strong>, or <strong>Delete</strong>.
          </div>
        )}
        {!canEdit && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4, lineHeight: 1.4 }}>
            <strong>Right-click</strong> a folder name to <strong>Share</strong> all documents in that folder.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: `1px solid ${C.border}`,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 11, color: C.t3, fontWeight: 700 }}>Folders</span>
          <button type="button" onClick={() => setFolderScope('all')} style={chip(folderScope === 'all')}>
            All
          </button>
          <button type="button" onClick={() => setFolderScope('unfiled')} style={chip(folderScope === 'unfiled')}>
            Unfiled
          </button>
          {foldersLoading && <span style={{ fontSize: 11, color: C.t3 }}>…</span>}
          {!foldersLoading && folders.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() => setFolderScope(String(f._id))}
              onContextMenu={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                setFolderContextMenu({ folder: f, x: ev.clientX, y: ev.clientY })
              }}
              style={chip(String(folderScope) === String(f._id))}
            >
              {f.name}
            </button>
          ))}
          {canEdit && !newFolderOpen && (
            <button type="button" onClick={() => { setNewFolderOpen(true); setNewFolderName('') }} style={{ ...B.ghost, ...B.sm, borderRadius: 999 }}>
              ＋ New folder
            </button>
          )}
          {canEdit && newFolderOpen && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                disabled={creatingFolder}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  fontSize: 12,
                  minWidth: 140,
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') onCreateFolder() }}
              />
              <button type="button" disabled={creatingFolder} onClick={onCreateFolder} style={{ ...B.pri, ...B.sm }}>
                {creatingFolder ? '…' : 'Create'}
              </button>
              <button
                type="button"
                disabled={creatingFolder}
                onClick={() => { setNewFolderOpen(false); setNewFolderName('') }}
                style={{ ...B.ghost, ...B.sm }}
              >
                Cancel
              </button>
            </span>
          )}
        </div>
        {loading && (
          <div style={{ fontSize: 12, color: C.t3, padding: '8px 0' }}>Loading…</div>
        )}
        {!loading && documents.length === 0 && (
          <div style={{ fontSize: 12, color: C.t3, padding: '12px 0', borderTop: `1px dashed ${C.border}` }}>
            No documents in this view.{canEdit ? ' Use Add document to upload PDF, Word, images, or other supported files.' : ''}
          </div>
        )}
        {!loading && documents.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 12,
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: documents.length ? 'pointer' : 'default',
                  color: C.t2,
                  fontWeight: 700,
                }}
              >
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  disabled={!documents.length}
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLegalDocIds([...visibleDocIds])
                    else setSelectedLegalDocIds([])
                  }}
                  aria-label="Select all documents in this list"
                />
                Select all
              </label>
              <span style={{ color: C.t3 }}>
                {selectedLegalDocIds.length}
                {' '}
                selected
              </span>
              <button
                type="button"
                disabled={!selectedLegalDocIds.length}
                onClick={() => { void shareSelectedLegalDocs() }}
                style={{ ...B.sec, ...B.sm }}
              >
                Share
              </button>
              <button
                type="button"
                disabled={!selectedLegalDocIds.length}
                onClick={() => { void downloadSelectedLegalDocs() }}
                style={{ ...B.ghost, ...B.sm }}
              >
                Download selected
              </button>
              {selectedLegalDocIds.length > 0 && (
                <button type="button" onClick={() => setSelectedLegalDocIds([])} style={{ ...B.ghost, ...B.sm }}>
                  Clear selection
                </button>
              )}
            </div>
            {documents.map((doc, idx) => {
              const rowId = normalizeLegalDocumentId(doc._id)
              const rowChecked = rowId ? selectedLegalDocIds.includes(rowId) : false
              return (
                <div
                  key={doc._id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 0',
                    borderBottom: idx < documents.length - 1 ? `1px solid ${C.border}` : 'none',
                    fontSize: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      cursor: rowId ? 'pointer' : 'default',
                      minWidth: 0,
                      flex: '1 1 160px',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!rowId}
                      checked={rowChecked}
                      onChange={() => {
                        if (!rowId) return
                        setSelectedLegalDocIds((prev) => (
                          prev.includes(rowId) ? prev.filter((x) => x !== rowId) : [...prev, rowId]
                        ))
                      }}
                      style={{ marginTop: 3, flexShrink: 0 }}
                      aria-label={`Select ${doc.originalName || 'document'}`}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: C.t1, wordBreak: 'break-word' }}>{doc.originalName}</span>
                      <div style={{ color: C.t3, marginTop: 4, fontSize: 11 }}>
                        {formatLegalDocSize(doc.size)}
                        {' · '}
                        {formatLegalDocUploader(doc.uploadedByName)}
                        {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleString()}` : ''}
                        {doc.folderId && folderScope === 'all' && (
                          <span>
                            {' · '}
                            Folder: {folders.find((x) => String(x._id) === String(doc.folderId))?.name || '—'}
                          </span>
                        )}
                      </div>
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openPreview(doc)}
                      style={{ ...B.ghost, ...B.sm }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadToDisk(doc)}
                      style={{ ...B.ghost, ...B.sm }}
                    >
                      Download
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => onDelete(doc)} style={{ ...B.warn, ...B.sm }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <input
        ref={legalFolderContextFileRef}
        type="file"
        accept={LEGAL_DOC_ACCEPT}
        style={{ display: 'none' }}
        disabled={uploading}
        onChange={(e) => { void onLegalFolderContextFilePick(e) }}
      />
      {folderContextMenu && (() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 800
        const vh = typeof window !== 'undefined' ? window.innerHeight : 600
        const left = Math.min(Math.max(8, folderContextMenu.x), vw - 176)
        const top = Math.min(Math.max(8, folderContextMenu.y), vh - 140)
        const m = folderContextMenu.folder
        const itemStyle = {
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          color: C.t1,
          borderRadius: 6,
          fontFamily: 'inherit',
          fontWeight: 600,
        }
        return (
          <div
            data-legal-folder-context-menu
            role="menu"
            aria-label={`Folder actions: ${m.name}`}
            style={{
              position: 'fixed',
              left,
              top,
              zIndex: 10050,
              minWidth: 168,
              background: '#fff',
              border: `1px solid ${C.border2}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,.15)',
              padding: 4,
            }}
          >
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                onClick={() => {
                  const fid = normalizeLegalDocumentId(m._id)
                  if (!fid) return
                  setFolderScope(fid)
                  legalFolderContextTargetRef.current = fid
                  setFolderContextMenu(null)
                  legalFolderContextFileRef.current?.click()
                }}
              >
                New file…
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              style={itemStyle}
              onClick={() => { void shareFolderDocuments(m) }}
            >
              Share folder
            </button>
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                style={{ ...itemStyle, color: C.red, fontWeight: 700 }}
                onClick={() => {
                  setFolderContextMenu(null)
                  void onDeleteFolder(m)
                }}
              >
                Delete folder
              </button>
            )}
          </div>
        )
      })()}

      {preview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.65)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(6px)',
          }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) closePreview() }}
          role="presentation"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: `1px solid ${C.border2}`,
              maxWidth: 'min(920px, 96vw)',
              maxHeight: '90vh',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.gbar }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 800, color: C.t1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{preview.name}</div>
              <button type="button" onClick={closePreview} style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
              {preview.kind === 'iframe' && preview.objectUrl && (
                <iframe title={preview.name} src={preview.objectUrl} style={{ width: '100%', height: 'min(72vh, 640px)', border: 'none' }} />
              )}
              {preview.kind === 'img' && preview.objectUrl && (
                <div style={{ padding: 12, textAlign: 'center' }}>
                  <img src={preview.objectUrl} alt={preview.name} style={{ maxWidth: '100%', height: 'auto' }} />
                </div>
              )}
              {preview.kind === 'text' && (
                <pre style={{ margin: 0, padding: 14, fontSize: 12, color: C.t2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>{preview.text}</pre>
              )}
              {preview.kind === 'docx' && preview.docxArrayBuffer && (
                <LegalDocxPreviewBody arrayBuffer={preview.docxArrayBuffer} showToast={showToast} />
              )}
              {preview.kind === 'office' && (
                <div style={{ padding: 24, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 12px' }}>In-browser preview is not available for this file type. Download to open it on your device.</p>
                  <button
                    type="button"
                    style={B.pri}
                    onClick={async () => {
                      await downloadToDisk({ _id: preview.docId, originalName: preview.name })
                      closePreview()
                    }}
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB: Legal Documents ───────────────────────────────────────────────────────
function TabLegalDocuments({ canEdit, showToast }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <LegalDocumentsCard canEdit={canEdit} showToast={showToast} />
    </div>
  )
}

// ─── TAB: KPI Overview ──────────────────────────────────────────────────────────
function TabKPI({ suppliers, gold: _gold, routes, incidents, vendors, inventory, canEdit: _canEdit, isAdmin, isHead, isMgmt }) {
  if (!isAdmin && !isHead && !isMgmt) return <Restrict text="KPI overview is not available to this role. Contact your Operations manager." />
  const done    = suppliers.filter(s => s.st === 'Completed').length
  const active  = routes.filter(r => r.st === 'Active').length
  const expiring= vendors.filter(v => v.days && v.days < 60).length
  const pending = suppliers.filter(s => s.st === 'Pending External' || s.st === 'In Progress').length
  const unresolved = incidents.filter(i => i.st !== 'Resolved').length
  const readiness = Math.round((
    pct(done, suppliers.length) +
    pct(routes.filter(r=>r.st==='Active').length, routes.length) +
    pct(vendors.filter(v=>v.signed==='Yes').length, vendors.length)
  ) / 3)
  const readColor = readiness >= 80 ? C.green : readiness >= 60 ? C.yellow : C.red

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Operations KPI Overview" sub="Real-time operational status — all departments">
        <button style={B.ghost}>⬇ Export</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Operational Readiness" value={<span style={{ color:readColor }}>{readiness}%</span>} sub={<ProgBar pct={readiness} color={C.gbar} />} />
        <StatCard label="Active Suppliers" value={<span style={{ color:C.cyan }}>{suppliers.filter(s=>s.st!=='Not Started').length}</span>} sub={`${suppliers.length} total registered`} dot={C.cyan} />
        <StatCard label="Routes Active / Total" value={<><span style={{ color:C.green }}>{active}</span><span style={{ fontSize:16, color:C.t3 }}> / {routes.length}</span></>} sub={routes.filter(r=>r.st!=='Active').map(r=>r.name.split(' ')[1]).join(', ') + ' on hold'} dot={active >= 3 ? C.green : C.yellow} />
        <StatCard label="Security Incidents" value={<span style={{ color: unresolved > 0 ? C.red : C.green }}>{incidents.length}</span>} sub={`${unresolved} unresolved`} dot={C.red} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Contracts Expiring Soon" value={<span style={{ color: expiring > 0 ? C.orange : C.green }}>{expiring}</span>} sub="Within 60 days" dot={C.orange} />
        <StatCard label="Pending Deliveries" value={<span style={{ color:C.yellow }}>{pending}</span>} sub="Awaiting delivery" dot={C.yellow} />
        {isAdmin || isHead
          ? <StatCard label="Gold Sourced This Month" value={<span style={{ color:C.gold }}>96 kg</span>} sub="Target: 120 kg" dot={C.gold} />
          : <StatCard label="Gold Sourced" value={<span style={{ color:C.t4 }}>••</span>} sub="Restricted" />}
        <StatCard label="Vendor Compliance Rate" value={<span style={{ color:C.green }}>83%</span>} sub="5 of 6 vendors compliant" dot={C.green} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Supply Chain Status by Category</CardTitle>
          {['Machinery','Chemicals','Consumables'].map(cat => {
            const items = suppliers.filter(s => s.cat === cat)
            const d = items.filter(s => s.st === 'Completed').length
            return <ProgRow key={cat} label={`${cat} (${items.length})`} p={pct(d, items.length || 1)} color={C.gbar} />
          })}
        </Card>
        <Card>
          <CardTitle>Route Status Overview</CardTitle>
          {routes.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <div style={{ fontWeight:600, color:C.t1 }}>{r.name.split('(')[0].trim()}</div>
              <div style={{ display:'flex', gap:6 }}><Badge s={r.mode} /><Badge s={r.st} /></div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Inventory Alert Summary</CardTitle>
          {inventory.map(i => (
            <div key={i.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <div style={{ color:C.t2 }}>{i.item}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:700, color: i.stock === 0 ? C.red : i.stock <= i.min ? C.yellow : C.green }}>{i.stock} units</span>
                <Badge s={i.st} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>Vendor Contract Expiry</CardTitle>
          {vendors.filter(v => v.days).sort((a,b) => a.days - b.days).slice(0,5).map(v => {
            const col = v.days < 60 ? C.red : v.days < 120 ? C.yellow : C.green
            return (
              <div key={v.id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:C.t2, fontWeight:600 }}>{v.name}</span>
                  <span style={{ color:col, fontWeight:700 }}>{v.days}d</span>
                </div>
                <ProgBar pct={Math.min(v.days / 365 * 100, 100)} color={col} height={6} />
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Readiness Checklist ───────────────────────────────────────────────────
function TabChecklist({ checklist, setChecklist, canEdit, isExternal, isMgmt, setModal }) {
  if (isExternal || isMgmt) return <Restrict text="Operational Readiness Checklist is restricted to Operations team." />
  const done    = checklist.filter(c => c.st === 'Done').length
  const inprog  = checklist.filter(c => c.st === 'In Progress').length
  const blocked = checklist.filter(c => c.st === 'Blocked').length
  const p = pct(done, checklist.length)
  const readColor = p >= 80 ? C.green : p >= 60 ? C.yellow : C.red

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Operational Readiness Checklist" sub={`${done} of ${checklist.length} items complete — ${p}% ready`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'checklist-add', data:null })}>+ Add Item</button>}
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Overall Readiness" value={<span style={{ color:readColor }}>{p}%</span>} sub={<ProgBar pct={p} color={C.gbar} />} />
        <StatCard label="Completed" value={<span style={{ color:C.green }}>{done}</span>} sub="Items done" dot={C.green} />
        <StatCard label="In Progress" value={<span style={{ color:C.yellow }}>{inprog}</span>} sub="Being worked on" dot={C.yellow} />
        <StatCard label="Blocked" value={<span style={{ color:C.red }}>{blocked}</span>} sub="Needs resolution" dot={C.red} />
      </div>

      <TableWrap>
        <TableHead title="Readiness Sub-Items" subtitle={`${checklist.length} items`} />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead><tr>
              {['Checklist Item','Assigned To','Status','Due Date','Completed By','Timestamp','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {checklist.map((c, i) => {
                const rowBg = c.st === 'Done' ? 'rgba(0,200,150,.04)' : c.st === 'Blocked' ? 'rgba(255,71,87,.04)' : 'rgba(255,214,0,.03)'
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{c.item}</td>
                    <td style={{ ...TD, color:C.t2 }}>{c.assign}</td>
                    <td style={TD}><Badge s={c.st} /></td>
                    <td style={{ ...TD, color:C.t3 }}>{c.due}</td>
                    <td style={{ ...TD, color: c.by === '—' ? C.t4 : C.green }}>{c.by}</td>
                    <td style={{ ...TD, color:C.t4, fontSize:11 }}>{c.ts}</td>
                    <td style={TD}>
                      {canEdit && c.st !== 'Done' && <button onClick={() => {
                        setChecklist(p => p.map((x,j) => j===i ? {...x, st:'Done', by:'You', ts:'Now'} : x))
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>✓ Done</button>}
                      {canEdit && c.st === 'Done' && <button onClick={() => {
                        setChecklist(p => p.map((x,j) => j===i ? {...x, st:'In Progress', by:'—', ts:'—'} : x))
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:C.t3, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Undo</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete this item?')) setChecklist(p => p.filter((_,j) => j!==i)) }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>🗑</button>}
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

// ─── TAB: Supply Chain ──────────────────────────────────────────────────────────
function TabSupply({ suppliers, setSuppliers, canEdit, isExternal, isMgmt, showToast, onOpenAdd, setModal }) {
  const [detail, setDetail] = useState(null)
  if (isExternal || isMgmt) return <Restrict text="Supply Chain data is restricted to Operations team only." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Supply Chain Tracking" sub={`${suppliers.length} suppliers · ${suppliers.filter(s=>s.st==='Completed').length} completed`}>
        {canEdit && <button style={B.pri} onClick={onOpenAdd}>+ Add Supplier</button>}
        <button style={B.ghost}>⬇ Excel</button>
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1000 }}>
            <thead><tr>
              {['Supplier','Category','Order Date','Exp. Delivery','Qty Ordered','Qty Received','Payment','QC','Status','Notes', ...(canEdit?['Actions']:[])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {suppliers.map(s => {
                const rowBg = s.st === 'Completed' ? 'rgba(0,200,150,.04)' : s.st === 'Pending External' ? 'rgba(255,214,0,.03)' : ''
                return (
                  <tr key={s.id} style={{ background:rowBg, cursor:'pointer' }} onClick={() => setDetail(s)}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{s.name}</td>
                    <td style={TD}><Badge s={s.cat} /></td>
                    <td style={{ ...TD, color:C.t3 }}>{s.od}</td>
                    <td style={{ ...TD, color:C.t3 }}>{s.ed}</td>
                    <td style={TD}>{s.qty}</td>
                    <td style={{ ...TD, color: s.qr === s.qty && s.qty !== '—' ? C.green : C.t2 }}>{s.qr}</td>
                    <td style={TD}><Badge s={s.pay} /></td>
                    <td style={TD}><Badge s={s.qc} /></td>
                    <td style={TD}><Badge s={s.st} /></td>
                    <td style={{ ...TD, color:C.t3, fontSize:11, maxWidth:140, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.notes}</td>
                    {canEdit && <td style={TD} onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setModal({ type:'supplier-edit', data:s }) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>
                      <button onClick={() => { setSuppliers(p => p.filter(x => x.id !== s.id)); showToast('Deleted','Supplier removed') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {detail && (
        <Modal title={`${detail.name} — Supplier Detail`} sub="Full order history and supplier information" onClose={() => setDetail(null)} onSave={() => setDetail(null)} saveLabel="Close">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11, marginBottom:14 }}>
            {[['Status', <Badge key="st" s={detail.st} />],['QC Status',<Badge key="qc" s={detail.qc}/>],['Payment',<Badge key="pay" s={detail.pay}/>],['Category',<span key="cat" style={{fontWeight:700,color:C.t1}}>{detail.cat}</span>]].map(([lbl,val]) => (
              <div key={lbl} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>{lbl}</div>
                {val}
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.t2, marginBottom:8 }}><strong style={{color:C.t1}}>Notes:</strong> {detail.notes}</div>
          <div style={{ fontSize:12, color:C.t2, marginBottom:8 }}><strong style={{color:C.t1}}>Ordered:</strong> {detail.qty} · <strong style={{color:C.t1}}>Received:</strong> {detail.qr}</div>
          <div style={{ fontSize:12, color:C.t2 }}><strong style={{color:C.t1}}>Order Date:</strong> {detail.od} · <strong style={{color:C.t1}}>Expected:</strong> {detail.ed} · <strong style={{color:C.t1}}>Actual:</strong> {detail.ad}</div>
        </Modal>
      )}
    </div>
  )
}

// ─── TAB: Gold Sourcing ─────────────────────────────────────────────────────────
function TabGold({ gold, setGold: _setGold, canEdit: _canEdit, isAdmin, isHead, isMgmt, isExternal, showToast, setModal }) {
  if (isExternal) return <Restrict amber text="Gold Sourcing data is confidential. Contact Operations Head for access." />
  if (!isAdmin && !isHead && !isMgmt) return <Restrict amber text="Gold Sourcing data is confidential. Contact Operations Head for access." />
  const limitedView = isMgmt && !isAdmin && !isHead

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH
        title={<>Gold Sourcing Channels {limitedView && <span style={{ fontSize:12, color:C.yellow, fontWeight:500 }}> ⚠ Limited View</span>}</>}
        sub={limitedView ? 'Volume and status data only — channel names and contacts are restricted' : 'Confidential — Super Admin & Operations Head full access'}
      >
        {isAdmin && <button style={B.pri} onClick={() => setModal({ type:'gold-add', data:null })}>+ Add Channel</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: limitedView ? 600 : 1000 }}>
            <thead><tr>
              <th style={TH}>Channel ID</th>
              {!limitedView && <th style={TH}>Channel Name</th>}
              {isAdmin && !limitedView && <th style={TH}>Actions</th>}
              <th style={TH}>Region</th>
              <th style={TH}>Vol. Target (kg)</th>
              <th style={TH}>Actual (kg)</th>
              <th style={TH}>Performance</th>
              <th style={TH}>Stage</th>
              <th style={TH}>Contract</th>
              {!limitedView && <><th style={TH}>Compliance</th><th style={TH}>Risk</th><th style={TH}>Last Activity</th><th style={TH}>Next Action</th></>}
            </tr></thead>
            <tbody>
              {gold.map(g => {
                const perf = pct(g.actual, g.vol || 1)
                return (
                  <tr key={g.id} style={{ cursor:'pointer' }} onClick={() => !limitedView && !isAdmin && showToast('Channel Detail', `Negotiation history for ${g.code}`)}>
                    <td style={TD}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(245,158,11,.12)', color:C.gold, border:'1px solid rgba(245,158,11,.3)' }}>{g.code}</span></td>
                    {!limitedView && <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{g.name}</td>}
                    <td style={{ ...TD, color:C.t3 }}>{g.region}</td>
                    <td style={{ ...TD, color:C.gold, fontWeight:700 }}>{g.vol} kg</td>
                    <td style={{ ...TD, color:C.t2 }}>{g.actual} kg</td>
                    <td style={{ ...TD, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ProgBar pct={perf} color={perf>=80?C.green:perf>=50?C.yellow:C.red} />
                        <span style={{ fontSize:11, fontWeight:700, color:C.t1, width:34, textAlign:'right' }}>{perf}%</span>
                      </div>
                    </td>
                    <td style={TD}><Badge s={g.stage} /></td>
                    <td style={TD}><Badge s={g.cst} /></td>
                    {!limitedView && <>
                      <td style={TD}><Badge s={g.comp === 'Yes' ? 'Yes' : 'No'} /></td>
                      <td style={TD}><Badge s={g.risk} /></td>
                      <td style={{ ...TD, color:C.t3 }}>{g.lastAct}</td>
                      <td style={{ ...TD, color:C.cyan, fontSize:11 }}>{g.nextAction}</td>
                    </>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {!limitedView && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Card>
            <CardTitle>Volume Performance by Channel</CardTitle>
            {gold.map(g => <ProgRow key={g.id} label={`${g.code} — ${g.region}`} p={pct(g.actual, g.vol || 1)} color={g.risk==='High' ? C.red : g.risk==='Medium' ? C.yellow : C.green} />)}
          </Card>
          <Card>
            <CardTitle>Channel Risk Distribution</CardTitle>
            {[['Low', C.green], ['Medium', C.yellow], ['High', C.red]].map(([r, c]) => (
              <ProgRow key={r} label={`Risk Level: ${r}`} p={pct(gold.filter(g => g.risk === r).length, gold.length)} color={c} />
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Transport Routes ──────────────────────────────────────────────────────
function TabRoutes({ routes, setRoutes, canEdit, isExternal, isMgmt, showToast, onOpenIncident, setModal }) {
  if (isMgmt) return <Restrict text="Transport routes are managed by the Operations team." />
  if (isExternal) return <Restrict text="Transport route details are not available to vendors." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Transport Routes" sub={`${routes.filter(r=>r.st==='Active').length} active · ${routes.filter(r=>r.st!=='Active').length} restricted/suspended`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'route-add', data:null })}>+ Add Route</button>}
        {canEdit && <button style={B.warn} onClick={onOpenIncident}>⚠ Report Incident</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100 }}>
            <thead><tr>
              {['Route','Origin','Destination','Carrier','Mode','ETA','Status','Risk','GPS','Checkpoints','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {routes.map(r => {
                const rowBg = r.st === 'Active' ? 'rgba(0,200,150,.03)' : r.st === 'On Hold' ? 'rgba(255,214,0,.03)' : 'rgba(255,71,87,.04)'
                return (
                  <tr key={r.id} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{r.name}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.origin}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.dest}</td>
                    <td style={TD}>{r.carrier}</td>
                    <td style={TD}><Badge s={r.mode} /></td>
                    <td style={{ ...TD, color:C.t2 }}>{r.eta}</td>
                    <td style={TD}><Badge s={r.st} /></td>
                    <td style={TD}><Badge s={r.risk} /></td>
                    <td style={TD}><Badge s={r.gps} /></td>
                    <td style={{ ...TD, fontWeight:700, color: r.checkpoints.split('/')[0] === r.checkpoints.split('/')[1] ? C.green : C.yellow }}>{r.checkpoints}</td>
                    <td style={TD}>
                      {canEdit && <button onClick={() => setModal({ type:'route-edit', data:r })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>}
                      {canEdit && <button onClick={onOpenIncident} style={{ background:'none', border:'none', cursor:'pointer', color:C.orange, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Report</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete route?')) { setRoutes(p => p.filter(x=>x.id!==r.id)); showToast('Deleted','Route removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>}
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

// ─── TAB: Security ──────────────────────────────────────────────────────────────
function TabSecurity({ secVendors, setSecVendors, incidents, setIncidents, canEdit, isExternal, isMgmt, showToast, onOpenIncident, setModal }) {
  if (isExternal || isMgmt) return <Restrict text="Security coordination is restricted to Security Officer and Operations team." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Security Coordination" sub={`${secVendors.length} vendors · ${incidents.length} incidents logged`}>
        {canEdit && <button style={B.sec} onClick={() => setModal({ type:'secvendor-add', data:null })}>+ Add Vendor</button>}
        {canEdit && <button style={B.pri} onClick={onOpenIncident}>+ Log Incident</button>}
      </SH>

      <Card>
        <CardTitle>Security Alerts</CardTitle>
        {[
          { lv:'r', title:'🔴 Route RAIL-1 — Incident Under Investigation', desc:'Route breach INC-003 reported Apr 2. Route suspended. Investigation in progress. All shipments rerouted to KAZ-1.' },
          { lv:'o', title:'🟠 Security Review Overdue — AlphaGuard Ltd',    desc:'AlphaGuard protocol review was due Mar 15. Still pending. Risk to AIR-1 security.' },
          { lv:'y', title:'🟡 GPS Tracking Inactive — Route KAZ-2',         desc:'GPS tracking not active on Route KAZ-2. Security monitoring gap exists.' },
        ].map((a, i) => {
          const col = a.lv==='r'?C.red:a.lv==='o'?C.orange:C.yellow
          return (
            <div key={i} style={{ padding:'10px 13px', borderRadius:8, marginBottom:8, borderLeft:`3px solid ${col}`, background:`${col}09` }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:col, marginBottom:3 }}>{a.title}</div>
              <div style={{ fontSize:11.5, color:C.t3, lineHeight:1.5 }}>{a.desc}</div>
              <div style={{ display:'flex', gap:5, marginTop:8 }}>
                <button onClick={() => showToast('Acknowledged','Alert marked as acknowledged')} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(0,200,150,.12)', color:C.green, fontFamily:'inherit' }}>Acknowledge</button>
                <button onClick={() => showToast('Escalated','Alert escalated to Operations Head')} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,112,67,.12)', color:C.orange, fontFamily:'inherit' }}>Escalate</button>
              </div>
            </div>
          )
        })}
      </Card>

      <TableWrap>
        <TableHead title="Security Vendors" subtitle="Protocol and escort status" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead><tr>
              {['Vendor','Protocol','Escort','Threat Level','Last Review','Next Review','Route','Incidents','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {secVendors.map(s => (
                <tr key={s.id}>
                  <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{s.vendor}</td>
                  <td style={TD}><Badge s={s.proto} /></td>
                  <td style={TD}><Badge s={s.escort} /></td>
                  <td style={TD}><Badge s={s.threat} /></td>
                  <td style={{ ...TD, color:C.t3 }}>{s.lastRev}</td>
                  <td style={{ ...TD, color: s.proto !== 'Approved' ? C.red : C.cyan }}>{s.nextRev}</td>
                  <td style={{ ...TD, color:C.t3 }}>{s.route}</td>
                  <td style={TD}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: s.incidents>0?'rgba(255,71,87,.12)':'rgba(0,200,150,.12)', color: s.incidents>0?C.red:C.green, border:`1px solid ${s.incidents>0?'rgba(255,71,87,.3)':'rgba(0,200,150,.3)'}` }}>{s.incidents} incident{s.incidents!==1?'s':''}</span></td>
                  <td style={TD}>
                    {canEdit && <button onClick={() => setModal({ type:'secvendor-edit', data:s })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>}
                    <button onClick={() => showToast('Protocol',`${s.vendor} protocol document`)} style={{ background:'none', border:'none', cursor:'pointer', color:C.cyan, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Doc</button>
                    {canEdit && <button onClick={() => { if (window.confirm(`Delete ${s.vendor}?`)) { setSecVendors(p => p.filter(x=>x.id!==s.id)); showToast('Deleted',`${s.vendor} removed`) } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title="Incident Register" subtitle={`${incidents.length} incidents logged`}
          right={canEdit && <button style={{ ...B.pri, ...B.sm }} onClick={onOpenIncident}>+ Add Incident</button>} />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead><tr>
              {['Incident ID','Date','Route','Vendor','Type','Severity','Status','Resolution','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {incidents.map(inc => {
                const rowBg = inc.st==='Resolved'?'rgba(0,200,150,.04)':inc.st==='Under Investigation'?'rgba(255,214,0,.03)':'rgba(255,71,87,.04)'
                return (
                  <tr key={inc.id} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{inc.id}</td>
                    <td style={{ ...TD, color:C.t3 }}>{inc.date}</td>
                    <td style={TD}>{inc.route}</td>
                    <td style={TD}>{inc.vendor}</td>
                    <td style={{ ...TD, color:C.t2 }}>{inc.type}</td>
                    <td style={TD}><Badge s={inc.sev} /></td>
                    <td style={TD}><Badge s={inc.st} /></td>
                    <td style={{ ...TD, color: inc.res.includes('ongoing')?C.yellow:C.t2, fontSize:11 }}>{inc.res}</td>
                    <td style={TD}>
                      {canEdit && <button onClick={() => setModal({ type:'incident-edit', data:inc })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete incident?')) { setIncidents(p => p.filter(x=>x.id!==inc.id)); showToast('Deleted','Incident removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>}
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

// ─── TAB: Vendor Contracts ──────────────────────────────────────────────────────
function TabVendors({ vendors, setVendors, canEdit, isAdmin, isHead, isMgmt: _isMgmt, isUser, isExternal, showToast, onOpenAdd: _onOpenAdd, setModal }) {
  const myOnly = isExternal
  const showVal = !isUser && !isExternal

  const showData = myOnly ? vendors.filter(v => v.name.includes('KazTrans')) : vendors

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Vendor Contracts" sub={myOnly ? 'Your contract only' : `${vendors.length} vendors registered`}>
        {(isAdmin || isHead) && <button style={B.pri} onClick={() => showToast('Renewal','Initiate contract renewal form')}>↻ Initiate Renewal</button>}
        <button style={B.ghost}>⬇ Export</button>
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: showVal ? 900 : 600 }}>
            <thead><tr>
              <th style={TH}>Vendor</th>
              <th style={TH}>Service</th>
              {showVal && <th style={TH}>Contract Value</th>}
              <th style={TH}>Signed</th>
              <th style={TH}>Expiry</th>
              <th style={TH}>Days Left</th>
              <th style={TH}>Renewal</th>
              {!myOnly && <><th style={TH}>Payment Terms</th><th style={TH}>Account Mgr</th><th style={TH}>Rating</th></>}
              {canEdit && <th style={TH}>Actions</th>}
            </tr></thead>
            <tbody>
              {showData.map(v => {
                const dCol = v.days && v.days < 60 ? C.red : v.days && v.days < 120 ? C.yellow : C.green
                const rowBg = v.days && v.days < 60 ? 'rgba(255,214,0,.03)' : ''
                return (
                  <tr key={v.id} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{v.name}</td>
                    <td style={{ ...TD, color:C.t3 }}>{v.svc}</td>
                    {showVal && <td style={{ ...TD, color:C.green, fontWeight:700 }}>{v.val}</td>}
                    <td style={TD}><Badge s={v.signed} /></td>
                    <td style={{ ...TD, color: v.days && v.days < 60 ? C.red : C.t3 }}>{v.exp}</td>
                    <td style={{ ...TD, color:dCol, fontWeight:700 }}>{v.days ? `${v.days}d` : '—'}</td>
                    <td style={TD}><Badge s={v.renewal} /></td>
                    {!myOnly && <>
                      <td style={{ ...TD, color:C.t3 }}>{v.terms}</td>
                      <td style={{ ...TD, color:C.t2 }}>{v.mgr}</td>
                      <td style={TD}><div style={{ display:'flex' }}>{stars(v.rating)}</div></td>
                    </>}
                    {canEdit && <td style={TD}>
                      <button onClick={() => setModal({ type:'vendor-edit', data:v })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>
                      <button onClick={() => showToast('Contract','View contract document')} style={{ background:'none', border:'none', cursor:'pointer', color:C.cyan, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>View</button>
                      {v.days && v.days < 120 && <button onClick={() => { setVendors(p => p.map(x => x.id===v.id ? { ...x, renewal:'Under Negotiation' } : x)); showToast('Renewal Started',`Renewal process initiated for ${v.name}`) }} style={{ background:'none', border:'none', cursor:'pointer', color:C.green, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Renew</button>}
                      <button onClick={() => { if (window.confirm(`Delete ${v.name}?`)) { setVendors(p => p.filter(x=>x.id!==v.id)); showToast('Deleted',`${v.name} removed`) } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {!myOnly && (
        <Card>
          <CardTitle>Contract Timeline — Expiry Overview</CardTitle>
          {vendors.filter(v => v.days).sort((a,b) => a.days-b.days).map(v => {
            const col = v.days < 60 ? C.red : v.days < 120 ? C.yellow : C.green
            return (
              <div key={v.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:C.t2, fontWeight:600 }}>{v.name}</span>
                  <span style={{ color:col, fontWeight:700 }}>{v.days}d — {v.exp}</span>
                </div>
                <ProgBar pct={Math.min(v.days/365*100, 100)} color={col} height={8} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

// ─── TAB: Inventory ─────────────────────────────────────────────────────────────
function TabInventory({ inventory, setInventory: _setInventory, suppliers: _suppliers, setSuppliers, canEdit, isExternal, isMgmt, showToast, setModal, onDeleteInventory }) {
  if (isExternal || isMgmt) return <Restrict text="Inventory tracking is restricted to Operations team." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Inventory & Stock Tracking" sub={`${inventory.filter(i=>i.st==='Critical').length} critical · ${inventory.filter(i=>i.st==='Low Stock').length} low stock`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'inventory-add', data:null })}>+ Add Item</button>}
        <button style={B.ghost}>⬇ Report</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Critical Stock" value={<span style={{color:C.red}}>{inventory.filter(i=>i.st==='Critical').length}</span>} sub="Immediate restock needed" dot={C.red} />
        <StatCard label="Low Stock" value={<span style={{color:C.yellow}}>{inventory.filter(i=>i.st==='Low Stock').length}</span>} sub="Below minimum level" dot={C.yellow} />
        <StatCard label="Sufficient" value={<span style={{color:C.green}}>{inventory.filter(i=>i.st==='Sufficient').length}</span>} sub="Above minimum level" dot={C.green} />
      </div>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['Item ID','Item','Current Stock','Min. Level','Stock Status','Supplier','Last Restocked','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {inventory.map(i => {
                const rowBg = i.st==='Critical'?'rgba(255,71,87,.04)':i.st==='Low Stock'?'rgba(255,214,0,.03)':'rgba(0,200,150,.03)'
                return (
                  <tr key={i.id} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{i.id}</td>
                    <td style={TD}>{i.item}</td>
                    <td style={{ ...TD, color: i.stock===0?C.red:i.stock<=i.min?C.yellow:C.green, fontWeight:700 }}>{i.stock} units</td>
                    <td style={{ ...TD, color:C.t3 }}>{i.min} units</td>
                    <td style={TD}><Badge s={i.st} /></td>
                    <td style={{ ...TD, color:C.t2 }}>{i.sup}</td>
                    <td style={{ ...TD, color:C.t3 }}>{i.last}</td>
                    <td style={TD}>
                      {canEdit && <button onClick={() => setModal({ type:'inventory-edit', data:i })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>}
                      {canEdit && <button onClick={() => {
                        setSuppliers(p => [...p, { id:Date.now(), name:`Restock: ${i.item}`, cat:'Consumables', od:'Today', ed:'TBD', ad:'—', qty:'Restock order', qr:'0', pay:'Not Paid', qc:'Pending', st:'Not Started', notes:'Auto-created from inventory restock request' }])
                        showToast('Restock Requested', `${i.item} — procurement request sent`)
                      }} style={{ ...B.sec, ...B.sm }}>Restock</button>}
                      {canEdit && <button onClick={() => onDeleteInventory && onDeleteInventory(i)} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit', marginLeft:6 }}>Del</button>}
                      {i.st === 'Critical' && <span style={{ marginLeft:6, fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'rgba(255,71,87,.15)', color:C.red, border:'1px solid rgba(255,71,87,.3)' }}>⚠ URGENT</span>}
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

// ─── TAB: Live Map ──────────────────────────────────────────────────────────────
function TabMap({ canEdit: _canEdit, isAdmin, isHead, isExternal, showToast }) {
  if (isExternal) return <Restrict text="Live Operations Map is restricted." />
  const showGold = isAdmin || isHead

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Live Operations Map" sub={showGold ? 'Full view — all pins visible' : 'Routes and logistics view'} />
      <div style={{ background:'#f0faf5', borderRadius:10, minHeight:340, position:'relative', overflow:'hidden', border:`1px solid ${C.border}` }}>
        {/* Grid overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(var(--purple-rgb),.05) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--purple-rgb),.05) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
        {/* Route lines */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          <line x1="15%" y1="30%" x2="55%" y2="65%" stroke="rgba(0,200,150,.5)"  strokeWidth="2" strokeDasharray="6 3" />
          <line x1="20%" y1="48%" x2="55%" y2="65%" stroke="rgba(255,214,0,.4)"  strokeWidth="2" strokeDasharray="6 3" />
          <line x1="18%" y1="22%" x2="55%" y2="65%" stroke="rgba(0,180,216,.5)"  strokeWidth="2" strokeDasharray="4 4" />
          <line x1="50%" y1="16%" x2="55%" y2="65%" stroke="rgba(255,71,87,.4)"  strokeWidth="2" strokeDasharray="6 3" />
        </svg>
        {/* Site Alpha */}
        <MapPin x="55%" y="65%" onClick={() => showToast('Site Alpha','Main production site — all routes terminate here')}>
          <div style={{ width:16, height:16, borderRadius:'50%', background:'var(--purple)', border:'2px solid #fff', boxShadow:'0 0 10px var(--purple)' }} />
          <div style={{ fontSize:10, color:'#fff', marginTop:3, fontWeight:700, textShadow:'0 1px 3px #000', whiteSpace:'nowrap' }}>🏭 Site Alpha</div>
        </MapPin>
        {/* Almaty */}
        <MapPin x="15%" y="30%" onClick={() => showToast('Almaty Hub','Route KAZ-1 origin — Primary road corridor')}>
          <PingDot color={C.green} /><div style={{ fontSize:9, color:C.green, marginTop:2, fontWeight:700 }}>📍 Almaty</div>
        </MapPin>
        {/* Airport */}
        <MapPin x="18%" y="22%" onClick={() => showToast('Almaty Airport','Route AIR-1 — High-value cargo only')}>
          <PingDot color={C.cyan} /><div style={{ fontSize:9, color:C.cyan, marginTop:2, fontWeight:700 }}>✈️ Airport</div>
        </MapPin>
        {/* Shymkent */}
        <MapPin x="20%" y="48%" onClick={() => showToast('Shymkent','Route KAZ-2 — Alternate road route (On Hold)')}>
          <PingDot color={C.yellow} /><div style={{ fontSize:9, color:C.yellow, marginTop:2, fontWeight:700 }}>📍 Shymkent</div>
        </MapPin>
        {/* Security checkpoints */}
        <MapPin x="38%" y="50%" onClick={() => showToast('Checkpoint Alpha-3','Security checkpoint — km 240 on KAZ-1. Armed escort beyond this point.')}>
          <div style={{ width:12, height:12, background:C.orange, borderRadius:3, border:'2px solid #fff' }} />
          <div style={{ fontSize:9, color:C.orange, marginTop:2, fontWeight:700 }}>🔐 CP-A3</div>
        </MapPin>
        <MapPin x="28%" y="39%" onClick={() => showToast('Checkpoint Alpha-2','Security checkpoint KAZ-1')}>
          <div style={{ width:10, height:10, background:C.orange, borderRadius:3, border:'1.5px solid rgba(255,255,255,.6)' }} />
          <div style={{ fontSize:8, color:C.orange, marginTop:2 }}>🔐 CP-A2</div>
        </MapPin>
        {/* Gold channels */}
        {showGold && <>
          <MapPin x="72%" y="26%" onClick={() => showToast('GS-001','Altyn Partners — East KZ. Contract Active. 80% volume attainment.')}>
            <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(245,158,11,.3)', border:`2px solid ${C.gold}` }} />
            <div style={{ fontSize:9, color:C.gold, marginTop:2, fontWeight:700 }}>🥇 GS-001</div>
          </MapPin>
          <MapPin x="60%" y="20%" onClick={() => showToast('GS-002','Northern Highlands — Final Negotiation. Volume: 52/80kg target.')}>
            <div style={{ width:12, height:12, borderRadius:'50%', background:'rgba(245,158,11,.2)', border:`2px solid rgba(245,158,11,.6)` }} />
            <div style={{ fontSize:9, color:C.gold, marginTop:2 }}>🥇 GS-002</div>
          </MapPin>
          <MapPin x="65%" y="42%" onClick={() => showToast('GS-003','KazGold Network — Central KZ. MoU stage. 18/50kg.')}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(245,158,11,.15)', border:`2px solid rgba(245,158,11,.4)` }} />
            <div style={{ fontSize:8, color:'rgba(245,158,11,.7)', marginTop:2 }}>🥇 GS-003</div>
          </MapPin>
        </>}
        {/* Legend */}
        <div style={{ position:'absolute', bottom:12, left:12, background:'rgba(30,30,53,.9)', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:8 }}>Legend</div>
          {[['Active Route',C.green,'circle'],['On Hold',C.yellow,'circle'],['Suspended',C.red,'circle'],['Security Checkpoint',C.orange,'square'],...(showGold?[['Gold Channel',C.gold,'circle']]:[]),['Main Site','var(--purple)','circle']].map(([lbl,col,shape]) => (
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.t2, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius: shape==='circle'?'50%':3, background:col, flexShrink:0 }} />
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function MapPin({ x, y, onClick, children }) {
  return (
    <div onClick={onClick} style={{ position:'absolute', left:x, top:y, transform:'translate(-50%,-50%)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
      {children}
    </div>
  )
}
function PingDot({ color }) {
  return <div style={{ width:12, height:12, borderRadius:'50%', border:`2px solid ${color}`, background:`${color}30` }} />
}

// ─── TAB: Analytics ─────────────────────────────────────────────────────────────
function TabAnalytics({ canEdit: _canEdit, isAdmin, isHead, isMgmt, isExternal: _isExternal }) {
  if (!isAdmin && !isHead && !isMgmt) return <Restrict text="Operations Analytics is restricted to Super Admin, Operations Head and Management." />

  const barData = [
    { label:'Fulfillment Rate', bars:[{m:'Nov',v:88},{m:'Dec',v:91},{m:'Jan',v:85},{m:'Feb',v:92},{m:'Mar',v:94},{m:'Apr',v:72}], color:'rgba(0,180,216,.5)', suffix:'%' },
  ]
  const incData = [{m:'Nov',v:0},{m:'Dec',v:1},{m:'Jan',v:0},{m:'Feb',v:0},{m:'Mar',v:2},{m:'Apr',v:1}]
  const goldData = [{m:'Nov',t:250,a:238},{m:'Dec',t:250,a:261},{m:'Jan',t:250,a:244},{m:'Feb',t:250,a:257},{m:'Mar',t:250,a:248},{m:'Apr',t:250,a:96}]
  const readData = [{m:'Jan',v:45},{m:'Feb',v:52},{m:'Mar',v:61},{m:'Apr 1',v:68},{m:'Apr 7',v:73},{m:'Apr 13',v:72}]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Operations Analytics & Reports" sub="Performance trends and data insights">
        <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:7, padding:'6px 12px', fontFamily:'inherit', fontSize:12, outline:'none' }}>
          <option>Last 6 Months</option><option>Last 12 Months</option><option>This Year</option>
        </select>
        <button style={B.ghost}>⬇ PDF</button>
        <button style={B.ghost}>⬇ Excel</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Supply Chain Fulfillment Rate (%)</CardTitle>
          <BarChart bars={barData[0].bars.map(d => ({ label:d.m, value:d.v, max:100, color:'rgba(0,180,216,.5)', valLabel:`${d.v}%` }))} height={100} />
        </Card>
        <Card>
          <CardTitle>Gold Volume Sourced vs Target (kg)</CardTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:100 }}>
            {goldData.map((d,i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ display:'flex', gap:2, alignItems:'flex-end', width:'100%' }}>
                  <div style={{ height:d.t*.38, background:'rgba(245,158,11,.3)', flex:1, borderRadius:'3px 3px 0 0' }} />
                  <div style={{ height:d.a*.38, background:'rgba(245,158,11,.7)', flex:1, borderRadius:'3px 3px 0 0' }} />
                </div>
                <div style={{ fontSize:9, color:C.t3 }}>{d.m}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11 }}>
            <span><span style={{ display:'inline-block', width:10, height:10, background:'rgba(245,158,11,.3)', marginRight:4, borderRadius:2 }} />Target</span>
            <span><span style={{ display:'inline-block', width:10, height:10, background:'rgba(245,158,11,.7)', marginRight:4, borderRadius:2 }} />Actual</span>
          </div>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Security Incidents Trend</CardTitle>
          <BarChart bars={incData.map(d => ({ label:d.m, value:d.v, max:3, color:d.v>1?'rgba(255,71,87,.6)':d.v>0?'rgba(255,112,67,.5)':'rgba(0,200,150,.3)', valLabel:`${d.v}` }))} height={100} />
        </Card>
        <Card>
          <CardTitle>Operational Readiness Trend</CardTitle>
          <BarChart bars={readData.map(d => ({ label:d.m, value:d.v, max:100, color:d.v>=70?'rgba(0,200,150,.6)':'rgba(255,214,0,.5)', valLabel:`${d.v}%` }))} height={80} />
        </Card>
      </div>
    </div>
  )
}
function BarChart({ bars, height }) {
  const maxV = Math.max(...bars.map(b => b.max || b.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height }}>
      {bars.map((b, i) => (
        <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
          <div style={{ height: Math.max(4, (b.value/maxV)*height*0.85), width:'100%', background:b.color, borderRadius:'4px 4px 0 0', minHeight:4 }} />
          <div style={{ fontSize:9, fontWeight:700, color:C.t3 }}>{b.valLabel}</div>
          <div style={{ fontSize:9, color:C.t3 }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

const OPS_PROJECTS_DEPT = 'operations'
const OPS_PROJECTS_MODULE = 'operations-projects'
/** Match backend MAX_TASK_ASSIGNEES */
const MAX_OPS_ASSIGNEES = 20
const OPS_LINKED_SECTION_OPTS = ['Supply Chain', 'Gold Sourcing', 'Transport', 'Security', 'Vendor Contracts', 'Inventory']
const OPS_LINKED_LABEL_KEY = {
  'Supply Chain': 'opsLinkedSupplyChain',
  'Gold Sourcing': 'opsLinkedGoldSourcing',
  Transport: 'opsLinkedTransport',
  Security: 'opsLinkedSecurity',
  'Vendor Contracts': 'opsLinkedVendorContracts',
  Inventory: 'opsLinkedInventory',
}
/** Align with backend TASK_STALE_MS: prefer VITE_OPS_PROJECTS_STALE_DAYS, else VITE_TASK_STALE_DAYS (1–366). */
const STALE_TASK_DAYS_RAW = Number(
  import.meta.env?.VITE_OPS_PROJECTS_STALE_DAYS ?? import.meta.env?.VITE_TASK_STALE_DAYS
)
const STALE_TASK_DAYS =
  Number.isFinite(STALE_TASK_DAYS_RAW) && STALE_TASK_DAYS_RAW > 0
    ? Math.min(366, Math.max(1, Math.floor(STALE_TASK_DAYS_RAW)))
    : 7
const STALE_TASK_MS = STALE_TASK_DAYS * 24 * 60 * 60 * 1000

function dueToInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return x.toISOString().slice(0, 10)
}

function fmtShortDt(dt) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function apiStatusToUiSt(s) {
  const key = String(s || '').toLowerCase()
  const m = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    blocked: 'Blocked',
    'under-review': 'Under review',
    done: 'Done',
    cancelled: 'Done',
  }
  return m[key] || 'To Do'
}

function uiStToApiStatus(st) {
  const m = {
    'To Do': 'todo',
    'In Progress': 'in-progress',
    'Under review': 'under-review',
    Blocked: 'blocked',
    Done: 'done',
  }
  return m[st] || 'todo'
}

function apiPriToUi(p) {
  const x = String(p || '').toLowerCase()
  if (x === 'critical') return 'Critical'
  if (x === 'high') return 'High'
  if (x === 'medium') return 'Medium'
  return 'Low'
}

function uiPriToApi(p) {
  if (p === 'Critical') return 'critical'
  if (p === 'High') return 'high'
  if (p === 'Medium') return 'medium'
  return 'low'
}

function linkedSectionFromApi(t) {
  const lr = (t.linkedRecord || '').trim()
  if (lr) return lr.slice(0, 120)
  return 'Supply Chain'
}

function isStaleTask(t) {
  if (!t?.updatedAt || String(t.status || '').toLowerCase() === 'done') return false
  try {
    let last = new Date(t.updatedAt).getTime()
    const comments = Array.isArray(t.comments) ? t.comments : []
    for (const c of comments) {
      const ct = c?.createdAt ? new Date(c.createdAt).getTime() : 0
      if (ct > last) last = ct
    }
    return Date.now() - last > STALE_TASK_MS
  } catch {
    return false
  }
}

function assigneesFromApiTask(t) {
  const ids =
    Array.isArray(t.assignedToIds) && t.assignedToIds.length
      ? [...new Set(t.assignedToIds.map((id) => String(id)))]
      : t.assignedToId
        ? [String(t.assignedToId)]
        : []
  const parts = (t.assignedTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.map((id, i) => ({
    id,
    name: parts[i] ?? parts[0] ?? '—',
  }))
}

function syncAssignFieldsFromAssignees(assignees) {
  const list = Array.isArray(assignees) ? assignees.filter((a) => a && a.id) : []
  return {
    assignees: list,
    assign: list.map((a) => a.name).join(', '),
    assignToId: list[0]?.id || '',
  }
}

function buildOpsAssigneeApiFields(f) {
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  if (Array.isArray(f.assignees)) {
    const valid = f.assignees.filter((a) => a && hex24(a.id))
    if (valid.length) {
      const capped = valid.slice(0, MAX_OPS_ASSIGNEES)
      return {
        assignedToIds: capped.map((a) => String(a.id).trim()),
        assignedTo: capped.map((a) => (a.name || '').trim() || 'User').join(', '),
        assignedToId: String(capped[0].id).trim(),
      }
    }
    const manual = (f.assign || '').trim() || (f.assignToId && hex24(f.assignToId))
    if (!manual) {
      return { assignedToIds: [], assignedToId: null, assignedTo: '' }
    }
  }
  return {
    assignedTo: (f.assign || '').trim() || undefined,
    assignedToId: f.assignToId && hex24(f.assignToId) ? String(f.assignToId).trim() : undefined,
  }
}

function mapApiTaskToOpsRow(t) {
  const d = dueToInputDate(t.dueDate)
  const startD = dueToInputDate(t.startDate)
  const checklist = Array.isArray(t.checklist)
    ? t.checklist.map((c, i) => ({
        title: c.title || '',
        done: Boolean(c.done),
        order: typeof c.order === 'number' ? c.order : i,
      }))
    : []
  const assignees = assigneesFromApiTask(t)
  const assign =
    assignees.length > 0 ? assignees.map((a) => a.name).join(', ') : t.assignedTo || 'Unassigned'
  return {
    id: t._id,
    _api: t,
    title: t.title || '',
    desc: t.description || '',
    assignees,
    assign,
    assignToId: assignees[0]?.id || '',
    pri: apiPriToUi(t.priority),
    due: d || 'TBD',
    start: startD || '',
    st: apiStatusToUiSt(t.status),
    sec: linkedSectionFromApi(t),
    comments: Array.isArray(t.comments) ? [...t.comments] : [],
    reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : '',
    archivedAt: t.archivedAt || null,
    autoArchiveAt: t.autoArchiveAt || null,
    createdBy: t.createdBy || '',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    alsoNotifyIds: (t.alsoNotifyIds || []).map((id) => String(id)),
    alsoNotifyNames: Array.isArray(t.alsoNotifyNames) ? [...t.alsoNotifyNames] : [],
    tags: Array.isArray(t.tags) ? [...t.tags] : [],
    checklist,
    blockedReason: t.blockedReason || '',
    blockedByTaskId: t.blockedByTaskId ? String(t.blockedByTaskId) : '',
    dependsOn: (t.dependsOn || []).map((x) => String(x)),
    estimateHours: t.estimateHours != null && !Number.isNaN(Number(t.estimateHours)) ? String(t.estimateHours) : '',
    loggedHours: t.loggedHours != null && !Number.isNaN(Number(t.loggedHours)) ? String(t.loggedHours) : '',
    attachments: Array.isArray(t.attachments) ? [...t.attachments] : [],
    stale: isStaleTask(t),
    notifyText: '',
  }
}

/** Prefer `project` / `projects`; tolerate older API bodies that used `task` / `tasks`. */
function projectDocFromApiResponse(res) {
  return res?.project ?? res?.task ?? null
}

function buildOpsExtendedPayload(f) {
  const tags = Array.isArray(f.tags) ? [...new Set(f.tags.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20).map((x) => x.slice(0, 40)) : []
  const checklist = Array.isArray(f.checklist)
    ? f.checklist
        .filter((c) => c && String(c.title || '').trim())
        .slice(0, 40)
        .map((c, i) => ({
          title: String(c.title).trim().slice(0, 200),
          done: Boolean(c.done),
          order: typeof c.order === 'number' && !Number.isNaN(c.order) ? c.order : i,
        }))
    : []
  const blockedReason = f.st === 'Blocked' ? String(f.blockedReason || '').trim().slice(0, 500) : ''
  const blockedByTaskId = f.st === 'Blocked' && f.blockedByTaskId ? String(f.blockedByTaskId).trim() : ''
  const dependsOn = Array.isArray(f.dependsOn) ? [...new Set(f.dependsOn.filter(Boolean).map(String))] : []
  const eh = f.estimateHours === '' || f.estimateHours == null ? null : Number(f.estimateHours)
  const lh = f.loggedHours === '' || f.loggedHours == null ? null : Number(f.loggedHours)
  return {
    tags,
    checklist,
    blockedReason,
    blockedByTaskId: blockedByTaskId || undefined,
    dependsOn: dependsOn.length ? dependsOn : [],
    estimateHours: eh != null && !Number.isNaN(eh) ? eh : null,
    loggedHours: lh != null && !Number.isNaN(lh) ? lh : null,
  }
}

function buildOpsCreatePayload(f) {
  const ext = buildOpsExtendedPayload(f)
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  const alsoNotifyIds = Array.isArray(f.alsoNotifyIds) ? [...new Set(f.alsoNotifyIds.filter(hex24))].slice(0, 50) : []
  const alsoNotifyNames = Array.isArray(f.alsoNotifyNames)
    ? [...new Set(f.alsoNotifyNames.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50)
    : []
  const assignPart = buildOpsAssigneeApiFields(f)
  return {
    title: f.title.trim(),
    description: (f.desc || '').trim(),
    ...assignPart,
    department: OPS_PROJECTS_DEPT,
    linkedRecord: String(f.sec || '').trim().slice(0, 120),
    module: OPS_PROJECTS_MODULE,
    status: uiStToApiStatus(f.st),
    priority: uiPriToApi(f.pri),
    dueDate: f.due && f.due !== 'TBD' ? f.due : undefined,
    startDate: f.start && String(f.start).trim() ? f.start : null,
    reminderAt: f.reminderAt ? new Date(f.reminderAt).toISOString() : undefined,
    notifyText: (f.notifyText || '').trim() || undefined,
    alsoNotifyIds: alsoNotifyIds.length ? alsoNotifyIds : undefined,
    alsoNotifyNames: alsoNotifyNames.length ? alsoNotifyNames : undefined,
    ...ext,
  }
}

function buildOpsUpdatePayload(f) {
  const ext = buildOpsExtendedPayload(f)
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  const alsoNotifyIds = Array.isArray(f.alsoNotifyIds) ? [...new Set(f.alsoNotifyIds.filter(hex24))].slice(0, 50) : []
  const alsoNotifyNames = Array.isArray(f.alsoNotifyNames)
    ? [...new Set(f.alsoNotifyNames.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50)
    : []
  const assignPart = buildOpsAssigneeApiFields(f)
  return {
    title: f.title.trim(),
    description: (f.desc || '').trim(),
    ...assignPart,
    linkedRecord: String(f.sec || '').trim().slice(0, 120),
    module: OPS_PROJECTS_MODULE,
    status: uiStToApiStatus(f.st),
    priority: uiPriToApi(f.pri),
    dueDate: f.due && f.due !== 'TBD' ? f.due : undefined,
    startDate: f.start && String(f.start).trim() ? f.start : null,
    reminderAt: f.reminderAt ? new Date(f.reminderAt).toISOString() : undefined,
    notifyText: (f.notifyText || '').trim() || undefined,
    alsoNotifyIds: alsoNotifyIds.length ? alsoNotifyIds : undefined,
    alsoNotifyNames: alsoNotifyNames.length ? alsoNotifyNames : undefined,
    ...ext,
  }
}

function defaultOpsProjectForm() {
  return {
    title: '',
    desc: '',
    assignees: [],
    assign: '',
    assignToId: '',
    pri: 'High',
    due: '',
    start: '',
    sec: 'Supply Chain',
    st: 'To Do',
    comments: [],
    reminderAt: '',
    notifyText: '',
    alsoNotifyIds: [],
    alsoNotifyNames: [],
    tags: [],
    checklist: [],
    blockedReason: '',
    blockedByTaskId: '',
    dependsOn: [],
    estimateHours: '',
    loggedHours: '',
    attachments: [],
  }
}

function normalizeOpsProjectForm(initial) {
  const base = defaultOpsProjectForm()
  if (!initial) return base
  const assigneesFromInitial =
    Array.isArray(initial.assignees) && initial.assignees.length
      ? initial.assignees.map((a) => ({ id: String(a.id), name: String(a.name || '').trim() || '—' }))
      : initial.assignToId
        ? [{ id: String(initial.assignToId), name: (initial.assign || '').split(',')[0].trim() || '—' }]
        : []
  const assignSync = syncAssignFieldsFromAssignees(assigneesFromInitial)
  if (!initial.id) {
    return {
      ...base,
      ...initial,
      ...assignSync,
      comments: Array.isArray(initial.comments) ? initial.comments : [],
      tags: Array.isArray(initial.tags) ? initial.tags : [],
      checklist: Array.isArray(initial.checklist) ? initial.checklist : [],
      dependsOn: Array.isArray(initial.dependsOn) ? initial.dependsOn : [],
      alsoNotifyIds: Array.isArray(initial.alsoNotifyIds) ? initial.alsoNotifyIds.map(String) : [],
      alsoNotifyNames: Array.isArray(initial.alsoNotifyNames) ? [...initial.alsoNotifyNames] : [],
      attachments: Array.isArray(initial.attachments) ? initial.attachments : [],
    }
  }
  return {
    id: initial.id,
    title: initial.title || '',
    desc: initial.desc || '',
    ...assignSync,
    pri: initial.pri || 'High',
    due: initial.due && initial.due !== 'TBD' ? initial.due : '',
    start: initial.start && initial.start !== 'TBD' ? initial.start : '',
    sec: initial.sec || 'Supply Chain',
    st: initial.st || 'To Do',
    comments: Array.isArray(initial.comments) ? initial.comments : [],
    reminderAt: initial.reminderAt || '',
    notifyText: initial.notifyText || '',
    alsoNotifyIds: Array.isArray(initial.alsoNotifyIds) ? initial.alsoNotifyIds.map(String) : [],
    alsoNotifyNames: Array.isArray(initial.alsoNotifyNames) ? [...initial.alsoNotifyNames] : [],
    tags: Array.isArray(initial.tags) ? initial.tags : [],
    checklist: Array.isArray(initial.checklist) ? initial.checklist : [],
    blockedReason: initial.blockedReason || '',
    blockedByTaskId: initial.blockedByTaskId || '',
    dependsOn: Array.isArray(initial.dependsOn) ? initial.dependsOn : [],
    estimateHours: initial.estimateHours != null ? String(initial.estimateHours) : '',
    loggedHours: initial.loggedHours != null ? String(initial.loggedHours) : '',
    attachments: Array.isArray(initial.attachments) ? initial.attachments : [],
  }
}

// ─── TAB: Projects ────────────────────────────────────────────────────────────
function TabProjects({
  tasks,
  showArchived,
  setShowArchived,
  canEdit,
  isExternal,
  onOpenAdd,
  setModal,
  onDeleteOpsProject,
  canDeleteOpsProject,
  onArchiveProject,
  onUnarchiveProject,
}) {
  const { t: tr } = useLanguage()
  const visible = useMemo(() => tasks.filter((t) => showArchived || !t.archivedAt), [tasks, showArchived])
  const openCount = useMemo(() => visible.filter((t) => t.st !== 'Done').length, [visible])
  const doneCount = useMemo(() => visible.filter((t) => t.st === 'Done').length, [visible])
  if (isExternal) return <Restrict text={tr('opsProjectsRestrictExternal')} />

  const cols = [
    { key: 'To Do', labelKey: 'opsColTodo', color: C.t3 },
    { key: 'In Progress', labelKey: 'opsColInProgress', color: C.yellow },
    { key: 'Under review', labelKey: 'opsColUnderReview', color: C.pur },
    { key: 'Blocked', labelKey: 'opsColBlocked', color: C.red },
    { key: 'Done', labelKey: 'opsColDone', color: C.green },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title={tr('opsProjectsTitle')}
        sub={`${openCount} ${tr('opsProjectsOpen')} · ${doneCount} ${tr('opsProjectsCompleted')}${showArchived ? ` ${tr('opsProjectsIncArchived')}` : ''}`}
      >
        {canEdit && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {tr('opsShowArchived')}
            </label>
            <button type="button" style={B.pri} onClick={onOpenAdd}>
              {tr('opsAddProject')}
            </button>
          </div>
        )}
      </SH>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {cols.map((col) => {
          const items = visible.filter((t) => t.st === col.key)
          return (
            <div
              key={col.key}
              style={{
                minWidth: 200,
                width: 200,
                background: C.card2,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: col.color }} />
              <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{tr(col.labelKey)}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: col.color, marginTop: 3 }}>
                  {items.length} {items.length === 1 ? tr('opsProjectsCountOne') : tr('opsProjectsCountMany')}
                </div>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map((t) => {
                  const priC = t.pri === 'Critical' || t.pri === 'High' ? C.red : t.pri === 'Medium' ? C.yellow : C.cyan
                  const nProg = (t.comments || []).length
                  const descPreview = (t.desc || '').trim()
                  const cl = t.checklist || []
                  const chkPct = cl.length ? Math.round((100 * cl.filter((c) => c.done).length) / cl.length) : null
                  return (
                    <div
                      key={t.id}
                      onClick={() => canEdit && setModal({ type: 'project-edit', data: t })}
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '11px 12px',
                        cursor: canEdit ? 'pointer' : 'default',
                        opacity: t.archivedAt ? 0.65 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, flex: 1 }}>{t.title}</div>
                        {t.stale && (
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,214,0,.2)', color: '#92400e', flexShrink: 0 }}>{tr('opsStaleBadge')}</span>
                        )}
                      </div>
                      {descPreview && (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.t3,
                            lineHeight: 1.35,
                            marginBottom: 6,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {descPreview}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.t4, marginBottom: 4 }}>
                        {t.createdBy ? `${tr('opsProjectsMetaBy')} ${t.createdBy}` : ''}
                        {t.updatedAt ? ` · ${tr('opsProjectsMetaUpd')} ${fmtShortDt(t.updatedAt)}` : ''}
                      </div>
                      {chkPct != null && (
                        <div style={{ fontSize: 10, color: C.t3, marginBottom: 4 }}>
                          {tr('opsProjectsChecklistPct')}: {chkPct}%
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span>{t.sec}</span>
                        {nProg > 0 && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 20,
                              background: 'rgba(0,180,216,.12)',
                              color: C.cyan,
                              border: '1px solid rgba(0,180,216,.25)',
                              flexShrink: 0,
                            }}
                          >
                            {nProg}{' '}
                            {nProg === 1 ? tr('opsProjectsUpdateSingular') : tr('opsProjectsUpdatePlural')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${priC}15`, color: priC, border: `1px solid ${priC}30` }}>{t.pri}</span>
                        <div style={{ fontSize: 10, color: C.t4 }}>👤 {t.assign}</div>
                      </div>
                      <div style={{ fontSize: 10, color: C.t4, marginTop: 5 }}>
                        {tr('opsProjectsStartLabel')}{' '}
                        {t.start || tr('opsModalDash')}
                      </div>
                      <div style={{ fontSize: 10, color: C.t4, marginTop: 3 }}>
                        {tr('opsProjectsDueLabel')} {t.due}
                      </div>
                      {t.reminderAt && <div style={{ fontSize: 9, color: C.pur, marginTop: 3 }}>⏰ {tr('opsProjectsReminderSet')}</div>}
                      {t.autoArchiveAt && !t.archivedAt && (
                        <div style={{ fontSize: 9, color: C.t3, marginTop: 3 }}>
                          📦 {tr('opsAutoArchiveHint')} {fmtShortDt(t.autoArchiveAt)}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!items.length && (
                  <div style={{ fontSize: 11, color: C.t4, textAlign: 'center', padding: '16px 0' }}>{tr('opsNoProjectsInColumn')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <TableWrap>
        <TableHead title={tr('opsProjectsListViewTitle')} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
            <thead>
              <tr>
                {[
                  tr('opsThProject'),
                  tr('opsThAssigned'),
                  tr('opsThPriority'),
                  tr('opsThDue'),
                  tr('opsThStart'),
                  tr('opsThStatus'),
                  tr('opsThSection'),
                  tr('opsThMeta'),
                  ...(canEdit ? [tr('opsThActions')] : []),
                ].map((h, i) => (
                  <th key={i} style={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const rowBg = t.st === 'Blocked' ? 'rgba(255,71,87,.04)' : t.st === 'Done' ? 'rgba(0,200,150,.03)' : ''
                return (
                  <tr key={t.id} style={{ background: rowBg }}>
                    <td style={{ ...TD, fontWeight: 700, color: C.t1 }}>
                      {t.title}
                      {t.stale && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#92400e' }}> {tr('opsStaleBadge')}</span>
                      )}
                    </td>
                    <td style={{ ...TD, color: C.t2 }}>{t.assign}</td>
                    <td style={TD}>
                      <Badge s={t.pri} />
                    </td>
                    <td style={{ ...TD, color: C.t3 }}>{t.due}</td>
                    <td style={{ ...TD, color: C.t3 }}>{t.start || tr('opsModalDash')}</td>
                    <td style={TD}>
                      <Badge s={t.st} />
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(0,180,216,.12)', color: C.cyan, border: '1px solid rgba(0,180,216,.3)' }}>{t.sec}</span>
                    </td>
                    <td style={{ ...TD, fontSize: 10, color: C.t4 }}>
                      {t.createdBy ? `${t.createdBy} · ` : ''}
                      {t.updatedAt ? fmtShortDt(t.updatedAt) : tr('opsModalDash')}
                      {t.archivedAt ? ` · ${tr('opsArchived')}` : ''}
                    </td>
                    {canEdit && (
                      <td style={TD}>
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'project-edit', data: t })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                        >
                          {tr('edit')}
                        </button>
                        {!t.archivedAt && onArchiveProject && (
                          <button
                            type="button"
                            onClick={() => onArchiveProject(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                          >
                            {tr('opsBtnArchive')}
                          </button>
                        )}
                        {t.archivedAt && onUnarchiveProject && (
                          <button
                            type="button"
                            onClick={() => onUnarchiveProject(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                          >
                            {tr('opsBtnUnarchive')}
                          </button>
                        )}
                        {canDeleteOpsProject(t) && (
                          <button type="button" onClick={() => onDeleteOpsProject(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                            {tr('opsBtnDel')}
                          </button>
                        )}
                      </td>
                    )}
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
function ModalSupplier({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', cat:'Machinery', od:'', ed:'', qty:'', st:'Not Started', notes:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Supplier' : 'Add Supplier'} sub={isEdit ? 'Update supplier information' : 'Register a new supply chain supplier'} onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Supplier'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Supplier Name</ML><MI value={f.name} onChange={s('name')} placeholder="Company name" /></div>
        <div><ML>Category</ML><MS value={f.cat} onChange={s('cat')}>{['Machinery','Raw Materials','Chemicals','Consumables','Services'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Order Date</ML><input type="date" value={f.od} onChange={s('od')} style={IS} /></div>
        <div><ML>Expected Delivery</ML><input type="date" value={f.ed} onChange={s('ed')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Qty Ordered</ML><MI value={f.qty} onChange={s('qty')} placeholder="e.g. 10 units" /></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Not Started','In Progress','Pending External','Completed'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Notes</ML><MTA value={f.notes} onChange={s('notes')} placeholder="Any notes..." />
    </Modal>
  )
}

function ModalProject({
  initial,
  onClose,
  onSave,
  onAddProgress,
  assigneeGroups = [],
  isDepartmentUser,
  allOpsProjects = [],
  token,
  showToast,
  onProjectPatched,
  onArchive,
  onUnarchive,
}) {
  const { t: lt } = useLanguage()
  const { user } = useAuth()
  const [f, setF] = useState(() => normalizeOpsProjectForm(initial))
  const [progressNote, setProgressNote] = useState('')
  const [progressBusy, setProgressBusy] = useState(false)
  const [assignPickerKey, setAssignPickerKey] = useState(0)
  const [alsoNotifyPickerKey, setAlsoNotifyPickerKey] = useState(0)
  const s = k => e => setF((p) => ({ ...p, [k]: e.target.value }))
  const isEdit = !!(initial && initial.id)

  const assigneeIdSet = useMemo(() => new Set((f.assignees || []).map((a) => String(a.id))), [f.assignees])

  useEffect(() => {
    if (isDepartmentUser && !isEdit && user?.id) {
      setF((prev) => {
        if (prev.assignees?.length) return prev
        const self = { id: String(user.id), name: user.name || '' }
        return { ...prev, ...syncAssignFieldsFromAssignees([self]) }
      })
    }
  }, [isDepartmentUser, isEdit, user?.id, user?.name])

  const sortedComments = useMemo(() => {
    const list = [...(f.comments || [])]
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [f.comments])

  async function handleAddProgress() {
    const text = progressNote.trim()
    if (!text || !f.id || !onAddProgress) return
    setProgressBusy(true)
    try {
      await onAddProgress(f.id, text)
      setProgressNote('')
    } catch {
      /* parent shows toast */
    } finally {
      setProgressBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? lt('opsModalTitleEdit') : lt('opsModalTitleAdd')}
      sub={isEdit ? lt('opsModalSubEdit') : lt('opsModalSubAdd')}
      onClose={onClose}
      onSave={() => f.title.trim() && onSave(f)}
      saveLabel={isEdit ? lt('opsModalSaveChanges') : lt('opsModalSaveAdd')}
    >
      {isEdit && initial?.archivedAt && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(148, 163, 184, 0.12)',
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.45, marginBottom: 8 }}>{lt('opsArchivedProjectBanner')}</div>
          {onUnarchive && (
            <button type="button" onClick={() => onUnarchive({ id: f.id, title: f.title })} style={{ ...B.succ, ...B.sm }}>
              {lt('opsBtnUnarchive')}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldTitle')}</ML>
          <MI value={f.title} onChange={s('title')} placeholder={lt('opsModalPlaceholderShortTitle')} />
        </div>
        <div>
          <ML>{lt('opsModalFieldAssign')}</ML>
          {assigneeGroups.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                {(f.assignees || []).map((a) => (
                  <span
                    key={a.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'rgba(var(--purple-rgb),0.1)',
                      border: '1px solid rgba(var(--purple-rgb),0.2)',
                      color: C.t2,
                    }}
                  >
                    {a.name}
                    {!(isDepartmentUser && !isEdit) && (
                      <button
                        type="button"
                        aria-label={lt('opsModalRemove')}
                        onClick={() =>
                          setF((p) => ({
                            ...p,
                            ...syncAssignFieldsFromAssignees((p.assignees || []).filter((x) => String(x.id) !== String(a.id))),
                          }))
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 2,
                          fontSize: 12,
                          lineHeight: 1,
                          color: C.t3,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!(isDepartmentUser && !isEdit) && (f.assignees || []).length < MAX_OPS_ASSIGNEES ? (
                <>
                  <AccountCombobox
                    key={`assign-pick-${assignPickerKey}`}
                    groups={assigneeGroups}
                    value=""
                    placeholder={lt('opsModalAssignAddPlaceholder')}
                    style={{ ...IS, marginBottom: 4 }}
                    onChange={(id, label) => {
                      if (!id) return
                      setF((p) => {
                        const cur = p.assignees || []
                        if (cur.some((x) => String(x.id) === String(id)) || cur.length >= MAX_OPS_ASSIGNEES) return p
                        return { ...p, ...syncAssignFieldsFromAssignees([...cur, { id: String(id), name: label || id }]) }
                      })
                      setAssignPickerKey((k) => k + 1)
                    }}
                  />
                  <div style={{ fontSize: 10, color: C.t4, lineHeight: 1.35 }}>{lt('opsModalMultiPickerHint')}</div>
                </>
              ) : null}
            </div>
          ) : (
            <MI
              value={f.assign}
              onChange={s('assign')}
              placeholder={lt('opsModalAssignManualPlaceholder')}
              disabled={Boolean(isDepartmentUser && !isEdit)}
            />
          )}
        </div>
      </div>
      <ML>{lt('opsModalFieldDescription')}</ML>
      <MTA value={f.desc} onChange={s('desc')} placeholder={lt('opsModalDescPlaceholder')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldPriority')}</ML>
          <MS value={f.pri} onChange={s('pri')}>
            {[
              ['Critical', 'opsPriCritical'],
              ['High', 'opsPriHigh'],
              ['Medium', 'opsPriMedium'],
              ['Low', 'opsPriLow'],
            ].map(([val, k]) => (
              <option key={val} value={val}>
                {lt(k)}
              </option>
            ))}
          </MS>
        </div>
        <div>
          <ML>{lt('opsModalFieldStart')}</ML>
          <input type="date" value={f.start} onChange={s('start')} style={IS} />
        </div>
        <div>
          <ML>{lt('opsModalFieldDue')}</ML>
          <input type="date" value={f.due} onChange={s('due')} style={IS} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldLinked')}</ML>
          <MS value={f.sec} onChange={s('sec')}>
            {!OPS_LINKED_SECTION_OPTS.includes(f.sec) && f.sec ? <option value={f.sec}>{f.sec}</option> : null}
            {OPS_LINKED_SECTION_OPTS.map((o) => (
              <option key={o} value={o}>
                {lt(OPS_LINKED_LABEL_KEY[o])}
              </option>
            ))}
          </MS>
        </div>
        <div>
          <ML>{lt('opsModalFieldStatus')}</ML>
          <MS value={f.st} onChange={s('st')}>
            {[
              ['To Do', 'opsStatusTodo'],
              ['In Progress', 'opsStatusInProgress'],
              ['Under review', 'opsStatusUnderReview'],
              ['Blocked', 'opsStatusBlocked'],
              ['Done', 'opsStatusDone'],
            ].map(([val, k]) => (
              <option key={val} value={val}>
                {lt(k)}
              </option>
            ))}
          </MS>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldReminder')}</ML>
          <input type="datetime-local" value={f.reminderAt || ''} onChange={s('reminderAt')} style={IS} />
        </div>
        <div>
          <ML>{lt('opsModalFieldHours')}</ML>
          <div style={{ display: 'flex', gap: 8 }}>
            <MI
              type="number"
              min="0"
              step="0.25"
              value={f.estimateHours}
              onChange={s('estimateHours')}
              placeholder={lt('opsModalHoursEst')}
              style={{ ...IS, marginBottom: 0 }}
            />
            <MI
              type="number"
              min="0"
              step="0.25"
              value={f.loggedHours}
              onChange={s('loggedHours')}
              placeholder={lt('opsModalHoursLogged')}
              style={{ ...IS, marginBottom: 0 }}
            />
          </div>
        </div>
      </div>
      <ML>{lt('opsModalFieldTags')}</ML>
      <MI
        value={(f.tags || []).join(', ')}
        onChange={(e) => {
          const parts = e.target.value
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
          setF((p) => ({ ...p, tags: parts }))
        }}
        placeholder={lt('opsModalTagsPlaceholder')}
      />
      {f.st === 'Blocked' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <ML>{lt('opsModalBlockedReason')}</ML>
            <MI value={f.blockedReason} onChange={s('blockedReason')} placeholder={lt('opsModalBlockedReasonPh')} />
          </div>
          <div>
            <ML>{lt('opsModalBlockedBy')}</ML>
            <MS value={f.blockedByTaskId || ''} onChange={s('blockedByTaskId')}>
              <option value="">{lt('opsModalNoneDash')}</option>
              {allOpsProjects
                .filter((t) => t.id !== f.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.title || '').slice(0, 60)}
                  </option>
                ))}
            </MS>
          </div>
        </div>
      )}
      <ML>{lt('opsModalChecklistHeading')}</ML>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {(f.checklist || []).map((row, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={Boolean(row.done)}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  checklist: (p.checklist || []).map((c, i) => (i === idx ? { ...c, done: e.target.checked } : c)),
                }))
              }
            />
            <MI
              value={row.title}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  checklist: (p.checklist || []).map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)),
                }))
              }
              placeholder={lt('opsModalChecklistStepPh')}
              style={{ ...IS, marginBottom: 0, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setF((p) => ({ ...p, checklist: (p.checklist || []).filter((_c, i) => i !== idx) }))}
              style={{ ...B.ghost, ...B.sm }}
              aria-label={lt('opsModalRemoveChecklistItem')}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setF((p) => ({
              ...p,
              checklist: [...(p.checklist || []), { title: '', done: false, order: (p.checklist || []).length }],
            }))
          }
          style={{ ...B.sec, ...B.sm, alignSelf: 'flex-start' }}
        >
          {lt('opsModalChecklistAdd')}
        </button>
      </div>
      <ML>{lt('opsModalDependsOn')}</ML>
      <select
        multiple
        size={Math.min(6, Math.max(3, (allOpsProjects || []).filter((t) => t.id !== f.id).length))}
        value={f.dependsOn || []}
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map((o) => o.value)
          setF((p) => ({ ...p, dependsOn: values }))
        }}
        style={{ ...IS, minHeight: 72, marginBottom: 12 }}
      >
        {(allOpsProjects || [])
          .filter((t) => t.id !== f.id)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {(t.title || '').slice(0, 80)}
            </option>
          ))}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalNotifyMessage')}</ML>
          <MI value={f.notifyText} onChange={s('notifyText')} placeholder={lt('opsModalNotifyPlaceholder')} />
        </div>
        <div>
          <ML>{lt('opsModalAlsoNotify')}</ML>
          {assigneeGroups.length > 0 ? (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                {(f.alsoNotifyIds || []).map((nid, idx) => {
                  const optLabel = (assigneeGroups[0]?.options || []).find((o) => String(o.value) === String(nid))?.label
                  const name = (f.alsoNotifyNames && f.alsoNotifyNames[idx]) || optLabel || String(nid)
                  return (
                    <span
                      key={`${nid}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(6, 95, 70, 0.08)',
                        border: '1px solid rgba(6, 95, 70, 0.22)',
                        color: C.t2,
                      }}
                    >
                      {name}
                      <button
                        type="button"
                        aria-label={lt('opsModalRemove')}
                        onClick={() =>
                          setF((p) => {
                            const ids = [...(p.alsoNotifyIds || [])]
                            const names = [...(p.alsoNotifyNames || [])]
                            const i = ids.findIndex((x) => String(x) === String(nid))
                            if (i >= 0) {
                              ids.splice(i, 1)
                              names.splice(i, 1)
                            }
                            return { ...p, alsoNotifyIds: ids, alsoNotifyNames: names }
                          })
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 2,
                          fontSize: 12,
                          lineHeight: 1,
                          color: C.t3,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
              <AccountCombobox
                key={`also-pick-${alsoNotifyPickerKey}`}
                groups={[
                  {
                    label: assigneeGroups[0]?.label || 'Team',
                    options: (assigneeGroups[0]?.options || []).filter(
                      (o) => !assigneeIdSet.has(String(o.value)) && !(f.alsoNotifyIds || []).map(String).includes(String(o.value))
                    ),
                  },
                ]}
                value=""
                placeholder={lt('opsModalAlsoNotifyAddPlaceholder')}
                style={{ ...IS, marginBottom: 4 }}
                onChange={(id, label) => {
                  if (!id) return
                  setF((p) => {
                    const ids = [...(p.alsoNotifyIds || [])]
                    const names = [...(p.alsoNotifyNames || [])]
                    if (ids.includes(String(id)) || assigneeIdSet.has(String(id)) || ids.length >= 50) return p
                    ids.push(String(id))
                    names.push(label || id)
                    return { ...p, alsoNotifyIds: ids, alsoNotifyNames: names }
                  })
                  setAlsoNotifyPickerKey((k) => k + 1)
                }}
              />
              <div style={{ fontSize: 10, color: C.t4, lineHeight: 1.35, marginTop: 2 }}>{lt('opsModalMultiPickerHint')}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.4 }}>{lt('opsModalAlsoNotifyNoTeam')}</div>
          )}
        </div>
      </div>
      {isEdit && f.id && token && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <ML>{lt('opsModalAttachments')}</ML>
          <input
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const res = await projectsAPI.uploadProjectAttachment(token, f.id, file)
                const doc = projectDocFromApiResponse(res)
                if (doc) {
                  const row = mapApiTaskToOpsRow(doc)
                  setF(normalizeOpsProjectForm(row))
                  onProjectPatched?.(row)
                }
                showToast?.(lt('opsModalUploadedTitle'), file.name)
              } catch {
                showToast?.(lt('error'), lt('opsModalUploadFailed'))
              }
              e.target.value = ''
            }}
            style={{ fontSize: 12, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(f.attachments || []).map((a) => (
              <div key={a.fileName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: C.t2 }}>
                <a href={a.url || `#`} target="_blank" rel="noreferrer" style={{ color: 'var(--purple)' }}>
                  {a.originalName || a.fileName}
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(lt('opsModalRemoveFileConfirm'))) return
                    try {
                      const res = await projectsAPI.deleteProjectAttachment(token, f.id, a.fileName)
                      const doc = projectDocFromApiResponse(res)
                      if (doc) {
                        const row = mapApiTaskToOpsRow(doc)
                        setF(normalizeOpsProjectForm(row))
                        onProjectPatched?.(row)
                      }
                      showToast?.(lt('opsModalRemovedTitle'), a.originalName || '')
                    } catch {
                      showToast?.(lt('error'), lt('opsModalDeleteFailed'))
                    }
                  }}
                  style={{ ...B.ghost, ...B.sm }}
                >
                  {lt('opsModalRemove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {isEdit && onArchive && !initial?.archivedAt && (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => onArchive(f)} style={{ ...B.warn, ...B.sm }}>
            {lt('opsModalArchive')}
          </button>
        </div>
      )}
      {isEdit && f.id && onAddProgress && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{lt('opsModalProgressHeading')}</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedComments.length === 0 && <div style={{ fontSize: 11, color: C.t4 }}>{lt('opsModalNoProgressYet')}</div>}
            {sortedComments.map((c, i) => (
              <div
                key={c._id || `${c.createdAt}-${i}`}
                style={{ fontSize: 11, background: 'rgba(0,0,0,.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}
              >
                <div style={{ fontWeight: 700, color: C.t2, marginBottom: 2 }}>{c.author || lt('opsModalDash')}</div>
                <div style={{ fontSize: 10, color: C.t4, marginBottom: 4 }}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                <div style={{ color: C.t3, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{c.text}</div>
              </div>
            ))}
          </div>
          <ML>{lt('opsModalAddProgressLabel')}</ML>
          <MTA value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder={lt('opsModalProgressPlaceholder')} />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              disabled={progressBusy || !progressNote.trim()}
              onClick={handleAddProgress}
              style={{ ...B.pri, ...B.sm, opacity: progressBusy || !progressNote.trim() ? 0.5 : 1 }}
            >
              {progressBusy ? lt('saving') : lt('opsModalLogProgress')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ModalIncident({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, desc:initial.res||'' } : { route:'Route KAZ-1 (Primary)', sev:'High', type:'Route Breach', vendor:'SecureForce KZ', desc:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Incident' : 'Report Security Incident'} sub={isEdit ? 'Update incident record' : 'Log a new security incident on a transport route'} onClose={onClose} onSave={() => onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Submit Incident'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Route</ML><MS value={f.route} onChange={s('route')}>{['Route KAZ-1 (Primary)','Route KAZ-2 (Alternate)','Route AIR-1','Route RAIL-1'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Severity</ML><MS value={f.sev} onChange={s('sev')}>{['Critical','High','Medium','Low'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Incident Type</ML><MS value={f.type} onChange={s('type')}>{['Route Breach','Escort Delay','Unauthorized Access','Vehicle Breakdown','Documentation Issue'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Security Vendor</ML><MS value={f.vendor} onChange={s('vendor')}>{['SecureForce KZ','AlphaGuard Ltd','Internal'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Description</ML><MTA value={f.desc} onChange={s('desc')} placeholder="Describe what happened..." />
    </Modal>
  )
}

// ─── Extra Modals ──────────────────────────────────────────────────────────────
function ModalGoldChannel({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, vol:String(initial.vol), actual:String(initial.actual) } : { name:'', region:'', vol:'', actual:'', stage:'Contract Signed', cst:'Active', comp:'No', officer:'', risk:'Low', nextAction:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Gold Channel' : 'Add Gold Channel'} sub="Confidential — gold sourcing channel" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Channel'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Channel Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Altyn Partners" /></div>
        <div><ML>Region</ML><MI value={f.region} onChange={s('region')} placeholder="e.g. East KZ" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Volume Target (kg)</ML><MI type="number" value={f.vol} onChange={s('vol')} placeholder="0" /></div>
        <div><ML>Actual Volume (kg)</ML><MI type="number" value={f.actual} onChange={s('actual')} placeholder="0" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Stage</ML><MS value={f.stage} onChange={s('stage')}>{['Contract Signed','Final Negotiation','MoU Stage','On Hold'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Contract Status</ML><MS value={f.cst} onChange={s('cst')}>{['Active','Pending','Draft','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Risk Level</ML><MS value={f.risk} onChange={s('risk')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Compliance</ML><MS value={f.comp} onChange={s('comp')}>{['Yes','No'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Officer</ML><MI value={f.officer} onChange={s('officer')} placeholder="Officer name" /></div>
        <div><ML>Next Action</ML><MI value={f.nextAction} onChange={s('nextAction')} placeholder="Next steps" /></div>
      </div>
    </Modal>
  )
}

function ModalRoute({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', origin:'', dest:'', carrier:'', mode:'Road', eta:'', st:'Active', risk:'Low', notes:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Route' : 'Add Route'} sub="Transport route configuration" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Route'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Route Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Route KAZ-3" /></div>
        <div><ML>Mode</ML><MS value={f.mode} onChange={s('mode')}>{['Road','Air','Rail','Sea'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Origin</ML><MI value={f.origin} onChange={s('origin')} placeholder="Origin city/hub" /></div>
        <div><ML>Destination</ML><MI value={f.dest} onChange={s('dest')} placeholder="Destination" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Carrier</ML><MI value={f.carrier} onChange={s('carrier')} placeholder="Carrier name" /></div>
        <div><ML>ETA</ML><MI value={f.eta} onChange={s('eta')} placeholder="e.g. 6 hrs" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Active','On Hold','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Risk Level</ML><MS value={f.risk} onChange={s('risk')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Notes</ML><MTA value={f.notes} onChange={s('notes')} placeholder="Security notes, special instructions..." />
    </Modal>
  )
}

function ModalSecVendor({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { vendor:'', proto:'Pending Review', escort:'Pending', threat:'Medium', route:'', nextRev:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Security Vendor' : 'Add Security Vendor'} sub="Security vendor protocol and escort details" onClose={onClose} onSave={() => f.vendor.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Vendor'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Vendor Name</ML><MI value={f.vendor} onChange={s('vendor')} placeholder="Security company" /></div>
        <div><ML>Protocol Status</ML><MS value={f.proto} onChange={s('proto')}>{['Approved','Pending Review','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Escort</ML><MS value={f.escort} onChange={s('escort')}>{['Yes','Pending','No'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Threat Level</ML><MS value={f.threat} onChange={s('threat')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Assigned Routes</ML><MI value={f.route} onChange={s('route')} placeholder="e.g. KAZ-1, AIR-1" /></div>
        <div><ML>Next Review Date</ML><input type="date" value={f.nextRev||''} onChange={s('nextRev')} style={IS} /></div>
      </div>
    </Modal>
  )
}

function ModalVendor({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, rating:String(initial.rating||3) } : { name:'', svc:'', val:'', signed:'No', exp:'', terms:'Net 30', mgr:'', rating:'3', renewal:'Active' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Vendor' : 'Add Vendor'} sub="Vendor contract details" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Vendor'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Vendor Name</ML><MI value={f.name} onChange={s('name')} placeholder="Company name" /></div>
        <div><ML>Service</ML><MI value={f.svc} onChange={s('svc')} placeholder="e.g. Road Freight" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Contract Value</ML><MI value={f.val} onChange={s('val')} placeholder="e.g. $50,000" /></div>
        <div><ML>Signed</ML><MS value={f.signed} onChange={s('signed')}>{['Yes','No','Pending'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Expiry Date</ML><input type="date" value={f.exp||''} onChange={s('exp')} style={IS} /></div>
        <div><ML>Payment Terms</ML><MI value={f.terms} onChange={s('terms')} placeholder="e.g. Net 30" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Account Manager</ML><MI value={f.mgr} onChange={s('mgr')} placeholder="Name" /></div>
        <div><ML>Rating (1-5)</ML><MS value={f.rating} onChange={s('rating')}>{['1','2','3','4','5'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Renewal Status</ML><MS value={f.renewal} onChange={s('renewal')}>{['Active','Renewal Due','Under Negotiation'].map(o=><option key={o}>{o}</option>)}</MS>
    </Modal>
  )
}

function ModalInventoryItem({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, stock:String(initial.stock), min:String(initial.min) } : { item:'', stock:'0', min:'0', sup:'', last:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'} sub="Stock item and supplier details" onClose={onClose} onSave={() => f.item.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Item'}>
      <div><ML>Item Name</ML><MI value={f.item} onChange={s('item')} placeholder="Item description" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Current Stock (units)</ML><MI type="number" value={f.stock} onChange={s('stock')} min="0" /></div>
        <div><ML>Minimum Level (units)</ML><MI type="number" value={f.min} onChange={s('min')} min="0" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Supplier</ML><MI value={f.sup} onChange={s('sup')} placeholder="Supplier name" /></div>
        <div><ML>Last Restocked</ML><input type="date" value={f.last||''} onChange={s('last')} style={IS} /></div>
      </div>
    </Modal>
  )
}

function ModalChecklistItem({ onClose, onSave }) {
  const [f, setF] = useState({ item:'', assign:'', due:'', st:'In Progress' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  return (
    <Modal title="Add Checklist Item" sub="Add a new readiness checklist item" onClose={onClose} onSave={() => f.item.trim() && onSave(f)} saveLabel="Add Item">
      <div><ML>Checklist Item</ML><MI value={f.item} onChange={s('item')} placeholder="Item description" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Assigned To</ML><MI value={f.assign} onChange={s('assign')} placeholder="Team member" /></div>
        <div><ML>Due Date</ML><MI value={f.due} onChange={s('due')} placeholder="e.g. Apr 30" /></div>
      </div>
      <ML>Initial Status</ML><MS value={f.st} onChange={s('st')}>{['In Progress','Blocked','To Do'].map(o=><option key={o}>{o}</option>)}</MS>
    </Modal>
  )
}

// ─── Notifications Panel ────────────────────────────────────────────────────────
function NotifPanel({ notifs, setNotifs, onClose }) {
  const unread = notifs.filter(n => !n.read).length
  const lvCfg = { crit:{ color:C.red, border:C.red }, high:{ color:C.orange, border:C.orange }, med:{ color:C.yellow, border:C.yellow }, suc:{ color:C.green, border:C.green } }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:890 }} />
      <div style={{ position:'fixed', top:0, right:0, width:390, height:'100vh', background:'#ffffff', borderLeft:`1px solid ${C.border2}`, zIndex:900, display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,.15)' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8f9fa' }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.t1, display:'flex', alignItems:'center', gap:8 }}>
            🔔 Operations Alerts
            {unread > 0 && <span style={{ background:C.red, color:'#fff', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>{unread} new</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {notifs.map(n => {
            const cf = lvCfg[n.lv] || lvCfg.med
            return (
              <div key={n.id} style={{ background:n.read?'rgba(255,255,255,.01)':'rgba(255,255,255,.03)', border:`1px solid rgba(255,255,255,.05)`, borderLeft:`3px solid ${cf.border}`, borderRadius:9, padding:'11px 13px', marginBottom:7, opacity:n.read?.5:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:cf.color, marginBottom:3 }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.t3, lineHeight:1.5, marginBottom:6 }}>{n.desc}</div>
                <div style={{ fontSize:10, color:C.t4, marginBottom:8 }}>{n.time}</div>
                <div style={{ display:'flex', gap:5 }}>
                  {!n.read && <button onClick={() => setNotifs(p => p.map(x => x.id===n.id ? {...x,read:true} : x))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(0,200,150,.12)', color:C.green, fontFamily:'inherit' }}>✓ Acknowledge</button>}
                  <button onClick={() => setNotifs(p => p.filter(x => x.id !== n.id))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,255,255,.06)', color:C.t3, fontFamily:'inherit' }}>✕ Dismiss</button>
                </div>
              </div>
            )
          })}
          {!notifs.length && <div style={{ textAlign:'center', padding:40, color:C.t4 }}>🔔<br/>No alerts</div>}
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
export default function OperationsTab() {
  const perms = usePermissions()
  const isAdmin    = perms.isSuperAdmin
  const { t } = useLanguage()
  const { token, user } = useAuth()
  const TABS = useMemo(() => getOpsTabs(t), [t])
  const isHead     = perms.isDepartmentHead
  const isMgmt     = perms.isManagement
  const isUser     = perms.isDepartmentUser
  const isExternal = perms.isExternal
  const canEdit    = isAdmin || isHead
  const USE_SEED_DATA = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [activeTab, setActiveTab] = useState('kpi')
  const [suppliers, setSuppliers] = useState(USE_SEED_DATA ? INIT_SUPPLIERS : [])
  const [gold,      setGold]      = useState(USE_SEED_DATA ? INIT_GOLD : [])
  const [routes,    setRoutes]    = useState(USE_SEED_DATA ? INIT_ROUTES : [])
  const [secVendors,setSecVendors]= useState(USE_SEED_DATA ? INIT_SEC_VENDORS : [])
  const [incidents, setIncidents] = useState(USE_SEED_DATA ? INIT_INCIDENTS : [])
  const [vendors,   setVendors]   = useState(USE_SEED_DATA ? INIT_VENDORS : [])
  const [inventory, setInventory] = useState(USE_SEED_DATA ? INIT_INVENTORY : [])

    const invToRow = item => ({
      id:    item._id || item.id,
      item:  item.name || item.item,
      stock: item.quantity ?? item.stock ?? 0,
      min:   item.minThreshold ?? item.min ?? 0,
      sup:   item.supplierName || item.sup || '—',
      last:  item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : (item.last || '—'),
      st:    item.quantity === 0 || item.stock === 0 ? 'Critical' : (item.quantity || item.stock || 0) <= (item.minThreshold || item.min || 0) ? 'Low Stock' : 'Sufficient',
    })

    const loadInventory = useCallback(async () => {
      try {
        const res = await erpAPI.getInventory(token)
        const items = res.items || res.data || []
        if (items.length > 0) setInventory(items.map(invToRow))
      } catch { /* keep current state */ }
    }, [token])

    useEffect(() => { loadInventory() }, [loadInventory])
  const [tasks, setTasks] = useState([])
  const [showArchivedOpsProjects, setShowArchivedOpsProjects] = useState(false)
  const [taskAssignees, setTaskAssignees] = useState([])

  const loadOpsProjects = useCallback(async () => {
    if (!token) return []
    try {
      const data = await projectsAPI.getProjects(token)
      const list = data.projects ?? data.tasks ?? []
      const arr = Array.isArray(list) ? list : []
      const ops = arr.filter((t) => String(t.department || '').toLowerCase() === OPS_PROJECTS_DEPT)
      const rows = ops.map(mapApiTaskToOpsRow)
      setTasks(rows)
      return rows
    } catch {
      setTasks([])
      return []
    }
  }, [token])

  useEffect(() => { loadOpsProjects() }, [loadOpsProjects])

  const loadProjectAssignees = useCallback(async () => {
    if (!token) return
    try {
      const isSuperAdmin = user?.role === 'super_admin'
      const [usersRes, employeesRes] = await Promise.allSettled([
        isSuperAdmin ? authAPI.getUsers(token) : Promise.resolve({ users: [] }),
        hrAPI.getEmployees(token),
      ])
      const userList =
        usersRes.status === 'fulfilled' ? (usersRes.value.users || []).map((u) => ({ id: u.id || u._id, name: u.name, department: u.department || '' })) : []
      const employeeList =
        employeesRes.status === 'fulfilled' ? (employeesRes.value.employees || []).map((e) => ({ id: e._id, name: e.name, department: e.department || '' })) : []
      const taskNames = Array.from(new Set(tasks.map((t) => t.assign).filter(Boolean))).map((name) => ({ id: name, name, department: '' }))
      const merged = [...userList, ...employeeList, ...taskNames]
      const uniqueByName = []
      const seen = new Set()
      merged.forEach((p) => {
        const key = (p.name || '').toLowerCase().trim()
        if (!key || seen.has(key)) return
        seen.add(key)
        uniqueByName.push(p)
      })
      setTaskAssignees(uniqueByName)
    } catch {
      setTaskAssignees([])
    }
  }, [token, user?.role, tasks])

  useEffect(() => {
    if (token && activeTab === 'projects') loadProjectAssignees()
  }, [token, activeTab, loadProjectAssignees])

  const assigneeGroups = useMemo(() => {
    if (!taskAssignees.length) return []
    return [{ label: 'Team', options: taskAssignees.map((a) => ({ value: String(a.id), label: a.name })) }]
  }, [taskAssignees])
  const [checklist, setChecklist] = useState(USE_SEED_DATA ? INIT_CHECKLIST : [])
  const [notifs,    setNotifs]    = useState(USE_SEED_DATA ? INIT_NOTIFS : [])
  const [modal,     setModal]     = useState({ type:null, data:null })
  const [notifOpen, setNotifOpen] = useState(false)
  const [toast,     setToast]     = useState(null)

  const closeModal = () => setModal({ type:null, data:null })

  function showToast(title, msg) {
    setToast({ title, msg })
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => setToast(null), 3200)
  }

  function addSupplier(f) {
    setSuppliers(p => [...p, { id:Date.now(), name:f.name.trim(), cat:f.cat, od:f.od||'—', ed:f.ed||'—', ad:'—', qty:f.qty||'—', qr:'0', pay:'Not Paid', qc:'Pending', st:f.st, notes:f.notes||'—' }])
    closeModal(); showToast('Supplier Added', f.name.trim() + ' added to supply chain')
  }
  function editSupplier(f) {
    setSuppliers(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Supplier Updated', f.name + ' updated')
  }
  async function createOpsProject(f) {
    try {
      const res = await projectsAPI.createProject(token, buildOpsCreatePayload(f))
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        await loadOpsProjects()
        closeModal()
        showToast('Project added', `${f.title.trim()} added`)
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => [row, ...p])
      closeModal()
      showToast('Project added', `${f.title.trim()} added`)
    } catch {
      showToast('Error', 'Failed to create project')
    }
  }
  async function updateOpsProject(f) {
    try {
      const res = await projectsAPI.updateProject(token, f.id, buildOpsUpdatePayload(f))
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        await loadOpsProjects()
        closeModal()
        showToast('Project updated', `${f.title} updated`)
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
      closeModal()
      showToast('Project updated', `${f.title} updated`)
    } catch {
      showToast('Error', 'Failed to update project')
    }
  }

  const canDeleteOpsProject = (row) => {
    const taskApi = row?._api
    if (!taskApi) return false
    if (isAdmin || isHead) return true
    const createdByMe =
      (taskApi.createdById && taskApi.createdById === user?.id) ||
      String(taskApi.createdBy || '').toLowerCase() === String(user?.name || '').toLowerCase()
    return isUser && createdByMe
  }

  async function deleteOpsProject(row) {
    if (!window.confirm(`Delete project "${row.title}"?`)) return
    try {
      await projectsAPI.deleteProject(token, row.id)
      setTasks((p) => p.filter((x) => x.id !== row.id))
      closeModal()
      showToast('Deleted', 'Project removed')
    } catch {
      showToast('Error', 'Failed to delete project')
    }
  }

  async function addOpsProjectProgress(taskId, text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    try {
      const res = await projectsAPI.addProjectComment(token, taskId, trimmed)
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        const rows = await loadOpsProjects()
        const row = rows.find((r) => String(r.id) === String(taskId))
        if (row) {
          setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === taskId ? { type: 'project-edit', data: row } : prev))
        }
        showToast('Progress logged', 'Update saved')
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
      setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === taskId ? { type: 'project-edit', data: row } : prev))
      showToast('Progress logged', 'Update saved')
    } catch (e) {
      showToast('Error', 'Failed to add progress update')
      throw e
    }
  }

  function mergeOpsProjectPatched(row) {
    setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
    setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === row.id ? { type: 'project-edit', data: row } : prev))
  }

  async function unarchiveOpsProjectRow(row) {
    if (!row?.id || !window.confirm(`${t('opsUnarchiveConfirm')} "${row.title}"?`)) return
    try {
      await projectsAPI.updateProject(token, row.id, {
        archivedAt: null,
        notifyText: `${user?.name || 'User'} restored ${row.title} from archive`,
      })
      await loadOpsProjects()
      setModal((prev) => (prev.data?.id === row.id ? { type: null, data: null } : prev))
      showToast(t('opsUnarchiveToastTitle'), row.title)
    } catch {
      showToast('Error', 'Failed to unarchive')
    }
  }

  async function archiveOpsProjectRow(row) {
    if (!row?.id || !window.confirm(`Archive project "${row.title}"?`)) return
    try {
      await projectsAPI.updateProject(token, row.id, {
        archivedAt: new Date().toISOString(),
        notifyText: `${user?.name || 'User'} archived ${row.title}`,
      })
      await loadOpsProjects()
      setModal((prev) => (prev.data?.id === row.id ? { type: null, data: null } : prev))
      showToast('Archived', row.title)
    } catch {
      showToast('Error', 'Failed to archive')
    }
  }
  function addIncident(f) {
    const newInc = { id:`INC-${String(incidents.length+4).padStart(3,'0')}`, date:'Today', route:f.route, vendor:f.vendor, type:f.type, sev:f.sev, st:'Open', res:f.desc||'Under review' }
    setIncidents(p => [newInc, ...p])
    setNotifs(p => [{ id:'INN'+Date.now(), lv:'crit', read:false, title:`🔴 New Incident Reported — ${f.route}`, desc:`${f.type} incident (${f.sev}) reported on ${f.route}. Immediate investigation required.`, time:'Just now' }, ...p])
    closeModal(); showToast('Incident Reported', `${f.type} on ${f.route} — security team notified`)
  }
  function editIncident(f) {
    setIncidents(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Incident Updated', f.id + ' updated')
  }
  function addGold(f) {
    setGold(p => [...p, { id:Date.now(), code:`GS-${String(p.length+5).padStart(3,'0')}`, name:f.name, vol:Number(f.vol)||0, actual:Number(f.actual)||0, stage:f.stage, cst:f.cst, comp:f.comp, officer:f.officer||'—', region:f.region, risk:f.risk, lastAct:'Today', nextAction:f.nextAction||'—' }])
    closeModal(); showToast('Channel Added', f.name + ' added')
  }
  function editGold(f) {
    setGold(p => p.map(x => x.id===f.id ? { ...x, ...f, vol:Number(f.vol)||0, actual:Number(f.actual)||0 } : x))
    closeModal(); showToast('Channel Updated', f.name + ' updated')
  }
  function addRoute(f) {
    setRoutes(p => [...p, { id:Date.now(), name:f.name, origin:f.origin, dest:f.dest, carrier:f.carrier, mode:f.mode, eta:f.eta, st:f.st, risk:f.risk, lastInc:'None', insurance:'Active', gps:'Active', checkpoints:'0/0', notes:f.notes||'—' }])
    closeModal(); showToast('Route Added', f.name + ' added')
  }
  function editRoute(f) {
    setRoutes(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Route Updated', f.name + ' updated')
  }
  function addSecVendor(f) {
    setSecVendors(p => [...p, { id:Date.now(), vendor:f.vendor, proto:f.proto, escort:f.escort, lastRev:'Today', nextRev:f.nextRev||'—', incidents:0, threat:f.threat, route:f.route }])
    closeModal(); showToast('Security Vendor Added', f.vendor + ' added')
  }
  function editSecVendor(f) {
    setSecVendors(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Vendor Updated', f.vendor + ' updated')
  }
  function addVendor(f) {
    setVendors(p => [...p, { id:Date.now(), name:f.name, svc:f.svc, val:f.val||'—', signed:f.signed, exp:f.exp||'—', terms:f.terms||'TBD', mgr:f.mgr||'—', rating:Number(f.rating)||3, renewal:f.renewal, days:null }])
    closeModal(); showToast('Vendor Added', f.name + ' added')
  }
  function editVendor(f) {
    setVendors(p => p.map(x => x.id===f.id ? { ...x, ...f, rating:Number(f.rating)||x.rating } : x))
    closeModal(); showToast('Vendor Updated', f.name + ' updated')
  }
  function addInventoryItem(f) {
    const stock = Number(f.stock)||0, min = Number(f.min)||0
    const payload = { name: f.item, quantity: stock, minThreshold: min, supplierName: f.sup || '', unit: 'units' }
    erpAPI.createInventoryItem(token, payload)
      .then(res => { setInventory(p => [...p, invToRow(res.item || res.data || { ...payload, _id: Date.now() })]); closeModal(); showToast('Item Added', f.item + ' added to inventory') })
      .catch(() => showToast('Error', 'Failed to add inventory item'))
  }
  function editInventoryItem(f) {
    const stock = Number(f.stock)||0, min = Number(f.min)||0
    const payload = { name: f.item, quantity: stock, minThreshold: min, supplierName: f.sup || '' }
    erpAPI.updateInventoryItem(token, f.id, payload)
      .then(() => { setInventory(p => p.map(x => x.id===f.id ? invToRow({ ...x, ...payload, _id: f.id, updatedAt: new Date().toISOString() }) : x)); closeModal(); showToast('Item Updated', f.item + ' updated') })
      .catch(() => showToast('Error', 'Failed to update inventory item'))
  }
  async function deleteInventoryItem(row) {
    if (!window.confirm(`Delete ${row.item}?`)) return
    try {
      await erpAPI.deleteInventoryItem(token, row.id)
      setInventory(p => p.filter(x => x.id !== row.id))
      showToast('Deleted', `${row.item} removed`)
    } catch {
      showToast('Error', 'Failed to delete item')
    }
  }
  function addChecklistItem(f) {
    setChecklist(p => [...p, { item:f.item, assign:f.assign||'—', st:f.st||'In Progress', due:f.due||'—', by:'—', ts:'—' }])
    closeModal(); showToast('Item Added', f.item + ' added to checklist')
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const shared = { suppliers, setSuppliers, gold, setGold, routes, setRoutes, secVendors, setSecVendors, incidents, setIncidents, vendors, setVendors, inventory, setInventory, tasks, setTasks, checklist, setChecklist, canEdit, isAdmin, isHead, isMgmt, isUser, isExternal, showToast, setModal, onDeleteOpsProject: deleteOpsProject, canDeleteOpsProject }

  return (
    <ModuleTabColumn style={{ fontFamily: 'inherit', color: C.t1 }}>
      <style>{`
        @keyframes tabPingOps { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <ModuleSubTabRow
        right={(
          <button onClick={() => setNotifOpen(true)} style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--purple-rgb),.1)', border: '1px solid rgba(var(--purple-rgb),.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 17, flexShrink: 0 }}>
            🔔
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f3f4f6' }}>{unreadCount}</span>}
          </button>
        )}
      >
        {TABS.map((t) => (
          <ErpSubTabButton key={t.id} active={t.id === activeTab} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </ErpSubTabButton>
        ))}
      </ModuleSubTabRow>

      {activeTab === 'kpi'       && <TabKPI       {...shared} />}
      {activeTab === 'checklist' && <TabChecklist  {...shared} />}
      {activeTab === 'supply'    && <TabSupply     {...shared} onOpenAdd={() => setModal({ type:'supplier-add', data:null })} />}
      {activeTab === 'gold'      && <TabGold       {...shared} />}
      {activeTab === 'routes'    && <TabRoutes     {...shared} onOpenIncident={() => setModal({ type:'incident-add', data:null })} />}
      {activeTab === 'security'  && <TabSecurity   {...shared} onOpenIncident={() => setModal({ type:'incident-add', data:null })} />}
      {activeTab === 'vendors'   && <TabVendors    {...shared} onOpenAdd={() => setModal({ type:'vendor-add', data:null })} />}
      {activeTab === 'inventory' && <TabInventory  {...shared} onDeleteInventory={deleteInventoryItem} />}
      {activeTab === 'legal-docs' && <TabLegalDocuments {...shared} />}
      {activeTab === 'map'       && <TabMap        {...shared} />}
      {activeTab === 'analytics' && <TabAnalytics  {...shared} />}
      {activeTab === 'projects'     && (
        <TabProjects
          {...shared}
          showArchived={showArchivedOpsProjects}
          setShowArchived={setShowArchivedOpsProjects}
          onOpenAdd={() => setModal({ type: 'project-add', data: null })}
          onArchiveProject={archiveOpsProjectRow}
          onUnarchiveProject={unarchiveOpsProjectRow}
        />
      )}

      {modal.type === 'supplier-add'   && <ModalSupplier      onClose={closeModal} onSave={addSupplier} />}
      {modal.type === 'supplier-edit'  && <ModalSupplier      initial={modal.data} onClose={closeModal} onSave={editSupplier} />}
      {modal.type === 'project-add'       && (
        <ModalProject
          key={`ops-project-add-${modal.data ? JSON.stringify(modal.data) : 'empty'}`}
          initial={modal.data}
          onClose={closeModal}
          onSave={createOpsProject}
          assigneeGroups={assigneeGroups}
          isDepartmentUser={isUser}
          allOpsProjects={tasks}
          token={token}
          showToast={showToast}
        />
      )}
      {modal.type === 'project-edit'      && (
        <ModalProject
          key={`ops-project-edit-${modal.data?.id}-${(modal.data?.comments || []).length}`}
          initial={modal.data}
          onClose={closeModal}
          onSave={updateOpsProject}
          onAddProgress={addOpsProjectProgress}
          assigneeGroups={assigneeGroups}
          isDepartmentUser={isUser}
          allOpsProjects={tasks}
          token={token}
          showToast={showToast}
          onProjectPatched={mergeOpsProjectPatched}
          onArchive={(ff) => archiveOpsProjectRow({ id: ff.id, title: ff.title })}
          onUnarchive={(ff) => unarchiveOpsProjectRow({ id: ff.id, title: ff.title })}
        />
      )}
      {modal.type === 'incident-add'   && <ModalIncident      onClose={closeModal} onSave={addIncident} />}
      {modal.type === 'incident-edit'  && <ModalIncident      initial={modal.data} onClose={closeModal} onSave={editIncident} />}
      {modal.type === 'gold-add'       && <ModalGoldChannel   onClose={closeModal} onSave={addGold} />}
      {modal.type === 'gold-edit'      && <ModalGoldChannel   initial={modal.data} onClose={closeModal} onSave={editGold} />}
      {modal.type === 'route-add'      && <ModalRoute         onClose={closeModal} onSave={addRoute} />}
      {modal.type === 'route-edit'     && <ModalRoute         initial={modal.data} onClose={closeModal} onSave={editRoute} />}
      {modal.type === 'secvendor-add'  && <ModalSecVendor     onClose={closeModal} onSave={addSecVendor} />}
      {modal.type === 'secvendor-edit' && <ModalSecVendor     initial={modal.data} onClose={closeModal} onSave={editSecVendor} />}
      {modal.type === 'vendor-add'     && <ModalVendor        onClose={closeModal} onSave={addVendor} />}
      {modal.type === 'vendor-edit'    && <ModalVendor        initial={modal.data} onClose={closeModal} onSave={editVendor} />}
      {modal.type === 'inventory-add'  && <ModalInventoryItem onClose={closeModal} onSave={addInventoryItem} />}
      {modal.type === 'inventory-edit' && <ModalInventoryItem initial={modal.data} onClose={closeModal} onSave={editInventoryItem} />}
      {modal.type === 'checklist-add'  && <ModalChecklistItem onClose={closeModal} onSave={addChecklistItem} />}

      {notifOpen && <NotifPanel notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />}

      <Toast t={toast} />
    </ModuleTabColumn>
  )
}
