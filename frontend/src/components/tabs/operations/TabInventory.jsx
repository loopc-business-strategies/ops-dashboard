import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, StatCard, TableWrap, SH, Restrict, TH, TD } from './operationsTabUI'

export default function TabInventory({ inventory, setInventory: _setInventory, suppliers: _suppliers, setSuppliers, canEdit, isExternal, isMgmt, showToast, setModal, onDeleteInventory }) {
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
