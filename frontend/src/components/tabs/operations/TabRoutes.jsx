import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, TableWrap, SH, Restrict, TH, TD } from './operationsTabUI'

export default function TabRoutes({ routes, setRoutes, canEdit, isExternal, isMgmt, showToast, onOpenIncident, setModal }) {
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
