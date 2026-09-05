import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, DataTable, fmt, fmtFull } from './ui'

export default function ARAndAP({ finRole, can, canEdit, onToast, receivables, setReceivables: _setReceivables, payables, setPayables }) {
  if (can('vendor','hr_mgr')) return <Restricted msg="Accounts Receivable & Payable is restricted." />
  const payOnly = finRole === 'dept_head'
  const recOnly = finRole === 'sales_head'

  const totalRec    = receivables.reduce((a,r)=>a+r.amount,0)
  const overdueRec  = receivables.filter(r=>r.overdue>0).reduce((a,r)=>a+r.amount,0)
  const totalPay    = payables.reduce((a,p)=>a+p.amount,0)

  return (
    <div className="space-y-4">
      <SectionHeader title="Accounts Receivable & Payable" sub="Money owed to you vs money you owe">
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('AR Report','Generating AR report...')}>⬇ AR Report</button>
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('AP Report','Generating AP report...')}>⬇ AP Report</button>
      </SectionHeader>

      {!payOnly && (
        <Card title={<>Accounts Receivable <span style={{ color:C.green, fontSize:12, fontWeight:600 }}>{fmt(totalRec)} total</span></>}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11, marginBottom:14 }}>
            <StatCard label="Total Receivables" value={fmt(totalRec)}           color={C.green}  />
            <StatCard label="Overdue"           value={fmt(overdueRec)}         color={C.red}    />
            <StatCard label="Current"           value={fmt(totalRec-overdueRec)} color={C.cyan}  />
          </div>
          <DataTable title="" headers={['Client','Invoice','Amount','Due Date','Days Overdue','Status','Action']}>
            {receivables.map((r,i) => (
              <tr key={i} style={{ background:r.overdue>0?'rgba(255,71,87,.05)':'rgba(0,200,150,.04)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <Td style={{ fontWeight:700, color:C.t1 }}>{r.client}</Td>
                <Td style={{ color:C.t3 }}>{r.inv}</Td>
                <Td style={{ color:r.overdue>0?C.red:C.green, fontWeight:700 }}>{fmtFull(r.amount)}</Td>
                <Td style={{ color:C.t3 }}>{r.due}</Td>
                <Td style={{ color:r.overdue>0?C.red:C.green }}>{r.overdue>0?r.overdue+' days':'✓'}</Td>
                <Td><Badge status={r.status} /></Td>
                <Td><button style={{...B.ghost,...B.sm}} onClick={() => onToast('Reminder Sent','Payment reminder sent to '+r.client)}>Send Reminder</button></Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {!recOnly && (
        <Card title={<>Accounts Payable <span style={{ color:C.orange, fontSize:12, fontWeight:600 }}>{fmt(totalPay)} total</span></>}>
          <DataTable title="" headers={['Vendor','Invoice','Amount','Due Date','Status',...(canEdit()?['Action']:[])]}>
            {payables.map((p,i) => (
              <tr key={i} style={{ background:p.pstatus==='Overdue'?'rgba(255,71,87,.05)':(i%2===0?'#ffffff':'#f8f9fa'), borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <Td style={{ fontWeight:700, color:C.t1 }}>{p.vendor}</Td>
                <Td style={{ color:C.t3 }}>{p.inv}</Td>
                <Td style={{ color:p.pstatus==='Overdue'?C.red:C.t1, fontWeight:700 }}>{fmtFull(p.amount)}</Td>
                <Td style={{ color:p.pstatus==='Overdue'?C.red:C.t3 }}>{p.due}</Td>
                <Td><Badge status={p.pstatus} /></Td>
                {canEdit() && <Td><button style={{...B.succ,...B.sm}} onClick={() => { setPayables(prev => prev.map(x => x.inv===p.inv ? {...x, pstatus:'Paid'} : x)); onToast('Marked Paid',p.vendor+' payment of '+fmtFull(p.amount)+' marked as paid') }}>Mark Paid</button></Td>}
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  )
}

// ─── Gold Tracker ─────────────────────────────────────────────
