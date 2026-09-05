import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, ProgressRow, DataTable, fmt, fmtFull } from './ui'

export default function PayrollManagement({ finRole, can, canEdit: _canEdit, payroll, setPayroll: _setPayroll, addAudit: _addAudit, onToast, openModal, financeApi: _financeApi }) {
  if (can('vendor','sales_head','dept_head')) return <Restricted msg="Payroll management is restricted to Finance and HR departments." />
  const hrOnly = finRole === 'hr_mgr'

  return (
    <div className="space-y-4">
      <SectionHeader title="Payroll Management" sub={`April 2026 · ${payroll.length} employees`}>
        {can('superadmin','fin_mgr') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('payroll')}>▶ Run Payroll</button>}
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('PDF','Generating salary slips...')}>⬇ Salary Slips PDF</button>
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Payroll"  value="$284,600" color={C.cyan}   sub="Apr 2026" />
        <StatCard label="Employees"      value="47"       color={C.t1}     sub="All active" />
        <StatCard label="Next Payroll"   value="Apr 30"   color="var(--purple)"  sub="17 days away" />
        <StatCard label="Status">
          <div style={{ marginTop:6 }}><Badge status="Pending" /></div>
          <div style={{ fontSize:11, color:C.t3, marginTop:7 }}>Awaiting Finance approval</div>
        </StatCard>
      </div>
      {hrOnly ? (
        <>
          <div style={{ background:'rgba(255,214,0,.07)', borderLeft:`3px solid ${C.yellow}`, borderRadius:6, padding:'10px 13px' }}>
            <div style={{ fontSize:'12.5px', fontWeight:700, color:C.yellow, marginBottom:3 }}>HR Summary View</div>
            <div style={{ fontSize:'11.5px', color:C.t3 }}>Individual salary details are restricted to Finance. You can see department totals and headcount only.</div>
          </div>
          <Card title="Payroll by Department">
            {[{d:'Production',n:18,t:72000},{d:'Operations',n:8,t:48600},{d:'Sales',n:6,t:38400},{d:'HR',n:4,t:28200},{d:'Finance',n:3,t:26400},{d:'Compliance',n:4,t:32000},{d:'Training',n:4,t:39000}].map(p=>(
              <ProgressRow key={p.d} label={`${p.d} (${p.n})`} value={p.t} max={80000} color={C.gfin} valLabel={fmt(p.t)} />
            ))}
          </Card>
        </>
      ) : (
        <DataTable title="Payroll Register" headers={['Employee','Department','Role','Basic Salary','Allowances','Deductions','Net Pay','Status','Pay Date']}>
          {payroll.map((p,i) => (
            <tr key={i} style={{ background:i%2===0?'#ffffff':'#f8f9fa', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{p.emp}</Td>
              <Td>{p.dept}</Td>
              <Td style={{ color:C.t3 }}>{p.role}</Td>
              <Td>{fmtFull(p.basic)}</Td>
              <Td style={{ color:C.green }}>{fmtFull(p.allow)}</Td>
              <Td style={{ color:C.red }}>-{fmtFull(p.ded)}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(p.net)}</Td>
              <Td><Badge status={p.status} /></Td>
              <Td style={{ color:C.t3 }}>{p.date}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

// ─── AR & AP ──────────────────────────────────────────────────
