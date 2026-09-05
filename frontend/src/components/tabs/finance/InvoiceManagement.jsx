import { C, B, Badge, Td, Card, StatCard, SectionHeader, DataTable, fmtFull } from './ui'

export default function InvoiceManagement({ finRole, can, canEdit: _canEdit, invoices, setInvoices, addAudit, onToast, openModal, financeApi }) {
  const myOnly    = finRole === 'vendor'
  const salesOnly = finRole === 'sales_head'
  const data = myOnly ? invoices.filter(i=>i.client.includes('KazTrans')) : salesOnly ? invoices.filter(i=>i.type==='Sales') : invoices

  function markPaid(id) {
    const inv = invoices.find(i=>i.id===id)
    setInvoices(p => p.map(i => i.id===id ? {...i, status:'Paid', daysOverdue:0} : i))
    financeApi.invoices.update(id, { status:'Paid', daysOverdue:0 }).catch(() => { onToast('Error', 'Save failed. Please refresh.') })
    addAudit({ action:'Invoice Marked Paid', user:'You', urole:'Finance Manager', amount:fmtFull(inv?.amount||0), dt:'Now', ip:'192.168.1.x', before:'Sent/Overdue', after:'Paid' })
    onToast('Invoice Paid', id+' marked as paid. Audit log updated.')
  }

  const paid    = invoices.filter(i=>i.status==='Paid').length
  const overdue = invoices.filter(i=>i.status==='Overdue').length
  const pending = invoices.filter(i=>i.status==='Sent'||i.status==='Draft').length

  return (
    <div className="space-y-4">
      <SectionHeader title="Invoice Management" sub={myOnly ? 'Your invoices only' : 'All invoices'}>
        {can('superadmin','fin_mgr','fin_analyst') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('invoice')}>+ Create Invoice</button>}
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Export','Exporting invoices...')}>⬇ Export</button>
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Invoices"  value={invoices.length} color={C.cyan}   sub="This year" />
        <StatCard label="Paid"            value={paid}            color={C.green}  sub="$4.93M collected" />
        <StatCard label="Overdue"         value={overdue}         color={C.red}    sub="$1.545M outstanding" />
        <StatCard label="Pending / Draft" value={pending}         color={C.yellow} sub="Awaiting action" />
      </div>
      <Card title="Aging Report — Outstanding Invoices">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
          {[{l:'0–30 Days',a:'$2.9M',ct:1,c:C.green},{l:'31–60 Days',a:'$1.45M',ct:1,c:C.yellow},{l:'61–90 Days',a:'$0',ct:0,c:C.t4},{l:'90+ Days',a:'$95k',ct:1,c:C.red}].map(a=>(
            <div key={a.l} style={{ background:'rgba(255,255,255,.02)', border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{a.l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:a.c }}>{a.a}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:4 }}>{a.ct} invoice{a.ct!==1?'s':''}</div>
            </div>
          ))}
        </div>
      </Card>
      <DataTable title="Invoice Register" headers={['Invoice ID','Client / Vendor','Type','Amount','Issue Date','Due Date','Status',...(!myOnly?['Actions']:[])]}>
        {data.map((inv,i) => {
          const rowBg = inv.status==='Overdue' ? 'rgba(255,71,87,.05)' : inv.status==='Paid' ? 'rgba(0,200,150,.04)' : (i%2===0?'#ffffff':'#f8f9fa')
          return (
            <tr key={inv.id} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{inv.id}</Td>
              <Td>{inv.client}</Td>
              <Td>
                {inv.type==='Sales'
                  ? <span style={{ background:'rgba(0,180,216,.12)', color:C.cyan, border:'1px solid rgba(0,180,216,.3)', borderRadius:999, padding:'4px 10px', fontSize:11, fontWeight:700 }}>↗ Sales</span>
                  : <span style={{ background:'rgba(var(--purple-rgb),.15)', color:'var(--purple)', border:'1px solid rgba(var(--purple-rgb),.3)', borderRadius:999, padding:'4px 10px', fontSize:11, fontWeight:700 }}>↙ Purchase</span>
                }
              </Td>
              <Td style={{ color:inv.status==='Overdue'?C.red:inv.status==='Paid'?C.green:C.t1, fontWeight:700 }}>{fmtFull(inv.amount)}</Td>
              <Td style={{ color:C.t3 }}>{inv.issue}</Td>
              <Td style={{ color:inv.status==='Overdue'?C.red:C.t3 }}>
                {inv.due}
                {inv.daysOverdue>0 && <span style={{ color:C.red, fontSize:10, marginLeft:4 }}>(+{inv.daysOverdue}d)</span>}
              </Td>
              <Td><Badge status={inv.status} /></Td>
              {!myOnly && (
                <Td style={{ whiteSpace:'nowrap' }}>
                  {(inv.status==='Sent'||inv.status==='Overdue') && <button onClick={() => markPaid(inv.id)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Mark Paid</button>}
                  {inv.status==='Draft' && <button onClick={() => onToast('Invoice Sent',inv.id+' sent to client')} style={{...B.link,color:'var(--purple)',marginRight:8}}>Send</button>}
                  <button onClick={() => onToast('PDF','Generating invoice PDF...')} style={{...B.link,color:'var(--purple)',marginRight:8}}>PDF</button>
                  {inv.status==='Overdue' && <button onClick={() => onToast('Reminder Sent','Payment reminder sent to '+inv.client)} style={{...B.link,color:C.cyan}}>Remind</button>}
                </Td>
              )}
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

// ─── Budget Planning ──────────────────────────────────────────
