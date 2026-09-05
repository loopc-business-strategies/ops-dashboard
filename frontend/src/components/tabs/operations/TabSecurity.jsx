import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, Card, CardTitle, TableWrap, TableHead, SH, Restrict, TH, TD } from './operationsTabUI'

export default function TabSecurity({ secVendors, setSecVendors, incidents, setIncidents, canEdit, isExternal, isMgmt, showToast, onOpenIncident, setModal }) {
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
