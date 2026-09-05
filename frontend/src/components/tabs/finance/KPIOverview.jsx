import { C, B, Card, StatCard, SectionHeader, Restricted, PieLegend } from './ui'

export default function KPIOverview({ finRole, can, canEdit, invoices: _invoices, openModal, onToast }) {
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
