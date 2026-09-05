import { useState } from 'react'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, TableWrap, SH, Restrict, Modal, TH, TD } from './operationsTabUI'

export default function TabSupply({ suppliers, setSuppliers, canEdit, isExternal, isMgmt, showToast, onOpenAdd, setModal }) {
  const [detail, setDetail] = useState(null)
  if (isExternal || isMgmt) return <Restrict text="Supply Chain data is restricted to Operations team only." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Supply Chain Tracking" sub={`${suppliers.length} suppliers · ${suppliers.filter(s=>s.st==='Completed').length} completed`}>
        {canEdit && <button style={B.pri} onClick={onOpenAdd}>+ Add Supplier</button>}
        <button style={B.ghost}>⬇ Excel</button>
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1000 }}>
            <thead><tr>
              {['Supplier','Category','Order Date','Exp. Delivery','Qty Ordered','Qty Received','Payment','QC','Status','Notes', ...(canEdit?['Actions']:[])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {suppliers.map(s => {
                const rowBg = s.st === 'Completed' ? 'rgba(0,200,150,.04)' : s.st === 'Pending External' ? 'rgba(255,214,0,.03)' : ''
                return (
                  <tr key={s.id} style={{ background:rowBg, cursor:'pointer' }} onClick={() => setDetail(s)}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{s.name}</td>
                    <td style={TD}><Badge s={s.cat} /></td>
                    <td style={{ ...TD, color:C.t3 }}>{s.od}</td>
                    <td style={{ ...TD, color:C.t3 }}>{s.ed}</td>
                    <td style={TD}>{s.qty}</td>
                    <td style={{ ...TD, color: s.qr === s.qty && s.qty !== '—' ? C.green : C.t2 }}>{s.qr}</td>
                    <td style={TD}><Badge s={s.pay} /></td>
                    <td style={TD}><Badge s={s.qc} /></td>
                    <td style={TD}><Badge s={s.st} /></td>
                    <td style={{ ...TD, color:C.t3, fontSize:11, maxWidth:140, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.notes}</td>
                    {canEdit && <td style={TD} onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setModal({ type:'supplier-edit', data:s }) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Edit</button>
                      <button onClick={() => { setSuppliers(p => p.filter(x => x.id !== s.id)); showToast('Deleted','Supplier removed') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {detail && (
        <Modal title={`${detail.name} — Supplier Detail`} sub="Full order history and supplier information" onClose={() => setDetail(null)} onSave={() => setDetail(null)} saveLabel="Close">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11, marginBottom:14 }}>
            {[['Status', <Badge key="st" s={detail.st} />],['QC Status',<Badge key="qc" s={detail.qc}/>],['Payment',<Badge key="pay" s={detail.pay}/>],['Category',<span key="cat" style={{fontWeight:700,color:C.t1}}>{detail.cat}</span>]].map(([lbl,val]) => (
              <div key={lbl} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>{lbl}</div>
                {val}
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.t2, marginBottom:8 }}><strong style={{color:C.t1}}>Notes:</strong> {detail.notes}</div>
          <div style={{ fontSize:12, color:C.t2, marginBottom:8 }}><strong style={{color:C.t1}}>Ordered:</strong> {detail.qty} · <strong style={{color:C.t1}}>Received:</strong> {detail.qr}</div>
          <div style={{ fontSize:12, color:C.t2 }}><strong style={{color:C.t1}}>Order Date:</strong> {detail.od} · <strong style={{color:C.t1}}>Expected:</strong> {detail.ed} · <strong style={{color:C.t1}}>Actual:</strong> {detail.ad}</div>
        </Modal>
      )}
    </div>
  )
}

// ─── TAB: Gold Sourcing ─────────────────────────────────────────────────────────
