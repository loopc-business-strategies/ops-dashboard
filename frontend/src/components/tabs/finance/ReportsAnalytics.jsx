import { C, B, Card, SectionHeader, Restricted } from './ui'

export default function ReportsAnalytics({ finRole, can, canEdit, onToast }) {
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
