import { useState } from 'react'
import { Modal } from '../../ui-components'
import { C, B, ML, Badge, Td, Card, StatCard, SectionHeader, Restricted, ProgressRow, InlineBar, DataTable, pct, fmt, fmtFull } from './ui'

export default function BudgetPlanning({ finRole, can, canEdit, onToast, openModal, budgets, setBudgets, financeApi }) {
  const [budgetModal, setBudgetModal] = useState(false)
  const [editId, setEditId] = useState('')
  const [bf, setBf] = useState({ dept:'', annual:'', spent:'' })
  if (can('vendor','sales_head','hr_mgr')) return <Restricted msg="Budget planning is not available for your role." />
  const deptOnly = finRole === 'dept_head'
  const data     = deptOnly ? budgets.filter(b=>b.dept==='Operations & Logistics') : budgets
  const totalB   = budgets.reduce((a,b)=>a+b.annual,0)
  const totalS   = budgets.reduce((a,b)=>a+b.spent,0)

  function openBudgetEditor(row) {
    if (row) {
      setEditId(row.id || row._id?.toString() || '')
      setBf({ dept:row.dept, annual:String(row.annual), spent:String(row.spent) })
    } else {
      setEditId('')
      setBf({ dept:'', annual:'', spent:'' })
    }
    setBudgetModal(true)
  }

  function saveBudget() {
    if (!bf.dept.trim() || !bf.annual) return
    const annual = Number(bf.annual) || 0
    const spent = Number(bf.spent) || 0
    const status = spent > annual ? 'Over Budget' : pct(spent, annual || 1) >= 80 ? 'Warning' : 'On Track'
    const payload = { dept:bf.dept.trim(), annual, spent, status }
    if (editId) {
      setBudgets(p => p.map(x => (x.id || x._id?.toString()) === editId ? { ...x, ...payload } : x))
      financeApi.budgets.update(editId, payload).catch(() => { onToast('Error', 'Save failed. Please refresh.') })
      onToast('Budget Updated', bf.dept.trim() + ' budget updated')
    } else {
      financeApi.budgets.create(payload).then(doc => {
        if (doc) setBudgets(p => [...p, { ...doc, id: doc._id?.toString() || doc.id }])
        else setBudgets(p => [...p, payload])
      }).catch(() => { setBudgets(p => [...p, payload]) })
      onToast('Budget Added', bf.dept.trim() + ' added')
    }
    setBudgetModal(false)
  }

  function deleteBudget(row) {
    if (!window.confirm('Delete budget for ' + row.dept + '?')) return
    const rid = row.id || row._id?.toString()
    setBudgets(p => p.filter(x => (x.id || x._id?.toString()) !== rid))
    if (rid) financeApi.budgets.remove(rid).catch(() => { onToast('Error', 'Delete failed. Please refresh.') })
    onToast('Budget Deleted', row.dept + ' budget removed')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Budget Planning" sub="FY 2026 — Annual Budget Overview">
        {finRole==='dept_head' && <button style={{...B.sec,...B.sm}} onClick={() => openModal('budget')}>↑ Request Increase</button>}
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openBudgetEditor(null)}>+ Add / Edit Budgets</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Annual Budget" value={fmt(totalB)} color={C.cyan}  sub="FY 2026" />
        <StatCard label="Spent to Date"       value={fmt(totalS)} color={C.t1}    progress={pct(totalS,totalB)} />
        <StatCard label="Remaining"           value={fmt(totalB-totalS)} color={C.green} sub="259 days remaining FY" />
      </div>
      <DataTable title="Department Budget Table" headers={['Department','Annual Budget','Spent','Remaining','% Used','Status',...(canEdit()?['Actions']:[])]}>
        {data.map((b) => {
          const p = pct(b.spent,b.annual)
          const rowBg = b.status==='Over Budget' ? 'rgba(255,71,87,.05)' : b.status==='Warning' ? 'rgba(255,214,0,.04)' : 'rgba(0,200,150,.04)'
          return (
            <tr key={b.dept} style={{ background:rowBg, borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ fontWeight:700, color:C.t1 }}>{b.dept}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(b.annual)}</Td>
              <Td>{fmtFull(b.spent)}</Td>
              <Td style={{ color:b.annual-b.spent>0?C.green:C.red, fontWeight:700 }}>{fmtFull(b.annual-b.spent)}</Td>
              <Td><InlineBar value={b.spent} max={b.annual} color={p>=100?C.red:p>=80?C.yellow:C.green} /></Td>
              <Td><Badge status={b.status} /></Td>
              {canEdit() && <Td style={{ whiteSpace:'nowrap' }}>
                <button onClick={() => openBudgetEditor(b)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Edit</button>
                <button onClick={() => deleteBudget(b)} style={{...B.link,color:C.red}}>Del</button>
              </Td>}
            </tr>
          )
        })}
      </DataTable>
      {!deptOnly && (
        <Card title="🪙 Gold Operations Budget — Separate Tracking">
          <ProgressRow label="Gold Procurement"      value={72} max={100} color={C.gold}  valLabel="72%" />
          <ProgressRow label="Transport & Security"  value={60} max={100} color={C.cyan}  valLabel="60%" />
          <ProgressRow label="Refining Costs"        value={45} max={100} color="var(--purple)" valLabel="45%" />
          <ProgressRow label="Compliance Costs"      value={38} max={100} color={C.green} valLabel="38%" />
        </Card>
      )}

      {budgetModal && (
        <Modal title={editId ? 'Edit Budget' : 'Add Budget'} onClose={() => setBudgetModal(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><ML>Department</ML><input value={bf.dept} onChange={e=>setBf(p=>({...p,dept:e.target.value}))} style={iStyle} placeholder="Department" /></div>
            <div><ML>Annual Budget ({financeBaseCurrencyCode})</ML><input type="number" value={bf.annual} onChange={e=>setBf(p=>({...p,annual:e.target.value}))} style={iStyle} /></div>
            <div><ML>Spent to Date ($)</ML><input type="number" value={bf.spent} onChange={e=>setBf(p=>({...p,spent:e.target.value}))} style={iStyle} /></div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button style={{ ...B.ghost, flex:1 }} onClick={() => setBudgetModal(false)}>Cancel</button>
            <button style={{ ...B.pri, flex:1 }} onClick={saveBudget}>{editId ? 'Save Changes' : 'Add Budget'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Payroll Management ───────────────────────────────────────
