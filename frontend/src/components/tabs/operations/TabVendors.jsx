import { OPS_C as C } from './operationsTabTokens'
import { B, stars, Badge, ProgBar, Card, CardTitle, TableWrap, SH, TH, TD } from './operationsTabUI'

export default function TabVendors({ vendors, setVendors, canEdit, isAdmin, isHead, isMgmt: _isMgmt, isUser, isExternal, showToast, onOpenAdd: _onOpenAdd, setModal }) {
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
