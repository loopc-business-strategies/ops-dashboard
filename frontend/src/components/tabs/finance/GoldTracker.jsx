import { C, B, Td, Card, StatCard, SectionHeader, Restricted, DataTable } from './ui'

export default function GoldTracker({ finRole, can, canEdit, onToast }) {
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
                  {!salesOnly && <div style={{ flex:1, borderRadius:'4px 4px 0 0', height:d.r*0.35, background:'var(--grad-brand)' }} />}
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
