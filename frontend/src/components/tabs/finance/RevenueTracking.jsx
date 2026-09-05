import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, PieLegend, DataTable, fmtFull } from './ui'

export default function RevenueTracking({ finRole, can, canEdit: _canEdit, onToast }) {
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
                <div style={{ width:'100%', borderRadius:'4px 4px 0 0', height:d.v*0.45, background:i===11?'var(--grad-brand)':'rgba(var(--purple-rgb),0.35)' }} />
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
