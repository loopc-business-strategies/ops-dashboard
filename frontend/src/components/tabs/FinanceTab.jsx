// FILE: src/components/tabs/FinanceTab.jsx
// Finance & Accounts — 11 sub-tabs, 8 finance roles, full role-based access

import { useState, useMemo, useEffect, useRef } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import financeAPI from '../../api/finance'
import erpAccountingAPI from '../../api/erp-accounting'

// ─── Design tokens ────────────────────────────────────────────
const C = {
  grad:   'var(--grad-brand)',
  gbar:   'var(--grad-bar)',
  gfin:   'var(--grad-brand)',
  green:  '#065f46', cyan:   '#00b4d8', yellow: '#ffd600',
  orange: '#9a3412', red:    '#ff4757', gold:   '#f59e0b',
  t1:'#1c2a33', t2:'#374151', t3:'#334155', t4:'#475569',
  border: 'rgba(var(--purple-rgb),0.15)', border2:'rgba(var(--purple-rgb),0.35)',
  card:'#ffffff', inp:'#f8f9fa',
}

const B = {
  pri:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:'var(--grad-brand)', color:'#fff', boxShadow:'0 4px 15px rgba(var(--purple-rgb),.35)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sec:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'var(--purple)', border:'1px solid var(--purple)', whiteSpace:'nowrap', fontFamily:'inherit' },
  ghost: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'#475569', border:`1px solid rgba(var(--purple-rgb),0.15)`, whiteSpace:'nowrap', fontFamily:'inherit' },
  succ:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(0,200,150,0.15)', color:'#065f46', border:'1px solid rgba(0,200,150,0.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sm:    { padding:'5px 11px', fontSize:11 },
}

// ─── Sub-tabs ─────────────────────────────────────────────────
function getFinanceTabs(t) {
  return [
    { id:'kpi',     label:`📊 ${t('kpiOverview')}` },
    { id:'revenue', label:`💰 ${t('revenue')}` },
    { id:'expense', label:`💸 ${t('expenses')}` },
    { id:'invoice', label:`📄 ${t('invoices')}` },
    { id:'budget',  label:`📅 ${t('budget')}` },
    { id:'payroll', label:`👥 ${t('payroll')}` },
    { id:'arpa',    label:`🏦 ${t('arAp')}` },
    { id:'gold',    label:`🪙 ${t('goldTracker')}` },
    { id:'tax',     label:`📑 ${t('tax')}` },
    { id:'reports', label:`📈 ${t('reports')}` },
    { id:'ledger',  label:`📕 ${t('generalLedger')}` },
    { id:'audit',   label:`🔍 ${t('auditTrail')}` },
  ]
}

// ─── Seed data ────────────────────────────────────────────────
const INIT_INVOICES = [
  { id:'INV-2026-041', client:'KazGold Distributors',  type:'Sales',    amount:2900000, issue:'Apr 1, 2026',  due:'May 1, 2026',  status:'Sent',    daysOverdue:0  },
  { id:'INV-2026-040', client:'Tashkent Trading Co',   type:'Sales',    amount:1450000, issue:'Mar 15, 2026', due:'Apr 14, 2026', status:'Overdue', daysOverdue:29 },
  { id:'INV-2026-039', client:'SecureForce KZ',        type:'Purchase', amount:180000,  issue:'Mar 1, 2026',  due:'Mar 31, 2026', status:'Paid',    daysOverdue:0  },
  { id:'INV-2026-038', client:'KazTrans LLC',          type:'Purchase', amount:95000,   issue:'Mar 5, 2026',  due:'Apr 4, 2026',  status:'Overdue', daysOverdue:9  },
  { id:'INV-2026-037', client:'Moscow Metals Ltd',     type:'Sales',    amount:3480000, issue:'Feb 20, 2026', due:'Mar 20, 2026', status:'Paid',    daysOverdue:0  },
  { id:'INV-2026-036', client:'Dubai Commodity House', type:'Sales',    amount:1740000, issue:'Apr 10, 2026', due:'May 10, 2026', status:'Draft',   daysOverdue:0  },
]

const INIT_EXPENSES = [
  { id:'EXP-091', date:'Apr 10, 2026', dept:'Operations', cat:'Transport',   amount:42000,  by:'Omar Khan',  status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-090', date:'Apr 9, 2026',  dept:'Sales',      cat:'Marketing',   amount:15000,  by:'Layla S.',   status:'Pending',      approvedBy:'—',       flagged:true  },
  { id:'EXP-089', date:'Apr 8, 2026',  dept:'HR',         cat:'Salaries',    amount:284600, by:'Fatima N.',  status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-088', date:'Apr 7, 2026',  dept:'Compliance', cat:'Compliance',  amount:8500,   by:'Sara A.',    status:'Under Review', approvedBy:'—',       flagged:false },
  { id:'EXP-087', date:'Apr 5, 2026',  dept:'Production', cat:'Maintenance', amount:42600,  by:'Ali H.',     status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-086', date:'Apr 3, 2026',  dept:'Admin',      cat:'Admin',       amount:12000,  by:'spr',        status:'Rejected',     approvedBy:'Omar F.', flagged:true  },
]

const INIT_PAYROLL = [
  { emp:'Ahmad Yusuf',    dept:'Production', role:'Operator',  basic:3200, allow:800,  ded:320, net:3680, status:'Pending',   date:'Apr 30' },
  { emp:'Zara Malik',     dept:'Quality',    role:'Inspector', basic:3800, allow:950,  ded:380, net:4370, status:'Pending',   date:'Apr 30' },
  { emp:'Hassan Ali',     dept:'Production', role:'Operator',  basic:3200, allow:800,  ded:320, net:3680, status:'Pending',   date:'Apr 30' },
  { emp:'Nadia Khan',     dept:'Training',   role:'Trainer',   basic:4200, allow:1050, ded:420, net:4830, status:'Pending',   date:'Apr 30' },
  { emp:'Omar Khan',      dept:'Operations', role:'Logistics', basic:4500, allow:1125, ded:450, net:5175, status:'Processed', date:'Mar 31' },
  { emp:'Layla Siddiqui', dept:'Sales',      role:'Sales Rep', basic:4000, allow:1800, ded:400, net:5400, status:'Processed', date:'Mar 31' },
]

const BUDGETS = [
  { dept:'Production',             annual:1800000, spent:892000, status:'On Track' },
  { dept:'HR & Hiring',            annual:420000,  spent:341000, status:'Warning'  },
  { dept:'Sales & Marketing',      annual:280000,  spent:178000, status:'On Track' },
  { dept:'Operations & Logistics', annual:650000,  spent:394000, status:'On Track' },
  { dept:'Compliance & Legal',     annual:220000,  spent:142000, status:'On Track' },
  { dept:'Finance & Admin',        annual:180000,  spent:156000, status:'Warning'  },
  { dept:'Training',               annual:95000,   spent:38000,  status:'On Track' },
]

const RECEIVABLES = [
  { client:'KazGold Distributors',  inv:'INV-2026-041', amount:2900000, due:'May 1, 2026',  overdue:0,  status:'Current' },
  { client:'Tashkent Trading Co',   inv:'INV-2026-040', amount:1450000, due:'Apr 14, 2026', overdue:29, status:'Overdue' },
  { client:'Dubai Commodity House', inv:'INV-2026-036', amount:1740000, due:'May 10, 2026', overdue:0,  status:'Current' },
]

const PAYABLES = [
  { vendor:'KazTrans LLC',      inv:'INV-2026-038', amount:95000, due:'Apr 4, 2026',  pstatus:'Overdue'   },
  { vendor:'AlphaGuard Ltd',    inv:'PINV-031',     amount:75000, due:'Apr 20, 2026', pstatus:'Pending'   },
  { vendor:'ChemEx Corp',       inv:'PINV-030',     amount:42000, due:'Apr 28, 2026', pstatus:'Pending'   },
  { vendor:'KAZ Equipment Svc', inv:'PINV-029',     amount:28000, due:'May 1, 2026',  pstatus:'Scheduled' },
]

const TAXES = [
  { type:'Corporate Tax',      period:'Q1 2026',  amount:282500, due:'Apr 30, 2026', filed:'—',             status:'Due Soon' },
  { type:'VAT',                period:'Mar 2026', amount:48000,  due:'Apr 15, 2026', filed:'Apr 13, 2026',  status:'Filed'    },
  { type:'Withholding Tax',    period:'Mar 2026', amount:28400,  due:'Apr 15, 2026', filed:'Apr 14, 2026',  status:'Filed'    },
  { type:'Import Duty (Gold)', period:'Q1 2026',  amount:72000,  due:'Apr 30, 2026', filed:'—',             status:'Pending'  },
]

const INIT_AUDIT = [
  { action:'Invoice Created',     user:'Omar F.', urole:'Finance Manager', amount:'$2,900,000', dt:'Apr 13 10:32 AM', ip:'192.168.1.12', before:'—',       after:'INV-2026-041 Created' },
  { action:'Expense Approved',    user:'Omar F.', urole:'Finance Manager', amount:'$42,000',    dt:'Apr 13 09:15 AM', ip:'192.168.1.12', before:'Pending', after:'Approved'             },
  { action:'Invoice Marked Paid', user:'spr',     urole:'Super Admin',     amount:'$3,480,000', dt:'Apr 10 02:00 PM', ip:'192.168.1.1',  before:'Sent',    after:'Paid'                 },
  { action:'Payroll Run',         user:'Omar F.', urole:'Finance Manager', amount:'$284,600',   dt:'Mar 31 09:00 AM', ip:'192.168.1.12', before:'Pending', after:'Processed'            },
  { action:'Budget Increased',    user:'spr',     urole:'Super Admin',     amount:'+$50,000',   dt:'Mar 28 11:30 AM', ip:'192.168.1.1',  before:'$400k',   after:'$450k'                },
  { action:'Expense Rejected',    user:'Omar F.', urole:'Finance Manager', amount:'$12,000',    dt:'Apr 5 03:20 PM',  ip:'192.168.1.12', before:'Pending', after:'Rejected'             },
]

const INIT_NOTIFS = [
  { id:'FN1', lv:'crit', read:false, title:'🔴 Invoice INV-2026-040 Overdue 29 Days',   desc:'Tashkent Trading Co owes $1,450,000. 29 days past due. Auto-escalated.',  time:'Today',     roles:['superadmin','fin_mgr','auditor']              },
  { id:'FN2', lv:'high', read:false, title:'🟠 Large Expense Needs Approval — $15,000', desc:'Sales submitted $15,000 marketing expense. Above $10,000 threshold.',    time:'1 hr ago',  roles:['superadmin','fin_mgr']                        },
  { id:'FN3', lv:'med',  read:false, title:'🟡 Corporate Tax Due in 17 Days',           desc:'Q1 2026 Corporate Tax of $282,500 due Apr 30. Not yet filed.',            time:'2 hrs ago', roles:['superadmin','fin_mgr','auditor']              },
  { id:'FN4', lv:'med',  read:false, title:'🟡 HR Budget at 81% Utilization',           desc:'HR & Hiring has used 81% of annual budget with 8 months remaining.',     time:'Today',     roles:['superadmin','fin_mgr']                        },
  { id:'FN5', lv:'info', read:true,  title:'🔵 New Invoice Draft Pending Review',       desc:'INV-2026-036 for Dubai Commodity House ($1,740,000) awaiting FM review.', time:'Yesterday', roles:['superadmin','fin_mgr','fin_analyst','auditor'] },
  { id:'FN6', lv:'suc',  read:true,  title:'🟢 Payment Received — $3,480,000',         desc:'Moscow Metals Ltd paid INV-2026-037 in full. Revenue updated.',           time:'Apr 10',    roles:['superadmin','fin_mgr','sales_head','auditor']  },
]

// ─── Helpers ──────────────────────────────────────────────────
function fmt(n)      { return n>=1000000 ? '$'+(n/1000000).toFixed(2)+'M' : n>=1000 ? '$'+(n/1000).toFixed(0)+'k' : '$'+n.toLocaleString() }
function fmtFull(n)  { return '$'+Number(n).toLocaleString() }
function pct(v,t)    { return Math.max(0,Math.min(100,Math.round((v/t)*100))) }

// ─── Shared UI ────────────────────────────────────────────────
function Badge({ status }) {
  const V = {
    Confirmed:     ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Paid:          ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Approved:      ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Filed:         ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    'On Track':    ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Processed:     ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Sent:          ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Current:       ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    'Under Review':['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Scheduled:     ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Pending:       ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    'Due Soon':    ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    Warning:       ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    Draft:         ['rgba(255,255,255,.05)','#475569','rgba(255,255,255,.1)'],
    Overdue:       ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    Rejected:      ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    'Over Budget': ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    Disputed:      ['rgba(255,112,67,.12)','#9a3412','rgba(255,112,67,.3)'],
  }
  const [bg,color,border] = V[status] || ['rgba(255,255,255,.05)','#475569','rgba(255,255,255,.1)']
  return <span style={{ display:'inline-flex', alignItems:'center', borderRadius:999, padding:'4px 12px', fontSize:11, fontWeight:700, whiteSpace:'nowrap', background:bg, color, border:`1px solid ${border}` }}>{status}</span>
}

function Td({ children, style={} }) {
  return <td style={{ padding:'11px 14px', fontSize:'12.5px', color:C.t2, verticalAlign:'middle', ...style }}>{children}</td>
}

function Card({ title, titleRight, children, style={} }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 18px', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      {title && (
        <div style={{ fontSize:13, fontWeight:800, color:C.t1, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{title}</span>{titleRight}
        </div>
      )}
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, color=C.t1, progress, children }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', position:'relative', overflow:'hidden', cursor:'default' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.t3, marginTop:7, display:'flex', alignItems:'center', gap:5 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1, height:6, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
            <div style={{ width:`${progress}%`, height:'100%', borderRadius:999, background:C.gfin }} />
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:C.t1, width:34, textAlign:'right' }}>{progress}%</span>
        </div>
      )}
      {children}
    </div>
  )
}

function SectionHeader({ title, sub, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display:'flex', gap:8, flexShrink:0 }}>{children}</div>}
    </div>
  )
}

function Restricted({ msg }) {
  return (
    <div style={{ background:'rgba(255,71,87,.07)', border:'1px solid rgba(255,71,87,.18)', borderRadius:10, padding:'13px 16px', fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:20 }}>🔒</span>{msg}
    </div>
  )
}

function PieLegend({ items }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {items.map((item,i) => (
        <div key={i}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:item.color, flexShrink:0 }} />
            <div style={{ flex:1, color:C.t2 }}>{item.label}</div>
            <div style={{ fontWeight:700, color:item.color }}>{item.pct}%</div>
          </div>
          <div style={{ marginLeft:18, marginTop:2, marginBottom:2 }}>
            <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:`${item.pct}%`, height:'100%', background:item.color, borderRadius:999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgressRow({ label, value, max, color=C.gbar, valLabel }) {
  const p = pct(value,max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
      <div style={{ width:190, color:C.t2, fontWeight:500, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ flex:1, height:7, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:999, background:color }} />
      </div>
      <div style={{ width:50, textAlign:'right', fontWeight:700, color:C.t1 }}>{valLabel || `${p}%`}</div>
    </div>
  )
}

function InlineBar({ value, max, color=C.gfin }) {
  const p = pct(value,max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:999, background:color }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color: p>=80?C.yellow:C.t1, width:34, textAlign:'right' }}>{p}%</span>
    </div>
  )
}

function DataTable({ title, sub, toolbar, headers, children }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
      {(title||toolbar) && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{title}</div>
            {sub && <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{sub}</div>}
          </div>
          {toolbar}
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f0faf5' }}>
              {headers.map((h,i) => (
                <th key={i} style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Modal primitives ─────────────────────────────────────────
function ModalOverlay({ open, onClose, title, sub, children, wide=false }) {
  if (!open) return null
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width:wide?700:560, maxWidth:'94%', maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:C.grad, borderRadius:'14px 0 0 14px' }} />
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer', padding:4 }}>✕</button>
        <h3 style={{ fontSize:17, fontWeight:800, color:C.t1, marginBottom:4 }}>{title}</h3>
        {sub && <div style={{ fontSize:12, color:C.t3, marginBottom:18 }}>{sub}</div>}
        {children}
      </div>
    </div>
  )
}

const iStyle = { width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(var(--purple-rgb),.25)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1c2a33', fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' }
function ML({ children }) { return <span style={{ display:'block', fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{children}</span> }
function M2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>{children}</div> }
function MBtns({ onCancel, onSubmit, submitLabel='Submit', submitStyle }) {
  return (
    <div style={{ display:'flex', gap:8, marginTop:4 }}>
      <button onClick={onCancel} style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Cancel</button>
      <button onClick={onSubmit} style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:submitStyle||C.grad, color:'#fff' }}>{submitLabel}</button>
    </div>
  )
}

// ─── Invoice Modal ────────────────────────────────────────────
function InvoiceModal({ open, onClose, onSubmit, onToast }) {
  const [f, setF] = useState({ type:'Sales Invoice (Receivable)', client:'', qty:'', price:'', fee:'', tax:'10', due:'', terms:'Net 30' })
  const [calc, setCalc] = useState(null)
  const upd = k => e => setF(p=>({...p,[k]:e.target.value}))

  function doCalc() {
    const sub = (parseFloat(f.qty)||0)*(parseFloat(f.price)||0)+(parseFloat(f.fee)||0)
    const taxAmt = sub*((parseFloat(f.tax)||0)/100)
    setCalc({ sub, taxAmt, total:sub+taxAmt })
  }
  function doSubmit() {
    if (!f.client.trim()) { onToast('Error','Please enter client / vendor name'); return }
    onSubmit(f, calc)
    setF({ type:'Sales Invoice (Receivable)', client:'', qty:'', price:'', fee:'', tax:'10', due:'', terms:'Net 30' })
    setCalc(null); onClose()
  }

  return (
    <ModalOverlay open={open} onClose={() => { onClose(); setCalc(null) }} title="Create Invoice" sub="Generate a sales or purchase invoice" wide>
      <M2>
        <div><ML>Invoice Type</ML><select value={f.type} onChange={upd('type')} style={iStyle}><option>Sales Invoice (Receivable)</option><option>Purchase Invoice (Payable)</option></select></div>
        <div><ML>Client / Vendor</ML><input value={f.client} onChange={upd('client')} placeholder="e.g. KazGold Distributors" style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Gold Quantity (kg)</ML><input type="number" value={f.qty} onChange={upd('qty')} placeholder="e.g. 50" style={iStyle} /></div>
        <div><ML>Price per kg ($)</ML><input type="number" value={f.price} onChange={upd('price')} placeholder="e.g. 58000" style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Service Fee ($)</ML><input type="number" value={f.fee} onChange={upd('fee')} placeholder="0" style={iStyle} /></div>
        <div><ML>Tax Rate (%)</ML><input type="number" value={f.tax} onChange={upd('tax')} style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Due Date</ML><input type="date" value={f.due} onChange={upd('due')} style={iStyle} /></div>
        <div><ML>Payment Terms</ML><select value={f.terms} onChange={upd('terms')} style={iStyle}><option>Net 30</option><option>Net 60</option><option>Due on Receipt</option><option>Net 15</option></select></div>
      </M2>
      {calc && (
        <div style={{ background:'rgba(var(--purple-rgb),.08)', border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:13, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', color:C.t3 }}><span>Subtotal</span><span>{fmtFull(calc.sub)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:C.t3, marginTop:4 }}><span>Tax</span><span>{fmtFull(calc.taxAmt)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:C.t1, fontWeight:800, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}><span>Total</span><span style={{ color:C.green }}>{fmtFull(calc.total)}</span></div>
        </div>
      )}
      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(0,0,0,0.1)', background:'#f3f4f6', color:C.t2 }}>Cancel</button>
        <button onClick={doCalc} style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(0,180,216,.12)', color:C.cyan }}>Calculate</button>
        <button onClick={doSubmit} style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>Create Invoice</button>
      </div>
    </ModalOverlay>
  )
}

// ─── Expense Modal ────────────────────────────────────────────
function ExpenseModal({ open, onClose, onSubmit }) {
  const [f, setF] = useState({ dept:'Operations', cat:'Transport', amount:'', date:'', desc:'' })
  const upd = k => e => setF(p=>({...p,[k]:e.target.value}))
  const flagged = parseFloat(f.amount) >= 10000

  function doSubmit() {
    onSubmit({ ...f, amount:parseFloat(f.amount)||0, flagged })
    setF({ dept:'Operations', cat:'Transport', amount:'', date:'', desc:'' })
    onClose()
  }

  return (
    <ModalOverlay open={open} onClose={onClose} title="Submit Expense" sub="Submit an expense for Finance Manager approval">
      <M2>
        <div><ML>Department</ML><select value={f.dept} onChange={upd('dept')} style={iStyle}>{['Operations','HR','Sales','Compliance','Production','Finance'].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><ML>Category</ML><select value={f.cat} onChange={upd('cat')} style={iStyle}>{['Transport','Salaries','Marketing','Admin','Compliance','Maintenance','Other'].map(c=><option key={c}>{c}</option>)}</select></div>
      </M2>
      <M2>
        <div><ML>Amount ($)</ML><input type="number" value={f.amount} onChange={upd('amount')} placeholder="e.g. 5000" style={iStyle} /></div>
        <div><ML>Date</ML><input type="date" value={f.date} onChange={upd('date')} style={iStyle} /></div>
      </M2>
      {flagged && <div style={{ background:'rgba(255,71,87,.1)', border:'1px solid rgba(255,71,87,.25)', borderRadius:10, padding:'10px 14px', fontSize:12, color:C.red, marginBottom:12 }}>⚠️ Expenses above $10,000 require Finance Manager approval and will be auto-flagged.</div>}
      <ML>Description</ML>
      <textarea value={f.desc} onChange={upd('desc')} placeholder="Describe the expense..." style={{ ...iStyle, resize:'vertical', minHeight:65 }} />
      <MBtns onCancel={onClose} onSubmit={doSubmit} submitLabel="Submit Expense" />
    </ModalOverlay>
  )
}

// ─── Payroll Modal ────────────────────────────────────────────
function PayrollModal({ open, onClose, onRun }) {
  const [auth, setAuth] = useState('')
  const [bank, setBank] = useState('Main Operations Account')

  return (
    <ModalOverlay open={open} onClose={onClose} title="Run Payroll — April 2026" sub="Confirm payroll processing for all active employees">
      <div style={{ background:'rgba(0,200,150,.08)', border:'1px solid rgba(0,200,150,.2)', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
        {[['Total Employees','47',C.t1],['Total Net Pay','$284,600',C.green],['Payment Date','Apr 30, 2026',C.t1]].map(([l,v,c])=>(
          <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
            <span style={{ color:C.t2 }}>{l}</span><span style={{ color:c, fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>
      <M2>
        <div><ML>Authorised By</ML><input value={auth} onChange={e=>setAuth(e.target.value)} placeholder="Your name" style={iStyle} /></div>
        <div><ML>Bank Account</ML><select value={bank} onChange={e=>setBank(e.target.value)} style={iStyle}><option>Main Operations Account</option><option>Payroll Dedicated Account</option></select></div>
      </M2>
      <MBtns onCancel={onClose} onSubmit={() => { onRun(auth,bank); setAuth(''); onClose() }} submitLabel="✓ Confirm & Run Payroll" submitStyle="linear-gradient(135deg,#00c896,#00b4d8)" />
    </ModalOverlay>
  )
}

// ─── Budget Request Modal ─────────────────────────────────────
function BudgetModal({ open, onClose, onSubmit }) {
  const [dept, setDept] = useState('')
  const [amt,  setAmt]  = useState('')
  const [why,  setWhy]  = useState('')

  return (
    <ModalOverlay open={open} onClose={onClose} title="Request Budget Increase" sub="Submit a budget increase request for Finance Manager approval">
      <M2>
        <div><ML>Department</ML><input value={dept} onChange={e=>setDept(e.target.value)} placeholder="Your department" style={iStyle} /></div>
        <div><ML>Amount Requested ($)</ML><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="e.g. 50000" style={iStyle} /></div>
      </M2>
      <ML>Justification</ML>
      <textarea value={why} onChange={e=>setWhy(e.target.value)} placeholder="Explain why additional budget is needed..." style={{ ...iStyle, resize:'vertical', minHeight:65 }} />
      {/* 3-step workflow */}
      <div style={{ display:'flex', alignItems:'center', margin:'14px 0', gap:0 }}>
        {[{n:1,l:'Dept Head\nSubmits',a:true},{n:2,l:'Finance Mgr\nReviews',a:false},{n:3,l:'Super Admin\nApproves',a:false}].map((s,i,arr) => (
          <div key={i} style={{ display:'contents' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, minWidth:70 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, background:s.a?'var(--purple)':'rgba(255,255,255,.1)', color:s.a?'#fff':C.t3, boxShadow:s.a?'0 0 0 3px rgba(var(--purple-rgb),.3)':'none' }}>{s.n}</div>
              <div style={{ fontSize:10, color:C.t3, marginTop:4, textAlign:'center', whiteSpace:'pre-line' }}>{s.l}</div>
            </div>
            {i < arr.length-1 && <div style={{ flex:1, height:2, background:'rgba(255,255,255,.1)', marginBottom:16 }} />}
          </div>
        ))}
      </div>
      <MBtns onCancel={onClose} onSubmit={() => { onSubmit(dept,parseFloat(amt)||0); setDept(''); setAmt(''); setWhy(''); onClose() }} submitLabel="Submit Request" />
    </ModalOverlay>
  )
}

// ─── Finance Notifications Panel (reuses overrides.css classes) ──
function NotificationsPanel({ open, onClose, notifications, onAck, onDismiss, onMarkAllRead, onClearRead }) {
  const unread = notifications.filter(n => !n.read).length
  const lvColor = { crit:C.red, high:C.orange, med:C.yellow, info:C.cyan, suc:C.green }

  return (
    <>
      <div className={`notif-overlay${open?' open':''}`} onClick={onClose} />
      <div className={`notif-panel${open?' open':''}`}>
        <div className="np-header">
          <div className="np-title">
            🔔 Finance Alerts
            {unread > 0 && <span className="np-title-badge">{unread} new</span>}
          </div>
          <button className="np-close" onClick={onClose}>✕</button>
        </div>
        <div className="np-body">
          {notifications.length === 0
            ? <div className="np-empty">No alerts for your role</div>
            : notifications.map(n => (
              <div key={n.id} className={`np-item ${n.lv}`} style={{ opacity:n.read?0.6:1 }}>
                <div className="np-item-head">
                  <div className="np-item-title" style={{ color:lvColor[n.lv]||C.t2 }}>{n.title}</div>
                  <div className="np-item-time">{n.time}</div>
                </div>
                <div className="np-item-desc">{n.desc}</div>
                <div className="np-item-actions">
                  {!n.read && <button className="np-action-btn np-btn-ack" onClick={() => onAck(n.id)}>✓ Acknowledge</button>}
                  <button className="np-action-btn np-btn-esc">↑ Escalate</button>
                  <button className="np-action-btn np-btn-dis" onClick={() => onDismiss(n.id)}>✕ Dismiss</button>
                </div>
              </div>
            ))
          }
        </div>
        <div className="np-footer">
          <button className="np-footer-btn pri" onClick={onMarkAllRead}>✓ Mark all read</button>
          <button className="np-footer-btn sec" onClick={onClearRead}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── KPI Overview ────────────────────────────────────────────
function KPIOverview({ finRole, can, canEdit, invoices, openModal, onToast }) {
  if (can('vendor')) return <Restricted msg="Financial KPIs are not available to vendors. Please contact your account manager." />

  const isHR    = finRole === 'hr_mgr'
  const isSales = finRole === 'sales_head'
  const isDept  = finRole === 'dept_head'

  return (
    <div className="space-y-4">
      <SectionHeader title="Financial KPI Overview" sub="Year to date · April 2026">
        {(canEdit() || finRole==='auditor') && <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Export PDF','Generating PDF report...')}>⬇ Export PDF</button>}
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openModal('invoice')}>+ Create Invoice</button>}
      </SectionHeader>

      {isHR && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Total Payroll This Month" value="$284,600" color={C.cyan} sub="47 employees" />
          <StatCard label="Payroll vs Budget" value="94%" color={C.green} sub="Within HR budget" />
          <StatCard label="Next Payroll Date" value="Apr 30" color="var(--purple)" sub="17 days away" />
        </div>
      )}
      {isSales && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Total Revenue YTD" value="$2.45M" color={C.green} sub={<span style={{color:C.green,fontWeight:700}}>↑12% YoY</span>} />
          <StatCard label="Gold Sales Revenue" value="$1.89M" color={C.gold} sub="77% of total" />
          <StatCard label="Accounts Receivable" value="$6.09M" color={C.yellow} sub={<><span style={{color:C.red}}>●</span> $1.45M overdue</>} />
        </div>
      )}
      {isDept && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Your Dept Budget" value="$650,000" color={C.cyan} sub="Operations & Logistics" />
          <StatCard label="Spent to Date" value="$394,000" color={C.t1} sub="61% utilized" />
          <StatCard label="Remaining" value="$256,000" color={C.green} sub="On Track" />
        </div>
      )}
      {!isHR && !isSales && !isDept && (<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Total Revenue YTD"   value="$2.45M" color={C.green}  sub={<span style={{color:C.green,fontWeight:700}}>↑12% YoY</span>} />
          <StatCard label="Operating Expenses"  value="$1.32M" color={C.red}    sub={<span style={{color:C.red,fontWeight:700}}>↑8% YoY</span>} />
          <StatCard label="Net Profit"          value="$1.13M" color={C.green}  sub={<span style={{color:C.green,fontWeight:700}}>↑15% YoY</span>} />
          <StatCard label="Cash Flow"           value="$890k"  color={C.cyan}   sub={<span style={{color:C.green,fontWeight:700}}>↑18% YoY</span>} />
          <StatCard label="Gross Margin"        value="46.1%"  color="var(--purple)"  sub="(Rev−COGS)/Rev" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Accounts Receivable" value="$6.09M" color={C.yellow} sub={<><span style={{color:C.red}}>●</span> $1.45M overdue</>} />
          <StatCard label="Accounts Payable"    value="$240k"  color={C.orange} sub={<><span style={{color:C.orange}}>●</span> $95k overdue</>} />
          <StatCard label="Budget Utilization"  value="58%"    color={C.cyan}   progress={58} />
          <StatCard label="Gold Sales Revenue"  value="$1.89M" color={C.gold}   sub="77% of total revenue" />
          <StatCard label="Pending Approvals"   value={<>3 <span style={{background:'rgba(255,71,87,.12)',color:C.red,border:'1px solid rgba(255,71,87,.3)',borderRadius:999,fontSize:9,padding:'2px 8px',marginLeft:4}}>Urgent</span></>} color={C.red} sub="Invoices & expenses" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Card title="Revenue vs Expenses (Last 6 Months)">
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
              {[{m:'Nov',r:180,e:115},{m:'Dec',r:210,e:128},{m:'Jan',r:195,e:120},{m:'Feb',r:225,e:132},{m:'Mar',r:240,e:138},{m:'Apr',r:195,e:110}].map((d,i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:4 }}>
                  <div style={{ display:'flex', gap:2, alignItems:'flex-end', width:'100%' }}>
                    <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:d.r*0.5, background:'linear-gradient(180deg,#00c896,#00b4d8)' }} />
                    <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:d.e*0.5, background:'linear-gradient(180deg,var(--purple),var(--purple-light))' }} />
                  </div>
                  <div style={{ fontSize:9, color:C.t3, fontWeight:600 }}>{d.m}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:14, marginTop:8, fontSize:11 }}>
              <span><span style={{ display:'inline-block', width:10, height:10, background:C.green, borderRadius:2, marginRight:5 }} />Revenue</span>
              <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--purple)', borderRadius:2, marginRight:5 }} />Expenses</span>
            </div>
          </Card>
          <Card title="Revenue by Source">
            <PieLegend items={[
              { label:'Gold Sales',    pct:77, color:C.gold   },
              { label:'Partner Deals', pct:12, color:'var(--purple)' },
              { label:'Service Fees',  pct:7,  color:C.cyan   },
              { label:'Other Income',  pct:4,  color:C.t3     },
            ]} />
          </Card>
        </div>
      </>)}
    </div>
  )
}

// ─── Revenue Tracking ─────────────────────────────────────────
function RevenueTracking({ finRole, can, canEdit, onToast }) {
  if (can('vendor','hr_mgr','dept_head')) return <Restricted msg="Revenue tracking is restricted. Contact Finance department for enquiries." />
  const salesOnly = finRole === 'sales_head'

  return (
    <div className="space-y-4">
      <SectionHeader title="Revenue Tracking" sub={salesOnly ? 'Market view only' : 'All revenue streams'}>
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Excel','Generating Excel report...')}>⬇ Excel</button>
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('PDF','Generating PDF report...')}>⬇ PDF</button>
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Revenue YTD"   value="$2.45M" color={C.green}  sub={<span style={{color:C.green,fontWeight:700}}>↑12% vs last year</span>} />
        <StatCard label="This Month"          value="$195k"  color={C.cyan}   sub={<><span style={{color:C.yellow}}>●</span> Target: $250k</>} />
        <StatCard label="Target Attainment"   value="78%"    color={C.yellow} sub="April target" />
        <StatCard label="Confirmed Revenue"   value="$1.98M" color={C.green}  sub="Received & confirmed" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
        <Card title="Monthly Revenue — Last 12 Months">
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:110 }}>
            {[{m:'M',v:165},{m:'J',v:142},{m:'J',v:188},{m:'A',v:175},{m:'S',v:210},{m:'O',v:228},{m:'N',v:180},{m:'D',v:210},{m:'J',v:195},{m:'F',v:225},{m:'M',v:240},{m:'A',v:195}].map((d,i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ width:'100%', borderRadius:'4px 4px 0 0', height:d.v*0.45, background:i===11?'linear-gradient(180deg,#00c896,#00b4d8)':'rgba(0,200,150,0.35)' }} />
                <div style={{ fontSize:9, color:C.t3 }}>{d.m}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Revenue by Region">
          <PieLegend items={[
            { label:'Kazakhstan', pct:38, color:'var(--purple)' },
            { label:'UAE',        pct:22, color:C.cyan   },
            { label:'Uzbekistan', pct:18, color:C.green  },
            { label:'Russia',     pct:14, color:C.yellow },
            { label:'Other',      pct:8,  color:C.t3     },
          ]} />
        </Card>
      </div>
      <DataTable title="Revenue Register" sub="All confirmed and pending revenue entries" headers={['Transaction ID','Date','Source','Market','Amount','Status',!salesOnly&&!can('fin_analyst','auditor')?'Recorded By':''].filter(Boolean)}>
        {[
          { id:'TXN-2026-041', date:'Apr 1, 2026',  source:'Gold Sales', market:'Kazakhstan', amount:2900000, status:'Confirmed', by:'Omar F.' },
          { id:'TXN-2026-040', date:'Mar 15, 2026', source:'Gold Sales', market:'Uzbekistan', amount:1450000, status:'Pending',   by:'Omar F.' },
          { id:'TXN-2026-039', date:'Feb 20, 2026', source:'Gold Sales', market:'Russia',     amount:3480000, status:'Confirmed', by:'spr'     },
          { id:'TXN-2026-038', date:'Apr 10, 2026', source:'Service Fee',market:'UAE',        amount:45000,   status:'Confirmed', by:'Layla S.'},
        ].map((r,i) => (
          <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <Td style={{ fontWeight:700, color:C.t1 }}>{r.id}</Td>
            <Td style={{ color:C.t3 }}>{r.date}</Td>
            <Td>{r.source}</Td><Td>{r.market}</Td>
            <Td style={{ color:r.status==='Confirmed'?C.green:C.yellow, fontWeight:700 }}>{fmtFull(r.amount)}</Td>
            <Td><Badge status={r.status} /></Td>
            {!salesOnly && !can('fin_analyst','auditor') && <Td style={{ color:C.t3 }}>{r.by}</Td>}
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

// ─── Expense Management ───────────────────────────────────────
function ExpenseManagement({ finRole, can, canEdit, expenses, setExpenses, addAudit, onToast, openModal, financeApi }) {
  if (can('vendor','sales_head','hr_mgr')) return <Restricted msg="Expense management is not available for your role." />
  const deptOnly = finRole === 'dept_head'
  const data = deptOnly ? expenses.filter(e=>e.dept==='Operations') : expenses

  function approve(id) {
    setExpenses(p => p.map(e => e.id===id ? {...e, status:'Approved', approvedBy:'You'} : e))
    financeApi.expenses.update(id, { status:'Approved', approvedBy:'You' }).catch(() => {})
    const e = expenses.find(x=>x.id===id)
    addAudit({ action:'Expense Approved', user:'You', urole:'Finance Manager', amount:fmtFull(e?.amount||0), dt:'Now', ip:'192.168.1.x', before:'Pending', after:'Approved' })
    onToast('Approved','Expense '+id+' approved')
  }
  function reject(id) {
    setExpenses(p => p.map(e => e.id===id ? {...e, status:'Rejected', approvedBy:'You'} : e))
    financeApi.expenses.update(id, { status:'Rejected', approvedBy:'You' }).catch(() => {})
    onToast('Rejected','Expense '+id+' rejected')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Expense Management" sub={deptOnly ? 'Your department expenses only' : ''}>
        {can('superadmin','fin_mgr','dept_head') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('expense')}>+ Submit Expense</button>}
        {canEdit() && <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Export','Exporting expenses...')}>⬇ Export</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total This Month"    value="$404,700" color={C.t1}     sub={<span style={{color:C.red,fontWeight:700}}>↑12% vs last month</span>} />
        <StatCard label="Pending Approval"   value="2"        color={C.yellow} sub="Awaiting Finance review" />
        <StatCard label="Flagged (>$10k)"    value="2"        color={C.red}    sub="Auto-flagged for approval" />
        <StatCard label="Approved This Month" value="3"       color={C.green}  sub="$369,200 approved" />
      </div>
      <Card title="Expenses by Department">
        <ProgressRow label="Operations"      value={42000}  max={100000} color={C.gbar} valLabel="$42k"  />
        <ProgressRow label="HR & Payroll"    value={284600} max={400000} color={C.gfin} valLabel="$285k" />
        <ProgressRow label="Sales & Marketing" value={15000} max={100000} color="linear-gradient(90deg,#00c896,#00b4d8)" valLabel={<span style={{color:C.red}}>$15k ⚠</span>} />
        <ProgressRow label="Production"      value={42600}  max={100000} color="linear-gradient(90deg,#ffd600,#9a3412)"  valLabel="$43k"  />
        <ProgressRow label="Compliance"      value={8500}   max={100000} color={C.gbar} valLabel="$8.5k" />
      </Card>
      <DataTable title="Expense Register" headers={['Expense ID','Date','Dept','Category','Amount','Submitted By','Status','Approved By',...(canEdit()?['Actions']:[])]}>
        {data.map((e,i) => {
          const rowBg = e.flagged ? 'rgba(255,214,0,.04)' : e.status==='Rejected' ? 'rgba(255,71,87,.05)' : e.status==='Approved' ? 'rgba(0,200,150,.04)' : (i%2===0?'#ffffff':'#f8f9fa')
          return (
            <tr key={e.id} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {e.id}
                  {e.flagged && <span style={{ background:'rgba(255,71,87,.12)', color:C.red, border:'1px solid rgba(255,71,87,.3)', borderRadius:999, fontSize:9, padding:'2px 6px' }}>⚠ Flagged</span>}
                </div>
              </Td>
              <Td style={{ color:C.t3 }}>{e.date}</Td>
              <Td>{e.dept}</Td><Td>{e.cat}</Td>
              <Td style={{ color:e.amount>10000?C.yellow:C.t2, fontWeight:700 }}>{fmtFull(e.amount)}</Td>
              <Td>{e.by}</Td>
              <Td><Badge status={e.status} /></Td>
              <Td style={{ color:e.approvedBy==='—'?C.t4:C.green }}>{e.approvedBy}</Td>
              {canEdit() && (
                <Td>
                  {(e.status==='Pending'||e.status==='Under Review') && <>
                    <button onClick={() => approve(e.id)} style={{ ...B.link, color:'var(--purple)', marginRight:8 }}>Approve</button>
                    <button onClick={() => reject(e.id)}  style={{ ...B.link, color:C.red }}>Reject</button>
                  </>}
                  {(e.status==='Approved'||e.status==='Rejected') && <span style={{ color:C.t4, fontSize:11 }}>—</span>}
                </Td>
              )}
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

// ─── Invoice Management ───────────────────────────────────────
function InvoiceManagement({ finRole, can, canEdit, invoices, setInvoices, addAudit, onToast, openModal, financeApi }) {
  const myOnly    = finRole === 'vendor'
  const salesOnly = finRole === 'sales_head'
  const data = myOnly ? invoices.filter(i=>i.client.includes('KazTrans')) : salesOnly ? invoices.filter(i=>i.type==='Sales') : invoices

  function markPaid(id) {
    const inv = invoices.find(i=>i.id===id)
    setInvoices(p => p.map(i => i.id===id ? {...i, status:'Paid', daysOverdue:0} : i))
    financeApi.invoices.update(id, { status:'Paid', daysOverdue:0 }).catch(() => {})
    addAudit({ action:'Invoice Marked Paid', user:'You', urole:'Finance Manager', amount:fmtFull(inv?.amount||0), dt:'Now', ip:'192.168.1.x', before:'Sent/Overdue', after:'Paid' })
    onToast('Invoice Paid', id+' marked as paid. Audit log updated.')
  }

  const paid    = invoices.filter(i=>i.status==='Paid').length
  const overdue = invoices.filter(i=>i.status==='Overdue').length
  const pending = invoices.filter(i=>i.status==='Sent'||i.status==='Draft').length

  return (
    <div className="space-y-4">
      <SectionHeader title="Invoice Management" sub={myOnly ? 'Your invoices only' : 'All invoices'}>
        {can('superadmin','fin_mgr','fin_analyst') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('invoice')}>+ Create Invoice</button>}
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Export','Exporting invoices...')}>⬇ Export</button>
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Invoices"  value={invoices.length} color={C.cyan}   sub="This year" />
        <StatCard label="Paid"            value={paid}            color={C.green}  sub="$4.93M collected" />
        <StatCard label="Overdue"         value={overdue}         color={C.red}    sub="$1.545M outstanding" />
        <StatCard label="Pending / Draft" value={pending}         color={C.yellow} sub="Awaiting action" />
      </div>
      <Card title="Aging Report — Outstanding Invoices">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
          {[{l:'0–30 Days',a:'$2.9M',ct:1,c:C.green},{l:'31–60 Days',a:'$1.45M',ct:1,c:C.yellow},{l:'61–90 Days',a:'$0',ct:0,c:C.t4},{l:'90+ Days',a:'$95k',ct:1,c:C.red}].map(a=>(
            <div key={a.l} style={{ background:'rgba(255,255,255,.02)', border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{a.l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:a.c }}>{a.a}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:4 }}>{a.ct} invoice{a.ct!==1?'s':''}</div>
            </div>
          ))}
        </div>
      </Card>
      <DataTable title="Invoice Register" headers={['Invoice ID','Client / Vendor','Type','Amount','Issue Date','Due Date','Status',...(!myOnly?['Actions']:[])]}>
        {data.map((inv,i) => {
          const rowBg = inv.status==='Overdue' ? 'rgba(255,71,87,.05)' : inv.status==='Paid' ? 'rgba(0,200,150,.04)' : (i%2===0?'#ffffff':'#f8f9fa')
          return (
            <tr key={inv.id} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{inv.id}</Td>
              <Td>{inv.client}</Td>
              <Td>
                {inv.type==='Sales'
                  ? <span style={{ background:'rgba(0,180,216,.12)', color:C.cyan, border:'1px solid rgba(0,180,216,.3)', borderRadius:999, padding:'4px 10px', fontSize:11, fontWeight:700 }}>↗ Sales</span>
                  : <span style={{ background:'rgba(var(--purple-rgb),.15)', color:'var(--purple)', border:'1px solid rgba(var(--purple-rgb),.3)', borderRadius:999, padding:'4px 10px', fontSize:11, fontWeight:700 }}>↙ Purchase</span>
                }
              </Td>
              <Td style={{ color:inv.status==='Overdue'?C.red:inv.status==='Paid'?C.green:C.t1, fontWeight:700 }}>{fmtFull(inv.amount)}</Td>
              <Td style={{ color:C.t3 }}>{inv.issue}</Td>
              <Td style={{ color:inv.status==='Overdue'?C.red:C.t3 }}>
                {inv.due}
                {inv.daysOverdue>0 && <span style={{ color:C.red, fontSize:10, marginLeft:4 }}>(+{inv.daysOverdue}d)</span>}
              </Td>
              <Td><Badge status={inv.status} /></Td>
              {!myOnly && (
                <Td style={{ whiteSpace:'nowrap' }}>
                  {(inv.status==='Sent'||inv.status==='Overdue') && <button onClick={() => markPaid(inv.id)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Mark Paid</button>}
                  {inv.status==='Draft' && <button onClick={() => onToast('Invoice Sent',inv.id+' sent to client')} style={{...B.link,color:'var(--purple)',marginRight:8}}>Send</button>}
                  <button onClick={() => onToast('PDF','Generating invoice PDF...')} style={{...B.link,color:'var(--purple)',marginRight:8}}>PDF</button>
                  {inv.status==='Overdue' && <button onClick={() => onToast('Reminder Sent','Payment reminder sent to '+inv.client)} style={{...B.link,color:C.cyan}}>Remind</button>}
                </Td>
              )}
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

// ─── Budget Planning ──────────────────────────────────────────
function BudgetPlanning({ finRole, can, canEdit, onToast, openModal, budgets, setBudgets, financeApi }) {
  if (can('vendor','sales_head','hr_mgr')) return <Restricted msg="Budget planning is not available for your role." />
  const deptOnly = finRole === 'dept_head'
  const data     = deptOnly ? budgets.filter(b=>b.dept==='Operations & Logistics') : budgets
  const totalB   = budgets.reduce((a,b)=>a+b.annual,0)
  const totalS   = budgets.reduce((a,b)=>a+b.spent,0)
  const [budgetModal, setBudgetModal] = useState(false)
  const [editId, setEditId] = useState('')
  const [bf, setBf] = useState({ dept:'', annual:'', spent:'' })

  function openBudgetEditor(row) {
    if (row) {
      setEditId(row.id || row._id?.toString() || '')
      setBf({ dept:row.dept, annual:String(row.annual), spent:String(row.spent) })
    } else {
      setEditId('')
      setBf({ dept:'', annual:'', spent:'' })
    }
    setBudgetModal(true)
  }

  function saveBudget() {
    if (!bf.dept.trim() || !bf.annual) return
    const annual = Number(bf.annual) || 0
    const spent = Number(bf.spent) || 0
    const status = spent > annual ? 'Over Budget' : pct(spent, annual || 1) >= 80 ? 'Warning' : 'On Track'
    const payload = { dept:bf.dept.trim(), annual, spent, status }
    if (editId) {
      setBudgets(p => p.map(x => (x.id || x._id?.toString()) === editId ? { ...x, ...payload } : x))
      financeApi.budgets.update(editId, payload).catch(() => {})
      onToast('Budget Updated', bf.dept.trim() + ' budget updated')
    } else {
      financeApi.budgets.create(payload).then(doc => {
        if (doc) setBudgets(p => [...p, { ...doc, id: doc._id?.toString() || doc.id }])
        else setBudgets(p => [...p, payload])
      }).catch(() => { setBudgets(p => [...p, payload]) })
      onToast('Budget Added', bf.dept.trim() + ' added')
    }
    setBudgetModal(false)
  }

  function deleteBudget(row) {
    if (!window.confirm('Delete budget for ' + row.dept + '?')) return
    const rid = row.id || row._id?.toString()
    setBudgets(p => p.filter(x => (x.id || x._id?.toString()) !== rid))
    if (rid) financeApi.budgets.remove(rid).catch(() => {})
    onToast('Budget Deleted', row.dept + ' budget removed')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Budget Planning" sub="FY 2026 — Annual Budget Overview">
        {finRole==='dept_head' && <button style={{...B.sec,...B.sm}} onClick={() => openModal('budget')}>↑ Request Increase</button>}
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openBudgetEditor(null)}>+ Add / Edit Budgets</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Annual Budget" value={fmt(totalB)} color={C.cyan}  sub="FY 2026" />
        <StatCard label="Spent to Date"       value={fmt(totalS)} color={C.t1}    progress={pct(totalS,totalB)} />
        <StatCard label="Remaining"           value={fmt(totalB-totalS)} color={C.green} sub="259 days remaining FY" />
      </div>
      <DataTable title="Department Budget Table" headers={['Department','Annual Budget','Spent','Remaining','% Used','Status',...(canEdit()?['Actions']:[])]}>
        {data.map((b,i) => {
          const p = pct(b.spent,b.annual)
          const rowBg = b.status==='Over Budget' ? 'rgba(255,71,87,.05)' : b.status==='Warning' ? 'rgba(255,214,0,.04)' : 'rgba(0,200,150,.04)'
          return (
            <tr key={b.dept} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{b.dept}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(b.annual)}</Td>
              <Td>{fmtFull(b.spent)}</Td>
              <Td style={{ color:b.annual-b.spent>0?C.green:C.red, fontWeight:700 }}>{fmtFull(b.annual-b.spent)}</Td>
              <Td><InlineBar value={b.spent} max={b.annual} color={p>=100?C.red:p>=80?C.yellow:C.green} /></Td>
              <Td><Badge status={b.status} /></Td>
              {canEdit() && <Td style={{ whiteSpace:'nowrap' }}>
                <button onClick={() => openBudgetEditor(b)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Edit</button>
                <button onClick={() => deleteBudget(b)} style={{...B.link,color:C.red}}>Del</button>
              </Td>}
            </tr>
          )
        })}
      </DataTable>
      {!deptOnly && (
        <Card title="🪙 Gold Operations Budget — Separate Tracking">
          <ProgressRow label="Gold Procurement"      value={72} max={100} color={C.gold}  valLabel="72%" />
          <ProgressRow label="Transport & Security"  value={60} max={100} color={C.cyan}  valLabel="60%" />
          <ProgressRow label="Refining Costs"        value={45} max={100} color="var(--purple)" valLabel="45%" />
          <ProgressRow label="Compliance Costs"      value={38} max={100} color={C.green} valLabel="38%" />
        </Card>
      )}

      <ModalShell open={budgetModal} title={editId ? 'Edit Budget' : 'Add Budget'} onClose={() => setBudgetModal(false)}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><ML>Department</ML><input value={bf.dept} onChange={e=>setBf(p=>({...p,dept:e.target.value}))} style={iStyle} placeholder="Department" /></div>
          <div><ML>Annual Budget ($)</ML><input type="number" value={bf.annual} onChange={e=>setBf(p=>({...p,annual:e.target.value}))} style={iStyle} /></div>
          <div><ML>Spent to Date ($)</ML><input type="number" value={bf.spent} onChange={e=>setBf(p=>({...p,spent:e.target.value}))} style={iStyle} /></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button style={{ ...B.ghost, flex:1 }} onClick={() => setBudgetModal(false)}>Cancel</button>
          <button style={{ ...B.pri, flex:1 }} onClick={saveBudget}>{editId ? 'Save Changes' : 'Add Budget'}</button>
        </div>
      </ModalShell>
    </div>
  )
}

// ─── Payroll Management ───────────────────────────────────────
function PayrollManagement({ finRole, can, canEdit, payroll, setPayroll, addAudit, onToast, openModal, financeApi }) {
  if (can('vendor','sales_head','dept_head')) return <Restricted msg="Payroll management is restricted to Finance and HR departments." />
  const hrOnly = finRole === 'hr_mgr'

  function runPayroll() {
    setPayroll(p => p.map(e => ({...e, status:'Processed'})))
    payroll.filter(e => e.status !== 'Processed').forEach(e => {
      const rid = e.id || e._id?.toString()
      if (rid) financeApi.payroll.update(rid, { status:'Processed' }).catch(() => {})
    })
    addAudit({ action:'Payroll Run', user:'You', urole:'Finance Manager', amount:'$284,600', dt:'Now', ip:'192.168.1.x', before:'Pending', after:'Processed' })
    onToast('Payroll Processed','April 2026 payroll of $284,600 processed for 47 employees.')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Payroll Management" sub={`April 2026 · ${payroll.length} employees`}>
        {can('superadmin','fin_mgr') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('payroll')}>▶ Run Payroll</button>}
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('PDF','Generating salary slips...')}>⬇ Salary Slips PDF</button>
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Payroll"  value="$284,600" color={C.cyan}   sub="Apr 2026" />
        <StatCard label="Employees"      value="47"       color={C.t1}     sub="All active" />
        <StatCard label="Next Payroll"   value="Apr 30"   color="var(--purple)"  sub="17 days away" />
        <StatCard label="Status">
          <div style={{ marginTop:6 }}><Badge status="Pending" /></div>
          <div style={{ fontSize:11, color:C.t3, marginTop:7 }}>Awaiting Finance approval</div>
        </StatCard>
      </div>
      {hrOnly ? (
        <>
          <div style={{ background:'rgba(255,214,0,.07)', borderLeft:`3px solid ${C.yellow}`, borderRadius:6, padding:'10px 13px' }}>
            <div style={{ fontSize:'12.5px', fontWeight:700, color:C.yellow, marginBottom:3 }}>HR Summary View</div>
            <div style={{ fontSize:'11.5px', color:C.t3 }}>Individual salary details are restricted to Finance. You can see department totals and headcount only.</div>
          </div>
          <Card title="Payroll by Department">
            {[{d:'Production',n:18,t:72000},{d:'Operations',n:8,t:48600},{d:'Sales',n:6,t:38400},{d:'HR',n:4,t:28200},{d:'Finance',n:3,t:26400},{d:'Compliance',n:4,t:32000},{d:'Training',n:4,t:39000}].map(p=>(
              <ProgressRow key={p.d} label={`${p.d} (${p.n})`} value={p.t} max={80000} color={C.gfin} valLabel={fmt(p.t)} />
            ))}
          </Card>
        </>
      ) : (
        <DataTable title="Payroll Register" headers={['Employee','Department','Role','Basic Salary','Allowances','Deductions','Net Pay','Status','Pay Date']}>
          {payroll.map((p,i) => (
            <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{p.emp}</Td>
              <Td>{p.dept}</Td>
              <Td style={{ color:C.t3 }}>{p.role}</Td>
              <Td>{fmtFull(p.basic)}</Td>
              <Td style={{ color:C.green }}>{fmtFull(p.allow)}</Td>
              <Td style={{ color:C.red }}>-{fmtFull(p.ded)}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(p.net)}</Td>
              <Td><Badge status={p.status} /></Td>
              <Td style={{ color:C.t3 }}>{p.date}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

// ─── AR & AP ──────────────────────────────────────────────────
function ARAndAP({ finRole, can, canEdit, onToast, receivables, setReceivables, payables, setPayables }) {
  if (can('vendor','hr_mgr')) return <Restricted msg="Accounts Receivable & Payable is restricted." />
  const payOnly = finRole === 'dept_head'
  const recOnly = finRole === 'sales_head'

  const totalRec    = receivables.reduce((a,r)=>a+r.amount,0)
  const overdueRec  = receivables.filter(r=>r.overdue>0).reduce((a,r)=>a+r.amount,0)
  const totalPay    = payables.reduce((a,p)=>a+p.amount,0)

  return (
    <div className="space-y-4">
      <SectionHeader title="Accounts Receivable & Payable" sub="Money owed to you vs money you owe">
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('AR Report','Generating AR report...')}>⬇ AR Report</button>
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('AP Report','Generating AP report...')}>⬇ AP Report</button>
      </SectionHeader>

      {!payOnly && (
        <Card title={<>Accounts Receivable <span style={{ color:C.green, fontSize:12, fontWeight:600 }}>{fmt(totalRec)} total</span></>}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11, marginBottom:14 }}>
            <StatCard label="Total Receivables" value={fmt(totalRec)}           color={C.green}  />
            <StatCard label="Overdue"           value={fmt(overdueRec)}         color={C.red}    />
            <StatCard label="Current"           value={fmt(totalRec-overdueRec)} color={C.cyan}  />
          </div>
          <DataTable title="" headers={['Client','Invoice','Amount','Due Date','Days Overdue','Status','Action']}>
            {receivables.map((r,i) => (
              <tr key={i} style={{ background:r.overdue>0?'rgba(255,71,87,.05)':'rgba(0,200,150,.04)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <Td style={{ fontWeight:700, color:C.t1 }}>{r.client}</Td>
                <Td style={{ color:C.t3 }}>{r.inv}</Td>
                <Td style={{ color:r.overdue>0?C.red:C.green, fontWeight:700 }}>{fmtFull(r.amount)}</Td>
                <Td style={{ color:C.t3 }}>{r.due}</Td>
                <Td style={{ color:r.overdue>0?C.red:C.green }}>{r.overdue>0?r.overdue+' days':'✓'}</Td>
                <Td><Badge status={r.status} /></Td>
                <Td><button style={{...B.ghost,...B.sm}} onClick={() => onToast('Reminder Sent','Payment reminder sent to '+r.client)}>Send Reminder</button></Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {!recOnly && (
        <Card title={<>Accounts Payable <span style={{ color:C.orange, fontSize:12, fontWeight:600 }}>{fmt(totalPay)} total</span></>}>
          <DataTable title="" headers={['Vendor','Invoice','Amount','Due Date','Status',...(canEdit()?['Action']:[])]}>
            {payables.map((p,i) => (
              <tr key={i} style={{ background:p.pstatus==='Overdue'?'rgba(255,71,87,.05)':(i%2===0?'#ffffff':'#f8f9fa'), borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <Td style={{ fontWeight:700, color:C.t1 }}>{p.vendor}</Td>
                <Td style={{ color:C.t3 }}>{p.inv}</Td>
                <Td style={{ color:p.pstatus==='Overdue'?C.red:C.t1, fontWeight:700 }}>{fmtFull(p.amount)}</Td>
                <Td style={{ color:p.pstatus==='Overdue'?C.red:C.t3 }}>{p.due}</Td>
                <Td><Badge status={p.pstatus} /></Td>
                {canEdit() && <Td><button style={{...B.succ,...B.sm}} onClick={() => { setPayables(prev => prev.map(x => x.inv===p.inv ? {...x, pstatus:'Paid'} : x)); onToast('Marked Paid',p.vendor+' payment of '+fmtFull(p.amount)+' marked as paid') }}>Mark Paid</button></Td>}
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  )
}

// ─── Gold Tracker ─────────────────────────────────────────────
function GoldTracker({ finRole, can, canEdit, onToast }) {
  if (can('vendor','hr_mgr','fin_analyst','dept_head')) return <Restricted msg="Gold Financial Tracker is restricted to Finance Manager and Super Admin." />
  const salesOnly = finRole === 'sales_head'

  return (
    <div className="space-y-4">
      <SectionHeader title="Gold Financial Tracker" sub="Gold-specific financial performance · Q1 2026">
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => onToast('Gold Price','Market price updated to $58,420/kg')}>Update Market Price</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${salesOnly?2:4},minmax(0,1fr))`, gap:11 }}>
        {!salesOnly && <StatCard label="Gold Procurement Cost" value="$1.12M" color={C.orange} sub="This quarter" />}
        <StatCard label="Gold Revenue"      value="$1.89M"  color={C.gold}   sub={<span style={{color:C.green,fontWeight:700}}>↑9% QoQ</span>} />
        {(canEdit()||finRole==='auditor') && <StatCard label="Gold Margin" value="$770k" color={C.green} sub="40.7% margin" />}
        <StatCard label="Market Price / kg" value="$58,420" color="var(--purple)"  sub="Last updated: Today" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card title="Volume vs Revenue — Last 6 Months">
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
            {[{m:'Nov',v:28,r:148},{m:'Dec',v:34,r:183},{m:'Jan',v:32,r:172},{m:'Feb',v:38,r:207},{m:'Mar',v:42,r:235},{m:'Apr',v:35,r:190}].map((d,i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:4 }}>
                <div style={{ display:'flex', gap:2, alignItems:'flex-end', width:'100%' }}>
                  <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:d.v*2, background:'rgba(245,158,11,0.5)' }} />
                  {!salesOnly && <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:d.r*0.35, background:'linear-gradient(180deg,#00c896,#00b4d8)' }} />}
                </div>
                <div style={{ fontSize:9, color:C.t3, fontWeight:600 }}>{d.m}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:14, marginTop:8, fontSize:11 }}>
            <span><span style={{ display:'inline-block', width:10, height:10, background:C.gold, borderRadius:2, marginRight:5, opacity:.5 }} />Volume (kg)</span>
            {!salesOnly && <span><span style={{ display:'inline-block', width:10, height:10, background:C.green, borderRadius:2, marginRight:5 }} />Revenue ($k)</span>}
          </div>
        </Card>
        <Card title="Per-Channel Profitability">
          <DataTable title="" headers={['Channel','Volume',...(!salesOnly?['Cost']:[]),'Revenue',...((canEdit()||finRole==='auditor')?['Margin']:[])]}>
            {[
              { ch:'GCH-01 (Northern Refinery)', vol:'120 kg', cost:'$648k', rev:'$1.02M', margin:'36.5%' },
              { ch:'GCH-04 (West Coast Mine)',   vol:'80 kg',  cost:'$472k', rev:'$870k',  margin:'45.7%' },
            ].map((r,i) => (
              <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <Td style={{ fontWeight:700, color:C.t1 }}>{r.ch}</Td>
                <Td>{r.vol}</Td>
                {!salesOnly && <Td style={{ color:C.orange }}>{r.cost}</Td>}
                <Td style={{ color:C.gold, fontWeight:700 }}>{r.rev}</Td>
                {(canEdit()||finRole==='auditor') && <Td style={{ color:C.green, fontWeight:700 }}>{r.margin}</Td>}
              </tr>
            ))}
          </DataTable>
          {canEdit() && <div style={{ fontSize:11, color:C.t3, marginTop:10, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'var(--purple)', display:'inline-block' }} />Gold Inventory Value: $2.34M (40.2kg in stock × $58,420/kg)</div>}
        </Card>
      </div>
    </div>
  )
}

// ─── Tax & Compliance ─────────────────────────────────────────
function TaxCompliance({ finRole, can, canEdit, onToast, taxes, setTaxes, financeApi }) {
  if (can('vendor','hr_mgr','dept_head','sales_head')) return <Restricted msg="Tax & Compliance Financials are restricted to Finance Manager, Super Admin and Auditor." />

  const [taxModal, setTaxModal] = useState(false)
  const [editId, setEditId] = useState('')
  const [tf, setTf] = useState({ type:'', period:'', amount:'', due:'', filed:'—', status:'Pending' })

  function openTaxForm(row) {
    if (row) {
      setEditId(row.id || row._id?.toString() || '')
      setTf({ type:row.type, period:row.period, amount:String(row.amount), due:row.due, filed:row.filed, status:row.status })
    } else {
      setEditId('')
      setTf({ type:'', period:'', amount:'', due:'', filed:'—', status:'Pending' })
    }
    setTaxModal(true)
  }

  function saveTax() {
    if (!tf.type.trim() || !tf.period.trim() || !tf.amount) return
    const payload = { type:tf.type.trim(), period:tf.period.trim(), amount:Number(tf.amount)||0, due:tf.due||'—', filed:tf.filed||'—', status:tf.status }
    if (editId) {
      setTaxes(p => p.map(x => (x.id || x._id?.toString()) === editId ? { ...x, ...payload } : x))
      financeApi.taxes.update(editId, payload).catch(() => {})
      onToast('Tax Updated', payload.type + ' updated')
    } else {
      financeApi.taxes.create(payload).then(doc => {
        if (doc) setTaxes(p => [{ ...doc, id: doc._id?.toString() || doc.id }, ...p])
        else setTaxes(p => [payload, ...p])
      }).catch(() => { setTaxes(p => [payload, ...p]) })
      onToast('Tax Entry Added', payload.type + ' added')
    }
    setTaxModal(false)
  }

  function deleteTax(row) {
    if (!window.confirm('Delete tax row for ' + row.type + '?')) return
    const rid = row.id || row._id?.toString()
    setTaxes(p => p.filter(x => (x.id || x._id?.toString()) !== rid))
    if (rid) financeApi.taxes.remove(rid).catch(() => {})
    onToast('Tax Deleted', row.type + ' removed')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Tax & Compliance Financials" sub="Q1 2026 · KZ Jurisdiction">
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openTaxForm(null)}>+ File / Add Tax Return</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Tax Liability (Q1)"  value="$430,900" color={C.yellow} sub="All tax types combined" />
        <StatCard label="Tax Paid YTD"        value="$76,400"  color={C.green}  sub="VAT + Withholding filed" />
        <StatCard label="Next Due Date"       value="Apr 30"   color={C.red}    sub="17 days · Corp Tax due" />
        <StatCard label="Compliance Status">
          <div style={{ marginTop:6 }}><Badge status="Due Soon" /></div>
          <div style={{ fontSize:11, color:C.t3, marginTop:7 }}>2 filings pending</div>
        </StatCard>
      </div>
      <Card title="Tax Due Countdown — Corporate Tax">
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          {[{v:'17',l:'Days'},{v:'0',l:'Hours'},{v:'0',l:'Mins'}].map(c => (
            <div key={c.l} style={{ background:'rgba(255,255,255,.05)', borderRadius:10, padding:'8px 12px', textAlign:'center', flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--purple)' }}>{c.v}</div>
              <div style={{ fontSize:9, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginTop:2 }}>{c.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.t3, marginTop:10, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:C.red, display:'inline-block' }} />Corporate Tax $282,500 due April 30, 2026 — not yet filed</div>
      </Card>
      <DataTable title="Tax Register" toolbar={canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openTaxForm(null)}>+ Add Tax Entry</button>}
        headers={['Tax Type','Period','Amount','Due Date','Filed Date','Status',...(canEdit()?['Actions']:[])]}>
        {taxes.map((t,i) => (
          <tr key={i} style={{ background:t.status==='Filed'?'rgba(0,200,150,.04)':'rgba(255,214,0,.04)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <Td style={{ fontWeight:700, color:C.t1 }}>{t.type}</Td>
            <Td style={{ color:C.t3 }}>{t.period}</Td>
            <Td style={{ color:t.status==='Filed'?C.green:C.yellow, fontWeight:700 }}>{fmtFull(t.amount)}</Td>
            <Td style={{ color:t.status==='Due Soon'?C.red:C.t3 }}>{t.due}</Td>
            <Td style={{ color:t.filed==='—'?C.t4:C.green }}>{t.filed}</Td>
            <Td><Badge status={t.status} /></Td>
            {canEdit() && <Td style={{ whiteSpace:'nowrap' }}>
              {t.filed==='—' ? <button onClick={() => { const rid = t.id || t._id?.toString(); setTaxes(p => p.map(x => (x.id||x._id?.toString())===rid ? {...x, filed:'Today', status:'Filed'} : x)); if (rid) financeApi.taxes.update(rid, { filed:'Today', status:'Filed' }).catch(()=>{}); onToast('Filed',t.type+' marked as filed') }} style={{...B.link,color:'var(--purple)',marginRight:8}}>Mark Filed</button> : <span style={{ color:C.t4, marginRight:8 }}>—</span>}
              <button onClick={() => openTaxForm(t)} style={{...B.link,color:C.cyan,marginRight:8}}>Edit</button>
              <button onClick={() => deleteTax(t)} style={{...B.link,color:C.red}}>Del</button>
            </Td>}
          </tr>
        ))}
      </DataTable>

      <ModalShell open={taxModal} title={editId ? 'Edit Tax Entry' : 'Add Tax Entry'} onClose={() => setTaxModal(false)}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><ML>Tax Type</ML><input value={tf.type} onChange={e=>setTf(p=>({...p,type:e.target.value}))} style={iStyle} /></div>
          <div><ML>Period</ML><input value={tf.period} onChange={e=>setTf(p=>({...p,period:e.target.value}))} style={iStyle} placeholder="Q2 2026" /></div>
          <div><ML>Amount ($)</ML><input type="number" value={tf.amount} onChange={e=>setTf(p=>({...p,amount:e.target.value}))} style={iStyle} /></div>
          <div><ML>Due Date</ML><input value={tf.due} onChange={e=>setTf(p=>({...p,due:e.target.value}))} style={iStyle} placeholder="Apr 30, 2026" /></div>
          <div><ML>Filed Date</ML><input value={tf.filed} onChange={e=>setTf(p=>({...p,filed:e.target.value}))} style={iStyle} placeholder="—" /></div>
          <div><ML>Status</ML><select value={tf.status} onChange={e=>setTf(p=>({...p,status:e.target.value}))} style={iStyle}><option>Pending</option><option>Due Soon</option><option>Filed</option></select></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button style={{ ...B.ghost, flex:1 }} onClick={() => setTaxModal(false)}>Cancel</button>
          <button style={{ ...B.pri, flex:1 }} onClick={saveTax}>{editId ? 'Save Changes' : 'Add Entry'}</button>
        </div>
      </ModalShell>
    </div>
  )
}

// ─── Reports & Analytics ──────────────────────────────────────
function ReportsAnalytics({ finRole, can, canEdit, onToast }) {
  if (can('vendor')) return <Restricted msg="Reports are not available to vendors." />

  const allReports = [
    { n:'P&L Statement',             d:'Monthly & annual profit and loss',     ic:'📊', roles:['superadmin','fin_mgr','fin_analyst','auditor'] },
    { n:'Balance Sheet',             d:'Assets vs liabilities snapshot',        ic:'⚖️', roles:['superadmin','fin_mgr','fin_analyst','auditor'] },
    { n:'Cash Flow Statement',       d:'Monthly cash flow analysis',            ic:'💵', roles:['superadmin','fin_mgr','fin_analyst','auditor'] },
    { n:'Department Expense Report', d:'Per-dept spending breakdown',           ic:'🏢', roles:['superadmin','fin_mgr','fin_analyst','dept_head','auditor'] },
    { n:'Gold Operations Report',    d:'Gold procurement, revenue, margin',     ic:'🪙', roles:['superadmin','fin_mgr','auditor'] },
    { n:'Payroll Summary Report',    d:'Monthly payroll by department',         ic:'👥', roles:['superadmin','fin_mgr','hr_mgr','auditor'] },
    { n:'Invoice Aging Report',      d:'Overdue invoices & AR status',          ic:'📄', roles:['superadmin','fin_mgr','fin_analyst','sales_head','auditor'] },
    { n:'Budget vs Actual Report',   d:'Spend vs plan comparison',              ic:'📅', roles:['superadmin','fin_mgr','fin_analyst','dept_head','auditor'] },
    { n:'Revenue Report',            d:'Revenue by source & market',            ic:'💰', roles:['superadmin','fin_mgr','fin_analyst','sales_head','auditor'] },
  ]
  const myReports = allReports.filter(r => r.roles.includes(finRole))

  return (
    <div className="space-y-4">
      <SectionHeader title="Financial Reports & Analytics" sub={`${myReports.length} reports available for your role`}>
        {canEdit() && <button style={{...B.sec,...B.sm}} onClick={() => onToast('Scheduled','Auto-report scheduled — daily 08:00')}>⏰ Schedule Auto-Report</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
        {myReports.map((r,i) => (
          <div key={i} onClick={() => onToast('Generating Report',r.n+' is being generated...')}
            style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:14, cursor:'pointer', position:'relative', overflow:'hidden', transition:'all .15s' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
            <div style={{ fontSize:22, marginBottom:8 }}>{r.ic}</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:4 }}>{r.n}</div>
            <div style={{ fontSize:11, color:C.t3, marginBottom:10 }}>{r.d}</div>
            <div style={{ display:'flex', gap:6 }}>
              <span onClick={e => { e.stopPropagation(); onToast('PDF','Generating '+r.n+' PDF...') }}
                style={{ background:'rgba(0,180,216,.12)', color:C.cyan, border:'1px solid rgba(0,180,216,.3)', borderRadius:999, fontSize:9, padding:'3px 8px', fontWeight:700, cursor:'pointer' }}>⬇ PDF</span>
              <span onClick={e => { e.stopPropagation(); onToast('Excel','Generating '+r.n+' Excel...') }}
                style={{ background:'rgba(var(--purple-rgb),.15)', color:'var(--purple)', border:'1px solid rgba(var(--purple-rgb),.3)', borderRadius:999, fontSize:9, padding:'3px 8px', fontWeight:700, cursor:'pointer' }}>⬇ Excel</span>
            </div>
          </div>
        ))}
      </div>
      <Card title="Revenue vs Expenses Trend — 12 Months">
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
          {[165,142,188,175,210,228,180,210,195,225,240,195].map((v,i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
              <div style={{ display:'flex', gap:1, alignItems:'flex-end', width:'100%' }}>
                <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:v*0.42, background:'rgba(0,200,150,0.55)' }} />
                <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:Math.round(v*0.55), background:'rgba(var(--purple-rgb),0.45)' }} />
              </div>
              <div style={{ fontSize:9, color:C.t3 }}>{['M','J','J','A','S','O','N','D','J','F','M','A'][i]}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── General Ledger Management ────────────────────────────────
function GeneralLedger({ finRole, can, canEdit, onToast, token }) {
  if (can('vendor','hr_mgr','dept_head','sales_head')) return <Restricted msg="General Ledger is restricted to Finance Manager, Super Admin and Auditor." />
  
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    erpAccountingAPI.getLedger(token, { limit: 200 })
      .then(data => {
        const entries = (data.entries || []).map(e => ({
          _id: e._id,
          date: e.date ? new Date(e.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—',
          debitAccount: e.debitAccountId?.accountName || e.debitAccountId || '—',
          creditAccount: e.creditAccountId?.accountName || e.creditAccountId || '—',
          amount: e.amount || 0,
          description: e.description || '',
          status: e.bankReconciled ? 'Reconciled' : (e.isDeleted ? 'Reversed' : 'Posted'),
          _raw: e,
        }))
        setLedgerEntries(entries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])
  
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const pageSize = limit
  const totalPages = Math.ceil(ledgerEntries.length / pageSize)
  const paginatedEntries = ledgerEntries.slice((page - 1) * pageSize, page * pageSize)
  
  const [editModal, setEditModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [formData, setFormData] = useState({ date:'', debitAccount:'', creditAccount:'', amount:'', description:'' })

  function openEditForm(entry) {
    setEditEntry(entry)
    setFormData({
      date: entry.date,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
      amount: String(entry.amount),
      description: entry.description,
    })
    setEditModal(true)
  }

  function saveEntry() {
    if (!formData.date || !formData.debitAccount || !formData.creditAccount || !formData.amount) {
      onToast('Missing Fields', 'Please fill all required fields')
      return
    }
    if (formData.debitAccount === formData.creditAccount) {
      onToast('Invalid Entry', 'Debit and Credit accounts must be different')
      return
    }
    
    setLedgerEntries(p => p.map(e => e._id === editEntry._id 
      ? { ...e, ...formData, amount: Number(formData.amount) }
      : e
    ))
    onToast('Saved', `Ledger entry ${editEntry._id} updated`)
    setEditModal(false)
  }

  function deleteEntry(entry) {
    if (!window.confirm(`Create reversal for ${entry._id}? Original will be marked as reversed.`)) return
    
    // Create reversal entry
    const reversal = {
      _id: `REV-${entry._id}`,
      date: new Date().toISOString().split('T')[0],
      debitAccount: entry.creditAccount,
      creditAccount: entry.debitAccount,
      amount: entry.amount,
      description: `REVERSAL of ${entry._id}: ${entry.description}`,
      status: 'Posted',
    }
    
    setLedgerEntries(p => [reversal, ...p.map(e => e._id === entry._id ? {...e, status:'Reversed'} : e)])
    onToast('Reversed', `Reversal entry created for ${entry._id}`)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="General Ledger" sub="Journal entries and ledger account balances">
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => { setEditEntry(null); setFormData({ date:'', debitAccount:'', creditAccount:'', amount:'', description:'' }); setEditModal(true) }}>+ New Entry</button>}
      </SectionHeader>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Entries" value={ledgerEntries.length} color={C.cyan} sub="This month" />
        <StatCard label="Posted" value={ledgerEntries.filter(e=>e.status==='Posted').length} color={C.green} sub="Ready for closing" />
        <StatCard label="Draft" value={ledgerEntries.filter(e=>e.status==='Draft').length} color={C.yellow} sub="Awaiting posting" />
        <StatCard label="Reversed" value={ledgerEntries.filter(e=>e.status==='Reversed').length} color={C.orange} sub="Audit trail maintained" />
      </div>

      <Card title={`Ledger Entries — Page ${page} of ${totalPages}`}>
        {loading && <div style={{ padding:20, textAlign:'center', color:C.t3, fontSize:13 }}>Loading ledger entries…</div>}
        {!loading && <DataTable title="" headers={['Date','Debit Account','Credit Account','Amount','Description','Status',...(canEdit()?['Actions']:[])]}>
          {paginatedEntries.map((entry,i) => (
            <tr key={entry._id} style={{ background:entry.status==='Reversed'?'rgba(255,71,87,.05)':entry.status==='Draft'?'rgba(255,214,0,.04)':(i%2===0?'#ffffff':'#f8f9fa'), borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ color:C.t3 }}>{entry.date}</Td>
              <Td style={{ fontWeight:700 }}>{entry.debitAccount}</Td>
              <Td style={{ fontWeight:700 }}>{entry.creditAccount}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(entry.amount)}</Td>
              <Td style={{ color:C.t3, fontSize:11 }}>{entry.description}</Td>
              <Td><Badge status={entry.status} /></Td>
              {canEdit() && (
                <Td style={{ whiteSpace:'nowrap' }}>
                  {entry.status !== 'Reversed' && entry.status === 'Draft' && (
                    <>
                      <button onClick={() => openEditForm(entry)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Edit</button>
                      <button onClick={() => deleteEntry(entry)} style={{...B.link,color:C.red}}>Reverse</button>
                    </>
                  )}
                  {entry.status === 'Reversed' && <span style={{ color:C.t4, fontSize:11 }}>—</span>}
                </Td>
              )}
            </tr>
          ))}
        </DataTable>}

        {/* Pagination Controls */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, color:C.t3 }}>
            Showing {paginatedEntries.length > 0 ? (page-1)*pageSize + 1 : 0}–{Math.min(page*pageSize, ledgerEntries.length)} of {ledgerEntries.length}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }} style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:6, padding:'5px 8px', fontSize:12 }}>
              <option>10</option><option>25</option><option>50</option><option>100</option>
            </select>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{...B.ghost,...B.sm, opacity:page===1?0.5:1}}>← Prev</button>
            <span style={{ fontSize:12, color:C.t3, minWidth:'30px', textAlign:'center' }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{...B.ghost,...B.sm, opacity:page===totalPages?0.5:1}}>Next →</button>
          </div>
        </div>
      </Card>

      {/* Edit Modal */}
      <ModalShell open={editModal} title={editEntry ? 'Edit Ledger Entry' : 'New Ledger Entry'} onClose={() => setEditModal(false)}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><ML>Date</ML><input type="date" value={formData.date} onChange={e=>setFormData(p=>({...p,date:e.target.value}))} style={iStyle} /></div>
          <div><ML>Amount ($)</ML><input type="number" value={formData.amount} onChange={e=>setFormData(p=>({...p,amount:e.target.value}))} style={iStyle} /></div>
          <div><ML>Debit Account</ML><input value={formData.debitAccount} onChange={e=>setFormData(p=>({...p,debitAccount:e.target.value}))} style={iStyle} placeholder="e.g. Cash" /></div>
          <div><ML>Credit Account</ML><input value={formData.creditAccount} onChange={e=>setFormData(p=>({...p,creditAccount:e.target.value}))} style={iStyle} placeholder="e.g. Revenue" /></div>
        </div>
        <ML>Description</ML>
        <textarea value={formData.description} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} style={{ ...iStyle, resize:'vertical', minHeight:65 }} placeholder="Transaction description..." />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button style={{ ...B.ghost, flex:1 }} onClick={() => setEditModal(false)}>Cancel</button>
          <button style={{ ...B.pri, flex:1 }} onClick={saveEntry}>{editEntry ? 'Save Changes' : 'Create Entry'}</button>
        </div>
      </ModalShell>
    </div>
  )
}

// ─── Audit Trail ──────────────────────────────────────────────
function AuditTrail({ finRole, can, auditLog }) {
  if (!can('superadmin','auditor')) return <Restricted msg="Audit Trail is restricted to Super Admin and Auditor roles only." />

  return (
    <div className="space-y-4">
      <SectionHeader title="Audit Trail" sub="Immutable log — all financial actions · Read only">
        <button style={{...B.ghost,...B.sm}}>⬇ Export PDF for Auditor</button>
      </SectionHeader>
      <div style={{ background:'rgba(0,180,216,0.07)', border:'1px solid rgba(0,180,216,0.2)', borderRadius:10, padding:'12px 16px', fontSize:'12.5px', color:C.cyan, display:'flex', alignItems:'center', gap:10 }}>
        🔒 This log cannot be edited or deleted by anyone. All entries are permanent and tamper-proof.
      </div>
      <DataTable title="Action Log" sub={`${auditLog.length} entries`}
        toolbar={
          <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:6, padding:'5px 10px', fontFamily:'inherit', fontSize:12 }}>
            <option>All Actions</option><option>Invoice Created</option><option>Expense Approved</option><option>Payroll Run</option><option>Budget Changed</option>
          </select>
        }
        headers={['Action','User','Role','Amount','Date / Time','IP Address','Before','After']}>
        {auditLog.map((a,i) => (
          <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <Td style={{ fontWeight:700, color:C.t1 }}>{a.action}</Td>
            <Td>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{a.user[0]}</div>
                {a.user}
              </div>
            </Td>
            <Td><Badge status={a.urole==='Super Admin'?'Confirmed':a.urole==='Finance Manager'?'Sent':'Pending'} /></Td>
            <Td style={{ color:C.cyan, fontWeight:700 }}>{a.amount}</Td>
            <Td style={{ color:C.t3 }}>{a.dt}</Td>
            <Td style={{ color:C.t4, fontSize:11 }}>{a.ip}</Td>
            <Td style={{ color:C.t4, fontSize:11 }}>{a.before}</Td>
            <Td style={{ color:C.green, fontSize:11 }}>{a.after}</Td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function FinanceTab() {
  const { isSuperAdmin, isManagement, isDepartmentHead, isDepartmentUser, isExternal } = usePermissions()
  const { user, token } = useAuth()
  const { t } = useLanguage()
  const TABS = useMemo(() => getFinanceTabs(t), [t])

  // Map dashboard roles → finance-specific role
  const finRole = useMemo(() => {
    if (isSuperAdmin)    return 'superadmin'
    if (isManagement)    return 'fin_mgr'
    if (isDepartmentHead) {
      if (user?.department === 'hr')    return 'hr_mgr'
      if (user?.department === 'sales') return 'sales_head'
      return 'dept_head'
    }
    if (isDepartmentUser) {
      if (user?.department === 'hr')    return 'hr_mgr'
      if (user?.department === 'sales') return 'sales_head'
      return 'fin_analyst'
    }
    if (isExternal) return 'vendor'
    return 'fin_analyst'
  }, [isSuperAdmin, isManagement, isDepartmentHead, isDepartmentUser, isExternal, user])

  const can     = (...roles) => roles.includes(finRole)
  const canEdit = ()         => can('superadmin','fin_mgr')
  const USE_SEED_DATA = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [activeTab,    setActiveTab]    = useState('kpi')
  const [invoices,     setInvoices]     = useState(USE_SEED_DATA ? INIT_INVOICES : [])
  const [expenses,     setExpenses]     = useState(USE_SEED_DATA ? INIT_EXPENSES : [])
  const [payroll,      setPayroll]      = useState(USE_SEED_DATA ? INIT_PAYROLL : [])
  const [budgets,      setBudgets]      = useState(USE_SEED_DATA ? BUDGETS : [])
  const [taxes,        setTaxes]        = useState(USE_SEED_DATA ? TAXES : [])
  const [receivables,  setReceivables]  = useState(USE_SEED_DATA ? RECEIVABLES : [])
  const [payables,     setPayables]     = useState(USE_SEED_DATA ? PAYABLES : [])
  const [auditLog,     setAuditLog]     = useState(USE_SEED_DATA ? INIT_AUDIT : [])
  const [notifications,setNotifications]= useState(USE_SEED_DATA ? INIT_NOTIFS : [])
  const [toast,        setToast]        = useState(null)
  const [modal,        setModal]        = useState(null)   // 'invoice'|'expense'|'payroll'|'budget'|null
  const [notifOpen,    setNotifOpen]    = useState(false)
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const norm = rows => (rows || []).map(r => ({ ...r, id: r._id?.toString() || r.id }))
    Promise.all([
      financeAPI.invoices.list(),
      financeAPI.expenses.list(),
      financeAPI.payroll.list(),
      financeAPI.budgets.list(),
      financeAPI.taxes.list(),
    ]).then(([invs, exps, pays, buds, taxs]) => {
      if (cancelled) return
      if (invs.length)  setInvoices(norm(invs))
      if (exps.length)  setExpenses(norm(exps))
      if (pays.length)  setPayroll(norm(pays))
      if (buds.length)  setBudgets(norm(buds))
      if (taxs.length)  setTaxes(norm(taxs))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token])

  function showToast(title, msg) {
    setToast({ title, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function addAudit(entry) {
    setAuditLog(p => [entry, ...p])
  }

  const roleNotifs = useMemo(
    () => notifications.filter(n => n.roles.includes(finRole)),
    [notifications, finRole]
  )
  const unreadCount = roleNotifs.filter(n => !n.read).length

  // Shared props passed to every sub-tab
  const sh = { finRole, can, canEdit, invoices, setInvoices, expenses, setExpenses, payroll, setPayroll, budgets, setBudgets, taxes, setTaxes, receivables, setReceivables, payables, setPayables, auditLog, addAudit, onToast:showToast, openModal:setModal, financeApi:financeAPI }

  function renderTab() {
    switch (activeTab) {
      case 'kpi':     return <KPIOverview     {...sh} />
      case 'revenue': return <RevenueTracking {...sh} />
      case 'expense': return <ExpenseManagement {...sh} />
      case 'invoice': return <InvoiceManagement {...sh} />
      case 'budget':  return <BudgetPlanning  {...sh} />
      case 'payroll': return <PayrollManagement {...sh} />
      case 'arpa':    return <ARAndAP         {...sh} />
      case 'gold':    return <GoldTracker     {...sh} />
      case 'tax':     return <TaxCompliance   {...sh} />
      case 'reports': return <ReportsAnalytics {...sh} />
      case 'ledger':  return <GeneralLedger    finRole={finRole} can={can} canEdit={canEdit} onToast={showToast} token={token} />
      case 'audit':   return <AuditTrail      finRole={finRole} can={can} auditLog={auditLog} />
      default:        return null
    }
  }

  return (
    <>
      <div className="space-y-5">
        {/* Tab header bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:4 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:C.t1, letterSpacing:'-.3px' }}>Finance & Accounts</div>
            <div style={{ fontSize:11, color:C.t3, marginTop:2 }}>April 2026</div>
          </div>
          <div
            className="notif-bell"
            onClick={() => setNotifOpen(true)}
            title={`${unreadCount} unread finance alerts`}
          >
            🔔
            {unreadCount > 0 && (
              <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
        </div>

        {/* Sub-tab row */}
        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}`, overflowX:'auto', scrollbarWidth:'none', flexShrink:0, marginBottom:4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:'10px 14px', fontSize:12, fontWeight:600,
              background:'transparent', border:'none',
              borderBottom: activeTab===t.id ? '2px solid var(--purple)' : '2px solid transparent',
              color: activeTab===t.id ? 'var(--purple)' : C.t3,
              cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
              marginBottom:-1, transition:'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Active sub-tab */}
        {renderTab()}
      </div>

      {/* ── Modals ── */}
      <InvoiceModal
        open={modal==='invoice'}
        onClose={() => setModal(null)}
        onToast={showToast}
        onSubmit={(f, calc) => {
          const amount = calc ? calc.total : (parseFloat(f.qty)||0)*(parseFloat(f.price)||0)+(parseFloat(f.fee)||0)
          const payload = {
            client: f.client,
            invoiceType: f.type.includes('Sales') ? 'Sales' : 'Purchase',
            amount,
            issueDate: new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}),
            dueDate: f.due || '',
            status: 'Draft',
            daysOverdue: 0,
          }
          financeAPI.invoices.create(payload).then(doc => {
            const row = { ...doc, id: doc._id?.toString() || doc.id, type: doc.invoiceType, issue: doc.issueDate, due: doc.dueDate }
            setInvoices(p => [row, ...p])
            addAudit({ action:'Invoice Created', user:'You', urole:'Finance Manager', amount:fmtFull(amount), dt:'Now', ip:'192.168.1.x', before:'—', after:(doc.invoiceNo||doc._id)+' Created' })
            showToast('Invoice Created', 'Invoice created as Draft — ready to send to '+f.client)
          }).catch(() => showToast('Error', 'Failed to create invoice'))
        }}
      />

      <ExpenseModal
        open={modal==='expense'}
        onClose={() => setModal(null)}
        onSubmit={f => {
          const payload = { date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), dept:f.dept, cat:f.cat, amount:f.amount, submittedBy:'You', status:'Pending', approvedBy:'—', flagged:f.flagged, description:f.desc||'' }
          financeAPI.expenses.create(payload).then(doc => {
            setExpenses(p => [{ ...doc, id:doc._id?.toString()||doc.id, by:doc.submittedBy||'You' }, ...p])
            showToast('Expense Submitted', `${f.dept} expense of ${fmtFull(f.amount)} submitted${f.flagged?' — auto-flagged (>$10,000)':''}`)
          }).catch(() => showToast('Error','Failed to submit expense'))
        }}
      />

      <PayrollModal
        open={modal==='payroll'}
        onClose={() => setModal(null)}
        onRun={(auth, bank) => {
          setPayroll(p => p.map(e => ({...e, status:'Processed'})))
          payroll.filter(e => e.status !== 'Processed').forEach(e => {
            const rid = e.id || e._id?.toString()
            if (rid) financeAPI.payroll.update(rid, { status:'Processed' }).catch(() => {})
          })
          addAudit({ action:'Payroll Run', user:auth||'You', urole:'Finance Manager', amount:'$284,600', dt:'Now', ip:'192.168.1.x', before:'Pending', after:'Processed' })
          showToast('Payroll Processed','April 2026 payroll of $284,600 processed for 47 employees. Salary slips generated.')
        }}
      />

      <BudgetModal
        open={modal==='budget'}
        onClose={() => setModal(null)}
        onSubmit={(dept, amt) => {
          showToast('Request Submitted','Budget increase request for '+(dept||'Department')+' ('+fmtFull(amt)+') sent to Finance Manager for review.')
        }}
      />

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position:'fixed', bottom:22, right:22, minWidth:260, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid var(--purple)`, borderRadius:10, padding:'13px 18px', zIndex:9999, boxShadow:'0 8px 30px rgba(var(--purple-rgb),0.22)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:3 }}>{toast.title}</div>
          <div style={{ fontSize:12, color:C.t3 }}>{toast.msg}</div>
        </div>
      )}

      {/* ── Finance Notifications Panel ── */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={roleNotifs}
        onAck={id => setNotifications(p => p.map(n => n.id===id ? {...n, read:true} : n))}
        onDismiss={id => setNotifications(p => p.filter(n => n.id!==id))}
        onMarkAllRead={() => setNotifications(p => p.map(n => roleNotifs.find(r=>r.id===n.id) ? {...n, read:true} : n))}
        onClearRead={() => setNotifications(p => p.filter(n => !(n.read && roleNotifs.find(r=>r.id===n.id))))}
      />
    </>
  )
}
