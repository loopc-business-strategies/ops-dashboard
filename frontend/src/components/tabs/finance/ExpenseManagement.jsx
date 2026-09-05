import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, ProgressRow, DataTable, fmtFull } from './ui'
import { useAuth } from '../../../context/AuthContext'

export default function ExpenseManagement({ finRole, can, canEdit, expenses, setExpenses, addAudit, onToast, openModal, financeApi }) {
    const { user: authUser } = useAuth()
  if (can('vendor','sales_head','hr_mgr')) return <Restricted msg="Expense management is not available for your role." />
  const deptOnly = finRole === 'dept_head'
  const data = deptOnly ? expenses.filter(e=>e.dept==='Operations') : expenses

  function approve(id) {
    const approvedBy = authUser?.name || authUser?.email || 'Unknown'
    setExpenses(p => p.map(e => e.id===id ? {...e, status:'Approved', approvedBy} : e))
    financeApi.expenses.update(id, { status:'Approved', approvedBy }).catch(() => { onToast('Error', 'Save failed. Please refresh.') })
    const e = expenses.find(x=>x.id===id)
    addAudit({ action:'Expense Approved', user:'You', urole:'Finance Manager', amount:fmtFull(e?.amount||0), dt:'Now', ip:'192.168.1.x', before:'Pending', after:'Approved' })
    onToast('Approved','Expense '+id+' approved')
  }
  function reject(id) {
    const approvedBy = authUser?.name || authUser?.email || 'Unknown'
    setExpenses(p => p.map(e => e.id===id ? {...e, status:'Rejected', approvedBy} : e))
    financeApi.expenses.update(id, { status:'Rejected', approvedBy }).catch(() => { onToast('Error', 'Save failed. Please refresh.') })
    onToast('Rejected','Expense '+id+' rejected')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Expense Management" sub={deptOnly ? 'Your department expenses only' : ''}>
        {can('superadmin','fin_mgr','dept_head') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('expense')}>+ Submit Expense</button>}
        {canEdit() && <button style={{...B.ghost,...B.sm}} onClick={() => onToast('Export','Exporting expenses...')}>⬇ Export</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total This Month"    value="$404,700" color={C.t1}     sub={<span style={{color:C.red,fontWeight:700}}>↑12% vs last month</span>} />
        <StatCard label="Pending Approval"   value="2"        color={C.yellow} sub="Awaiting Finance review" />
        <StatCard label="Flagged (>$10k)"    value="2"        color={C.red}    sub="Auto-flagged for approval" />
        <StatCard label="Approved This Month" value="3"       color={C.green}  sub="$369,200 approved" />
      </div>
      <Card title="Expenses by Department">
        <ProgressRow label="Operations"      value={42000}  max={100000} color={C.gbar} valLabel="$42k"  />
        <ProgressRow label="HR & Payroll"    value={284600} max={400000} color={C.gfin} valLabel="$285k" />
        <ProgressRow label="Sales & Marketing" value={15000} max={100000} color="linear-gradient(90deg,#00c896,#00b4d8)" valLabel={<span style={{color:C.red}}>$15k ⚠</span>} />
        <ProgressRow label="Production"      value={42600}  max={100000} color="linear-gradient(90deg,#ffd600,#9a3412)"  valLabel="$43k"  />
        <ProgressRow label="Compliance"      value={8500}   max={100000} color={C.gbar} valLabel="$8.5k" />
      </Card>
      <DataTable title="Expense Register" headers={['Expense ID','Date','Dept','Category','Amount','Submitted By','Status','Approved By',...(canEdit()?['Actions']:[])]}>
        {data.map((e,i) => {
          const rowBg = e.flagged ? 'rgba(255,214,0,.04)' : e.status==='Rejected' ? 'rgba(255,71,87,.05)' : e.status==='Approved' ? 'rgba(0,200,150,.04)' : (i%2===0?'#ffffff':'#f8f9fa')
          return (
            <tr key={e.id} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {e.id}
                  {e.flagged && <span style={{ background:'rgba(255,71,87,.12)', color:C.red, border:'1px solid rgba(255,71,87,.3)', borderRadius:999, fontSize:9, padding:'2px 6px' }}>⚠ Flagged</span>}
                </div>
              </Td>
              <Td style={{ color:C.t3 }}>{e.date}</Td>
              <Td>{e.dept}</Td><Td>{e.cat}</Td>
              <Td style={{ color:e.amount>10000?C.yellow:C.t2, fontWeight:700 }}>{fmtFull(e.amount)}</Td>
              <Td>{e.by}</Td>
              <Td><Badge status={e.status} /></Td>
              <Td style={{ color:e.approvedBy==='—'?C.t4:C.green }}>{e.approvedBy}</Td>
              {canEdit() && (
                <Td>
                  {(e.status==='Pending'||e.status==='Under Review') && <>
                    <button onClick={() => approve(e.id)} style={{ ...B.link, color:'var(--purple)', marginRight:8 }}>Approve</button>
                    <button onClick={() => reject(e.id)}  style={{ ...B.link, color:C.red }}>Reject</button>
                  </>}
                  {(e.status==='Approved'||e.status==='Rejected') && <span style={{ color:C.t4, fontSize:11 }}>—</span>}
                </Td>
              )}
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

// ─── Invoice Management ───────────────────────────────────────
