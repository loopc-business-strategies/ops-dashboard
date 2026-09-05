import { useState } from 'react'
import { Modal } from '../../ui-components'
import { C, B, ML, Badge, Td, Card, StatCard, SectionHeader, Restricted, DataTable, fmtFull } from './ui'

export default function TaxCompliance({ finRole: _finRole, can, canEdit, onToast, taxes, setTaxes, financeApi }) {
  const [taxModal, setTaxModal] = useState(false)
  const [editId, setEditId] = useState('')
  const [tf, setTf] = useState({ type:'', period:'', amount:'', due:'', filed:'—', status:'Pending' })
  if (can('vendor','hr_mgr','dept_head','sales_head')) return <Restricted msg="Tax & Compliance Financials are restricted to Finance Manager, Super Admin and Auditor." />

  function openTaxForm(row) {
    if (row) {
      setEditId(row.id || row._id?.toString() || '')
      setTf({ type:row.type, period:row.period, amount:String(row.amount), due:row.due, filed:row.filed, status:row.status })
    } else {
      setEditId('')
      setTf({ type:'', period:'', amount:'', due:'', filed:'—', status:'Pending' })
    }
    setTaxModal(true)
  }

  function saveTax() {
    if (!tf.type.trim() || !tf.period.trim() || !tf.amount) return
    const payload = { type:tf.type.trim(), period:tf.period.trim(), amount:Number(tf.amount)||0, due:tf.due||'—', filed:tf.filed||'—', status:tf.status }
    if (editId) {
      setTaxes(p => p.map(x => (x.id || x._id?.toString()) === editId ? { ...x, ...payload } : x))
      financeApi.taxes.update(editId, payload).catch(() => { onToast('Error', 'Save failed. Please refresh.') })
      onToast('Tax Updated', payload.type + ' updated')
    } else {
      financeApi.taxes.create(payload).then(doc => {
        if (doc) setTaxes(p => [{ ...doc, id: doc._id?.toString() || doc.id }, ...p])
        else setTaxes(p => [payload, ...p])
      }).catch(() => { setTaxes(p => [payload, ...p]) })
      onToast('Tax Entry Added', payload.type + ' added')
    }
    setTaxModal(false)
  }

  function deleteTax(row) {
    if (!window.confirm('Delete tax row for ' + row.type + '?')) return
    const rid = row.id || row._id?.toString()
    setTaxes(p => p.filter(x => (x.id || x._id?.toString()) !== rid))
    if (rid) financeApi.taxes.remove(rid).catch(() => { onToast('Error', 'Delete failed. Please refresh.') })
    onToast('Tax Deleted', row.type + ' removed')
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Tax & Compliance Financials" sub="Q1 2026 · KZ Jurisdiction">
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openTaxForm(null)}>+ File / Add Tax Return</button>}
      </SectionHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Tax Liability (Q1)"  value="$430,900" color={C.yellow} sub="All tax types combined" />
        <StatCard label="Tax Paid YTD"        value="$76,400"  color={C.green}  sub="VAT + Withholding filed" />
        <StatCard label="Next Due Date"       value="Apr 30"   color={C.red}    sub="17 days · Corp Tax due" />
        <StatCard label="Compliance Status">
          <div style={{ marginTop:6 }}><Badge status="Due Soon" /></div>
          <div style={{ fontSize:11, color:C.t3, marginTop:7 }}>2 filings pending</div>
        </StatCard>
      </div>
      <Card title="Tax Due Countdown — Corporate Tax">
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          {[{v:'17',l:'Days'},{v:'0',l:'Hours'},{v:'0',l:'Mins'}].map(c => (
            <div key={c.l} style={{ background:'rgba(255,255,255,.05)', borderRadius:10, padding:'8px 12px', textAlign:'center', flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--purple)' }}>{c.v}</div>
              <div style={{ fontSize:9, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginTop:2 }}>{c.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.t3, marginTop:10, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:C.red, display:'inline-block' }} />Corporate Tax $282,500 due April 30, 2026 — not yet filed</div>
      </Card>
      <DataTable title="Tax Register" toolbar={canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => openTaxForm(null)}>+ Add Tax Entry</button>}
        headers={['Tax Type','Period','Amount','Due Date','Filed Date','Status',...(canEdit()?['Actions']:[])]}>
        {taxes.map((t,i) => (
          <tr key={i} style={{ background:t.status==='Filed'?'rgba(0,200,150,.04)':'rgba(255,214,0,.04)', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <Td style={{ fontWeight:700, color:C.t1 }}>{t.type}</Td>
            <Td style={{ color:C.t3 }}>{t.period}</Td>
            <Td style={{ color:t.status==='Filed'?C.green:C.yellow, fontWeight:700 }}>{fmtFull(t.amount)}</Td>
            <Td style={{ color:t.status==='Due Soon'?C.red:C.t3 }}>{t.due}</Td>
            <Td style={{ color:t.filed==='—'?C.t4:C.green }}>{t.filed}</Td>
            <Td><Badge status={t.status} /></Td>
            {canEdit() && <Td style={{ whiteSpace:'nowrap' }}>
              {t.filed==='—' ? <button onClick={async () => {
                const rid = t.id || t._id?.toString()
                const prevTaxes = taxes
                setTaxes(p => p.map(x => (x.id || x._id?.toString()) === rid ? { ...x, filed:'Today', status:'Filed' } : x))
                if (!rid) {
                  onToast('Error', 'Tax record id is missing. Please refresh and try again.')
                  setTaxes(prevTaxes)
                  return
                }
                try {
                  await financeApi.taxes.update(rid, { filed:'Today', status:'Filed' })
                  onToast('Filed', t.type + ' marked as filed')
                } catch {
                  setTaxes(prevTaxes)
                  onToast('Error', 'Failed to mark tax as filed. Please try again.')
                }
              }} style={{...B.link,color:'var(--purple)',marginRight:8}}>Mark Filed</button> : <span style={{ color:C.t4, marginRight:8 }}>—</span>}
              <button onClick={() => openTaxForm(t)} style={{...B.link,color:C.cyan,marginRight:8}}>Edit</button>
              <button onClick={() => deleteTax(t)} style={{...B.link,color:C.red}}>Del</button>
            </Td>}
          </tr>
        ))}
      </DataTable>

      {taxModal && (
        <Modal title={editId ? 'Edit Tax Entry' : 'Add Tax Entry'} onClose={() => setTaxModal(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><ML>Tax Type</ML><input value={tf.type} onChange={e=>setTf(p=>({...p,type:e.target.value}))} style={iStyle} /></div>
            <div><ML>Period</ML><input value={tf.period} onChange={e=>setTf(p=>({...p,period:e.target.value}))} style={iStyle} placeholder="Q2 2026" /></div>
            <div><ML>Amount ({financeBaseCurrencyCode})</ML><input type="number" value={tf.amount} onChange={e=>setTf(p=>({...p,amount:e.target.value}))} style={iStyle} /></div>
            <div><ML>Due Date</ML><input value={tf.due} onChange={e=>setTf(p=>({...p,due:e.target.value}))} style={iStyle} placeholder="Apr 30, 2026" /></div>
            <div><ML>Filed Date</ML><input value={tf.filed} onChange={e=>setTf(p=>({...p,filed:e.target.value}))} style={iStyle} placeholder="—" /></div>
            <div><ML>Status</ML><select value={tf.status} onChange={e=>setTf(p=>({...p,status:e.target.value}))} style={iStyle}><option>Pending</option><option>Due Soon</option><option>Filed</option></select></div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button style={{ ...B.ghost, flex:1 }} onClick={() => setTaxModal(false)}>Cancel</button>
            <button style={{ ...B.pri, flex:1 }} onClick={saveTax}>{editId ? 'Save Changes' : 'Add Entry'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Reports & Analytics ──────────────────────────────────────
