import { OPS_C as C } from './operationsTabTokens'
import { B, Card, CardTitle, SH, Restrict } from './operationsTabUI'

export default function TabAnalytics({ canEdit: _canEdit, isAdmin, isHead, isMgmt, isExternal: _isExternal }) {
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

// ─── TAB: Projects ────────────────────────────────────────────────────────────
