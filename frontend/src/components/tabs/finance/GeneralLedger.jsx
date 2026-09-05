import { useState, useEffect } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { Modal } from '../../ui-components'
import { C, B, ML, Badge, Td, Card, StatCard, SectionHeader, Restricted, DataTable, fmtFull } from './ui'

export default function GeneralLedger({ finRole: _finRole, can, canEdit, onToast, token }) {
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [editModal, setEditModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [formData, setFormData] = useState({ date:'', debitAccount:'', creditAccount:'', amount:'', description:'' })

  useEffect(() => {
    if (!token) return
    setLoading(true)
    erpAccountingAPI.getLedger(token, { limit: 200 })
      .then(data => {
        const entries = (data.entries || []).map(e => ({
          _id: e._id,
          date: e.date ? new Date(e.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—',
          debitAccount: e.debitAccountId?.accountName || e.debitAccountId || '—',
          creditAccount: e.creditAccountId?.accountName || e.creditAccountId || '—',
          amount: e.amount || 0,
          description: e.description || '',
          status: e.bankReconciled ? 'Reconciled' : (e.isDeleted ? 'Reversed' : 'Posted'),
          _raw: e,
        }))
        setLedgerEntries(entries)
      })
      .catch(() => { onToast('Error', 'Failed to load ledger entries. Please retry.') })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload ledger when auth token changes only; onToast is not stable from parent
  }, [token])

  if (can('vendor','hr_mgr','dept_head','sales_head')) return <Restricted msg="General Ledger is restricted to Finance Manager, Super Admin and Auditor." />

  const pageSize = limit
  const totalPages = Math.ceil(ledgerEntries.length / pageSize)
  const paginatedEntries = ledgerEntries.slice((page - 1) * pageSize, page * pageSize)

  function openEditForm(entry) {
    setEditEntry(entry)
    setFormData({
      date: entry.date,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
      amount: String(entry.amount),
      description: entry.description,
    })
    setEditModal(true)
  }

  function saveEntry() {
    if (!formData.date || !formData.debitAccount || !formData.creditAccount || !formData.amount) {
      onToast('Missing Fields', 'Please fill all required fields')
      return
    }
    if (formData.debitAccount === formData.creditAccount) {
      onToast('Invalid Entry', 'Debit and Credit accounts must be different')
      return
    }
    
    setLedgerEntries(p => p.map(e => e._id === editEntry._id 
      ? { ...e, ...formData, amount: Number(formData.amount) }
      : e
    ))
    onToast('Saved', `Ledger entry ${editEntry._id} updated`)
    setEditModal(false)
  }

  function deleteEntry(entry) {
    if (!window.confirm(`Create reversal for ${entry._id}? Original will be marked as reversed.`)) return
    
    // Create reversal entry
    const reversal = {
      _id: `REV-${entry._id}`,
      date: new Date().toISOString().split('T')[0],
      debitAccount: entry.creditAccount,
      creditAccount: entry.debitAccount,
      amount: entry.amount,
      description: `REVERSAL of ${entry._id}: ${entry.description}`,
      status: 'Posted',
    }
    
    setLedgerEntries(p => [reversal, ...p.map(e => e._id === entry._id ? {...e, status:'Reversed'} : e)])
    onToast('Reversed', `Reversal entry created for ${entry._id}`)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="General Ledger" sub="Journal entries and ledger account balances">
        {canEdit() && <button style={{...B.pri,...B.sm}} onClick={() => { setEditEntry(null); setFormData({ date:'', debitAccount:'', creditAccount:'', amount:'', description:'' }); setEditModal(true) }}>+ New Entry</button>}
      </SectionHeader>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Entries" value={ledgerEntries.length} color={C.cyan} sub="This month" />
        <StatCard label="Posted" value={ledgerEntries.filter(e=>e.status==='Posted').length} color={C.green} sub="Ready for closing" />
        <StatCard label="Draft" value={ledgerEntries.filter(e=>e.status==='Draft').length} color={C.yellow} sub="Awaiting posting" />
        <StatCard label="Reversed" value={ledgerEntries.filter(e=>e.status==='Reversed').length} color={C.orange} sub="Audit trail maintained" />
      </div>

      <Card title={`Ledger Entries — Page ${page} of ${totalPages}`}>
        {loading && <div style={{ padding:20, textAlign:'center', color:C.t3, fontSize:13 }}>Loading ledger entries…</div>}
        {!loading && <DataTable title="" headers={['Date','Debit Account','Credit Account','Amount','Description','Status',...(canEdit()?['Actions']:[])]}>
          {paginatedEntries.map((entry,i) => (
            <tr key={entry._id} style={{ background:entry.status==='Reversed'?'rgba(255,71,87,.05)':entry.status==='Draft'?'rgba(255,214,0,.04)':(i%2===0?'#ffffff':'#f8f9fa'), borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <Td style={{ color:C.t3 }}>{entry.date}</Td>
              <Td style={{ fontWeight:700 }}>{entry.debitAccount}</Td>
              <Td style={{ fontWeight:700 }}>{entry.creditAccount}</Td>
              <Td style={{ color:C.cyan, fontWeight:700 }}>{fmtFull(entry.amount)}</Td>
              <Td style={{ color:C.t3, fontSize:11 }}>{entry.description}</Td>
              <Td><Badge status={entry.status} /></Td>
              {canEdit() && (
                <Td style={{ whiteSpace:'nowrap' }}>
                  {entry.status !== 'Reversed' && entry.status === 'Draft' && (
                    <>
                      <button onClick={() => openEditForm(entry)} style={{...B.link,color:'var(--purple)',marginRight:8}}>Edit</button>
                      <button onClick={() => deleteEntry(entry)} style={{...B.link,color:C.red}}>Reverse</button>
                    </>
                  )}
                  {entry.status === 'Reversed' && <span style={{ color:C.t4, fontSize:11 }}>—</span>}
                </Td>
              )}
            </tr>
          ))}
        </DataTable>}

        {/* Pagination Controls */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, color:C.t3 }}>
            Showing {paginatedEntries.length > 0 ? (page-1)*pageSize + 1 : 0}–{Math.min(page*pageSize, ledgerEntries.length)} of {ledgerEntries.length}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }} style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:6, padding:'5px 8px', fontSize:12 }}>
              <option>10</option><option>25</option><option>50</option><option>100</option>
            </select>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{...B.ghost,...B.sm, opacity:page===1?0.5:1}}>← Prev</button>
            <span style={{ fontSize:12, color:C.t3, minWidth:'30px', textAlign:'center' }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{...B.ghost,...B.sm, opacity:page===totalPages?0.5:1}}>Next →</button>
          </div>
        </div>
      </Card>

      {/* Edit Modal */}
      {editModal && (
        <Modal title={editEntry ? 'Edit Ledger Entry' : 'New Ledger Entry'} onClose={() => setEditModal(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><ML>Date</ML><input type="date" value={formData.date} onChange={e=>setFormData(p=>({...p,date:e.target.value}))} style={iStyle} /></div>
            <div><ML>Amount ({financeBaseCurrencyCode})</ML><input type="number" value={formData.amount} onChange={e=>setFormData(p=>({...p,amount:e.target.value}))} style={iStyle} /></div>
            <div><ML>Debit Account</ML><input value={formData.debitAccount} onChange={e=>setFormData(p=>({...p,debitAccount:e.target.value}))} style={iStyle} placeholder="e.g. Cash" /></div>
            <div><ML>Credit Account</ML><input value={formData.creditAccount} onChange={e=>setFormData(p=>({...p,creditAccount:e.target.value}))} style={iStyle} placeholder="e.g. Revenue" /></div>
          </div>
          <ML>Description</ML>
          <textarea value={formData.description} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} style={{ ...iStyle, resize:'vertical', minHeight:65 }} placeholder="Transaction description..." />
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button style={{ ...B.ghost, flex:1 }} onClick={() => setEditModal(false)}>Cancel</button>
            <button style={{ ...B.pri, flex:1 }} onClick={saveEntry}>{editEntry ? 'Save Changes' : 'Create Entry'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Audit Trail ──────────────────────────────────────────────
