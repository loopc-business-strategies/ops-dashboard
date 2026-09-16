import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import payrollV2API from '../../../api/payrollV2'
import hrAPI from '../../../api/hr'
import { isStructuredPayrollEnabled } from '../../../config/tenantBranding'
import { generatePayslipPdf } from '../../../utils/payslipPdf'
import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, ProgressRow, DataTable, fmt, fmtFull } from './ui'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'runs', label: 'Runs' },
  { id: 'employees', label: 'Employees' },
  { id: 'structures', label: 'Structures' },
  { id: 'payslips', label: 'Payslips' },
  { id: 'my_payslips', label: 'My Payslips' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'legacy', label: 'Legacy register' },
]

function money(n) {
  return fmtFull(Number(n) || 0)
}

function LegacyPayrollRegister({ finRole, can, payroll, onToast, openModal }) {
  const hrOnly = finRole === 'hr_mgr'
  return (
    <div className="space-y-4">
      <SectionHeader title="Legacy Payroll Register" sub={`${payroll.length} rows (FinancePayroll — unchanged)`}>
        {can('superadmin','fin_mgr') && <button style={{...B.pri,...B.sm}} onClick={() => openModal('payroll')}>▶ Run Payroll</button>}
        <button style={{...B.ghost,...B.sm}} onClick={() => onToast('PDF','Generating salary slips...')}>⬇ Salary Slips PDF</button>
      </SectionHeader>
      {hrOnly ? (
        <Card title="Payroll by Department">
          {[{d:'Production',n:18,t:72000},{d:'Operations',n:8,t:48600},{d:'Sales',n:6,t:38400},{d:'HR',n:4,t:28200},{d:'Finance',n:3,t:26400}].map(p=>(
            <ProgressRow key={p.d} label={`${p.d} (${p.n})`} value={p.t} max={80000} color={C.gfin} valLabel={fmt(p.t)} />
          ))}
        </Card>
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

function StructuredPayroll({ finRole, can, payroll, onToast, openModal, company }) {
  const { token, user } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [dash, setDash] = useState(null)
  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [runDetail, setRunDetail] = useState(null)
  const [employees, setEmployees] = useState([])
  const [payslips, setPayslips] = useState([])
  const [myPayslips, setMyPayslips] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newPeriod, setNewPeriod] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const [payslipQuery, setPayslipQuery] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      const data = await payrollV2API.dashboard()
      setDash(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard')
    }
  }, [])

  const loadRuns = useCallback(async () => {
    const data = await payrollV2API.listRuns()
    setRuns(data)
  }, [])

  const loadRunDetail = useCallback(async (id) => {
    if (!id) { setRunDetail(null); return }
    const data = await payrollV2API.getRun(id)
    setRunDetail(data)
  }, [])

  const loadEmployees = useCallback(async () => {
    const data = await hrAPI.getEmployees(token)
    setEmployees(data.employees || [])
  }, [token])

  const loadPayslips = useCallback(async () => {
    const data = await payrollV2API.listPayslips(payslipQuery ? { q: payslipQuery } : {})
    setPayslips(data)
  }, [payslipQuery])

  const loadMyPayslips = useCallback(async () => {
    try {
      const data = await payrollV2API.myPayslips()
      setMyPayslips(data)
    } catch {
      setMyPayslips([])
    }
  }, [])

  useEffect(() => {
    loadDashboard().catch(() => {})
    loadRuns().catch(() => {})
    loadEmployees().catch(() => {})
  }, [loadDashboard, loadRuns, loadEmployees])

  useEffect(() => {
    if (tab === 'payslips') loadPayslips().catch(() => {})
    if (tab === 'my_payslips') loadMyPayslips().catch(() => {})
    if (tab === 'runs' && selectedRunId) loadRunDetail(selectedRunId).catch(() => {})
  }, [tab, selectedRunId, loadPayslips, loadMyPayslips, loadRunDetail])

  const act = async (fn, okMsg) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (okMsg) onToast?.('Payroll', okMsg)
      await Promise.all([loadDashboard(), loadRuns()])
      if (selectedRunId) await loadRunDetail(selectedRunId)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const createRun = () => act(async () => {
    const run = await payrollV2API.createRun({
      year: Number(newPeriod.year),
      month: Number(newPeriod.month),
      employeeIds: selectedEmployeeIds.length ? selectedEmployeeIds : undefined,
    })
    setSelectedRunId(run._id)
    setTab('runs')
  }, 'Payroll run created')

  const structures = useMemo(() => {
    // Lightweight view: employees with position / salaryRef as structure hint
    return employees.map((e) => ({
      id: e._id,
      name: e.name,
      code: e.employeeCode,
      dept: e.department,
      position: e.position,
      salaryRef: e.salaryRef,
    }))
  }, [employees])

  return (
    <div className="space-y-4">
      <SectionHeader title="Payroll Management" sub="LoopC structured payroll">
        {can('superadmin','fin_mgr') && (
          <button style={{...B.pri,...B.sm}} disabled={busy} onClick={createRun}>+ New Run</button>
        )}
      </SectionHeader>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.filter((t) => t.id !== 'legacy' || (payroll?.length > 0)).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...B.sm,
              ...(tab === t.id ? B.pri : B.ghost),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 12px', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {tab === 'dashboard' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Employees" value={String(dash?.employeeCount ?? '—')} color={C.t1} sub="Active roster" />
          <StatCard label="Salary structures" value={String(dash?.assignmentCount ?? '—')} color={C.cyan} sub="Active assignments" />
          <StatCard label="Payroll runs" value={String(dash?.runCount ?? '—')} color="var(--purple)" sub={dash?.latestRun ? `${dash.latestRun.year}-${String(dash.latestRun.month).padStart(2,'0')}` : '—'} />
          <StatCard label="Payslips" value={String(dash?.payslipCount ?? '—')} color={C.green} sub={dash?.totals ? `Latest net ${money(dash.totals.net)}` : '—'} />
        </div>
      )}

      {tab === 'runs' && (
        <div className="space-y-3">
          <Card title="Create / select run">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="number" value={newPeriod.year} onChange={(e) => setNewPeriod((p) => ({ ...p, year: e.target.value }))} style={{ width: 90, padding: 6 }} />
              <input type="number" min={1} max={12} value={newPeriod.month} onChange={(e) => setNewPeriod((p) => ({ ...p, month: e.target.value }))} style={{ width: 70, padding: 6 }} />
              <button style={{...B.ghost,...B.sm}} disabled={busy} onClick={createRun}>Create draft</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {runs.map((r) => (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => { setSelectedRunId(r._id); loadRunDetail(r._id) }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: selectedRunId === r._id ? `1px solid ${C.cyan}` : '1px solid #e5e7eb',
                    background: selectedRunId === r._id ? 'rgba(6,182,212,.08)' : '#fff',
                  }}
                >
                  <strong>{r.label || `${r.year}-${String(r.month).padStart(2,'0')}`}</strong>
                  {' · '}<Badge status={r.status} />
                  {' · '}net {money(r.totals?.net)} · {r.totals?.employeeCount || 0} emp
                </button>
              ))}
              {!runs.length && <div style={{ color: C.t3, fontSize: 13 }}>No payroll runs yet.</div>}
            </div>
          </Card>

          {runDetail && (
            <Card title={`Run · ${runDetail.label} · ${runDetail.status}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {can('superadmin','fin_mgr') && runDetail.status === 'DRAFT' && (
                  <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(async () => {
                    if (selectedEmployeeIds.length) {
                      await payrollV2API.selectEmployees(runDetail._id, selectedEmployeeIds)
                    }
                    await payrollV2API.calculate(runDetail._id)
                  }, 'Calculated')}>Calculate</button>
                )}
                {can('superadmin','fin_mgr') && runDetail.status === 'CALCULATED' && (
                  <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(() => payrollV2API.submitReview(runDetail._id), 'Submitted for review')}>Submit review</button>
                )}
                {can('superadmin','fin_mgr') && runDetail.status === 'UNDER_REVIEW' && (
                  <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(() => payrollV2API.approve(runDetail._id), 'Approved')}>Approve</button>
                )}
                {can('superadmin','fin_mgr') && runDetail.status === 'APPROVED' && (
                  <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(() => payrollV2API.finalize(runDetail._id), 'Finalized')}>Finalize</button>
                )}
                {can('superadmin','fin_mgr') && runDetail.status === 'FINALIZED' && (
                  <>
                    <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(async () => {
                      const result = await payrollV2API.generatePayslips(runDetail._id)
                      onToast?.('Payslips', `Created ${result.created?.length || 0}, skipped ${result.skipped?.length || 0}, failed ${result.failures?.length || 0}`)
                      await loadPayslips()
                    }, null)}>Generate All Payslips</button>
                    <button style={{...B.ghost,...B.sm}} disabled={busy} onClick={() => act(() => payrollV2API.markPaid(runDetail._id), 'Marked paid')}>Mark paid</button>
                  </>
                )}
                {can('superadmin','fin_mgr') && runDetail.status === 'PAID' && (
                  <button style={{...B.pri,...B.sm}} disabled={busy} onClick={() => act(async () => {
                    const result = await payrollV2API.generatePayslips(runDetail._id)
                    onToast?.('Payslips', `Created ${result.created?.length || 0}, skipped ${result.skipped?.length || 0}`)
                    await loadPayslips()
                  }, null)}>Generate All Payslips</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>
                Gross {money(runDetail.totals?.gross)} · Deductions {money(runDetail.totals?.deductions)} · Net {money(runDetail.totals?.net)} · Employer {money(runDetail.totals?.employerTotal)}
              </div>
              {runDetail.status === 'DRAFT' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Select employees for this run</div>
                  <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                    {employees.map((e) => {
                      const checked = selectedEmployeeIds.includes(e._id)
                      return (
                        <label key={e._id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2px 0' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedEmployeeIds((prev) =>
                              checked ? prev.filter((id) => id !== e._id) : [...prev, e._id]
                            )}
                          />
                          {e.name} ({e.employeeCode})
                        </label>
                      )
                    })}
                  </div>
                  <button
                    style={{...B.ghost,...B.sm, marginTop: 8}}
                    disabled={busy || !selectedEmployeeIds.length}
                    onClick={() => act(() => payrollV2API.selectEmployees(runDetail._id, selectedEmployeeIds), 'Employees updated')}
                  >
                    Apply selection
                  </button>
                </div>
              )}
              <DataTable title="Lines" headers={['Employee','Dept','Gross','Deductions','Net','Employer']}>
                {(runDetail.lines || []).map((l, i) => (
                  <tr key={String(l.employeeId) + i}>
                    <Td>{l.employeeName} <span style={{ color: C.t3 }}>({l.employeeCode})</span></Td>
                    <Td>{l.department}</Td>
                    <Td>{money(l.gross)}</Td>
                    <Td style={{ color: C.red }}>{money(l.totalDeductions)}</Td>
                    <Td style={{ fontWeight: 700, color: C.cyan }}>{money(l.net)}</Td>
                    <Td>{money(l.employerTotal)}</Td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
        </div>
      )}

      {tab === 'employees' && (
        <DataTable title="Employees" headers={['Name','Code','Department','Position','Status']}>
          {employees.map((e) => (
            <tr key={e._id}>
              <Td style={{ fontWeight: 700 }}>{e.name}</Td>
              <Td>{e.employeeCode}</Td>
              <Td>{e.department || '—'}</Td>
              <Td>{e.position || '—'}</Td>
              <Td><Badge status={e.status || 'ACTIVE'} /></Td>
            </tr>
          ))}
        </DataTable>
      )}

      {tab === 'structures' && (
        <Card title="Salary structures">
          <p style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>
            Configure earnings/deductions on each employee profile in HR (Salary & Payroll). Structures are never auto-overwritten.
          </p>
          <DataTable title="Roster" headers={['Employee','Code','Dept','Position','Legacy salary ref']}>
            {structures.map((s) => (
              <tr key={s.id}>
                <Td>{s.name}</Td>
                <Td>{s.code}</Td>
                <Td>{s.dept || '—'}</Td>
                <Td>{s.position || '—'}</Td>
                <Td style={{ color: C.t3 }}>{s.salaryRef || '—'}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {tab === 'payslips' && (
        <div className="space-y-3">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={payslipQuery}
              onChange={(e) => setPayslipQuery(e.target.value)}
              placeholder="Search number / name / code"
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <button style={{...B.ghost,...B.sm}} onClick={() => loadPayslips()}>Search</button>
          </div>
          <DataTable title="Payslips" headers={['Number','Employee','Period','Net','Status','Actions']}>
            {payslips.map((p) => (
              <tr key={p._id}>
                <Td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.number}</Td>
                <Td>{p.employeeName}</Td>
                <Td>{p.year}-{String(p.month).padStart(2,'0')}</Td>
                <Td style={{ fontWeight: 700, color: C.cyan }}>{money(p.net)}</Td>
                <Td><Badge status={p.paymentStatus} /></Td>
                <Td>
                  <button
                    style={{...B.ghost,...B.sm, marginRight: 6}}
                    onClick={async () => {
                      await generatePayslipPdf(p, company)
                      await payrollV2API.auditDownload(p._id).catch(() => {})
                      onToast?.('PDF', `Downloaded ${p.number}`)
                    }}
                  >
                    PDF
                  </button>
                  {can('superadmin','fin_mgr') && p.paymentStatus !== 'VOID' && p.paymentStatus !== 'REISSUED' && (
                    <button
                      style={{...B.ghost,...B.sm}}
                      disabled={busy}
                      onClick={() => act(() => payrollV2API.reissuePayslip(p._id).then(() => loadPayslips()), 'Reissued')}
                    >
                      Reissue
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === 'my_payslips' && (
        <DataTable title="My Payslips (finalized / paid only)" headers={['Number','Period','Net','Status','Download']}>
          {myPayslips.map((p) => (
            <tr key={p._id}>
              <Td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.number}</Td>
              <Td>{p.year}-{String(p.month).padStart(2,'0')}</Td>
              <Td style={{ fontWeight: 700 }}>{money(p.net)}</Td>
              <Td><Badge status={p.paymentStatus} /></Td>
              <Td>
                <button
                  style={{...B.ghost,...B.sm}}
                  onClick={async () => {
                    await generatePayslipPdf(p, company)
                    await payrollV2API.auditDownload(p._id).catch(() => {})
                  }}
                >
                  PDF
                </button>
              </Td>
            </tr>
          ))}
          {!myPayslips.length && (
            <tr><Td colSpan={5} style={{ color: C.t3 }}>
              {user?.employeeCode
                ? 'No finalized payslips for your employee code yet.'
                : 'Link an employeeCode on your user account to view personal payslips.'}
            </Td></tr>
          )}
        </DataTable>
      )}

      {tab === 'reports' && (
        <Card title="Reports">
          <p style={{ fontSize: 13, color: C.t3 }}>
            Latest run totals: Gross {money(dash?.totals?.gross)} · Net {money(dash?.totals?.net)} · Employer {money(dash?.totals?.employerTotal)}.
            Use Payslips tab for PDF export. Migration inventory is available via the read-only backend script.
          </p>
        </Card>
      )}

      {tab === 'settings' && (
        <Card title="Settings">
          <p style={{ fontSize: 13, color: C.t3 }}>
            Structured payroll is enabled for tenant <strong>{company}</strong>. Payslip numbers use format LOPC-PS-YYYY-MM-######.
            Attendance fields on run lines are optional manual inputs and do not auto-adjust pay.
          </p>
        </Card>
      )}

      {tab === 'legacy' && (
        <LegacyPayrollRegister finRole={finRole} can={can} payroll={payroll} onToast={onToast} openModal={openModal} />
      )}
    </div>
  )
}

export default function PayrollManagement({ finRole, can, canEdit: _canEdit, payroll, setPayroll: _setPayroll, addAudit: _addAudit, onToast, openModal, financeApi: _financeApi }) {
  const { company } = useAuth()
  if (can('vendor','sales_head','dept_head')) return <Restricted msg="Payroll management is restricted to Finance and HR departments." />

  if (isStructuredPayrollEnabled(company)) {
    return (
      <StructuredPayroll
        finRole={finRole}
        can={can}
        payroll={payroll}
        onToast={onToast}
        openModal={openModal}
        company={company}
      />
    )
  }

  // Non-LoopC: original demo KPI + register UI unchanged
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
