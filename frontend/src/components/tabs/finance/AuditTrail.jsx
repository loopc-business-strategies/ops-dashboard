import { C, B, Badge, Td, SectionHeader, Restricted, DataTable } from './ui'

export default function AuditTrail({ finRole: _finRole, can, auditLog }) {
  if (!can('superadmin','auditor')) return <Restricted msg="Audit Trail is restricted to Super Admin and Auditor roles only." />

  return (
    <div className="space-y-4">
      <SectionHeader title="Audit Trail" sub="Immutable log — all financial actions · Read only">
        <button style={{...B.ghost,...B.sm}}>⬇ Export PDF for Auditor</button>
      </SectionHeader>
      <div style={{ background:'rgba(0,180,216,0.07)', border:'1px solid rgba(0,180,216,0.2)', borderRadius:10, padding:'12px 16px', fontSize:'12.5px', color:C.cyan, display:'flex', alignItems:'center', gap:10 }}>
        🔒 This log cannot be edited or deleted by anyone. All entries are permanent and tamper-proof.
      </div>
      <DataTable title="Action Log" sub={`${auditLog.length} entries`}
        toolbar={
          <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:6, padding:'5px 10px', fontFamily:'inherit', fontSize:12 }}>
            <option>All Actions</option><option>Invoice Created</option><option>Expense Approved</option><option>Payroll Run</option><option>Budget Changed</option>
          </select>
        }
        headers={['Action','User','Role','Amount','Date / Time','IP Address','Before','After']}>
        {auditLog.map((a,i) => (
          <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <Td style={{ fontWeight:700, color:C.t1 }}>{a.action}</Td>
            <Td>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{a.user[0]}</div>
                {a.user}
              </div>
            </Td>
            <Td><Badge status={a.urole==='Super Admin'?'Confirmed':a.urole==='Finance Manager'?'Sent':'Pending'} /></Td>
            <Td style={{ color:C.cyan, fontWeight:700 }}>{a.amount}</Td>
            <Td style={{ color:C.t3 }}>{a.dt}</Td>
            <Td style={{ color:C.t4, fontSize:11 }}>{a.ip}</Td>
            <Td style={{ color:C.t4, fontSize:11 }}>{a.before}</Td>
            <Td style={{ color:C.green, fontSize:11 }}>{a.after}</Td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
