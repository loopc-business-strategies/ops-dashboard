import { useState } from 'react'
import { FINANCE_C as C, financeInputStyle as iStyle, fmtFull } from './financeTabTokens'

function ModalOverlay({ open, onClose, title, sub, children, wide = false }) {
  if (!open) return null
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{
        background: C.card,
        border: `1px solid ${C.border2}`,
        borderRadius: 14,
        padding: 24,
        width: wide ? 700 : 560,
        maxWidth: '94%',
        maxHeight: '88vh',
        overflowY: 'auto',
        position: 'relative',
      }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: C.grad, borderRadius: '14px 0 0 14px' }} />
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: C.t3, marginBottom: 18 }}>{sub}</div>}
        {children}
      </div>
    </div>
  )
}

function ML({ children }) {
  return <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{children}</span>
}

function M2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

function MBtns({ onCancel, onSubmit, submitLabel = 'Submit', submitStyle }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(255,255,255,.07)', color: C.t2 }}>Cancel</button>
      <button type="button" onClick={onSubmit} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: submitStyle || C.grad, color: '#fff' }}>{submitLabel}</button>
    </div>
  )
}

export function InvoiceModal({ open, onClose, onSubmit, onToast }) {
  const [f, setF] = useState({ type: 'Sales Invoice (Receivable)', client: '', qty: '', price: '', fee: '', tax: '10', due: '', terms: 'Net 30' })
  const [calc, setCalc] = useState(null)
  const upd = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  function doCalc() {
    const sub = (parseFloat(f.qty) || 0) * (parseFloat(f.price) || 0) + (parseFloat(f.fee) || 0)
    const taxAmt = sub * ((parseFloat(f.tax) || 0) / 100)
    setCalc({ sub, taxAmt, total: sub + taxAmt })
  }
  function doSubmit() {
    if (!f.client.trim()) { onToast('Error', 'Please enter client / vendor name'); return }
    onSubmit(f, calc)
    setF({ type: 'Sales Invoice (Receivable)', client: '', qty: '', price: '', fee: '', tax: '10', due: '', terms: 'Net 30' })
    setCalc(null)
    onClose()
  }

  return (
    <ModalOverlay open={open} onClose={() => { onClose(); setCalc(null) }} title="Create Invoice" sub="Generate a sales or purchase invoice" wide>
      <M2>
        <div><ML>Invoice Type</ML><select value={f.type} onChange={upd('type')} style={iStyle}><option>Sales Invoice (Receivable)</option><option>Purchase Invoice (Payable)</option></select></div>
        <div><ML>Client / Vendor</ML><input value={f.client} onChange={upd('client')} placeholder="e.g. KazGold Distributors" style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Gold Quantity (kg)</ML><input type="number" value={f.qty} onChange={upd('qty')} placeholder="e.g. 50" style={iStyle} /></div>
        <div><ML>Price per kg ($)</ML><input type="number" value={f.price} onChange={upd('price')} placeholder="e.g. 58000" style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Service Fee ($)</ML><input type="number" value={f.fee} onChange={upd('fee')} placeholder="0" style={iStyle} /></div>
        <div><ML>Tax Rate (%)</ML><input type="number" value={f.tax} onChange={upd('tax')} style={iStyle} /></div>
      </M2>
      <M2>
        <div><ML>Due Date</ML><input type="date" value={f.due} onChange={upd('due')} style={iStyle} /></div>
        <div><ML>Payment Terms</ML><select value={f.terms} onChange={upd('terms')} style={iStyle}><option>Net 30</option><option>Net 60</option><option>Due on Receipt</option><option>Net 15</option></select></div>
      </M2>
      {calc && (
        <div style={{ background: 'rgba(var(--purple-rgb),.08)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.t3 }}><span>Subtotal</span><span>{fmtFull(calc.sub)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.t3, marginTop: 4 }}><span>Tax</span><span>{fmtFull(calc.taxAmt)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.t1, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}><span>Total</span><span style={{ color: C.green }}>{fmtFull(calc.total)}</span></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(0,0,0,0.1)', background: '#f3f4f6', color: C.t2 }}>Cancel</button>
        <button type="button" onClick={doCalc} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(0,180,216,.12)', color: C.cyan }}>Calculate</button>
        <button type="button" onClick={doSubmit} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.grad, color: '#fff' }}>Create Invoice</button>
      </div>
    </ModalOverlay>
  )
}

export function ExpenseModal({ open, onClose, onSubmit }) {
  const [f, setF] = useState({ dept: 'Operations', cat: 'Transport', amount: '', date: '', desc: '' })
  const upd = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const flagged = parseFloat(f.amount) >= 10000

  function doSubmit() {
    onSubmit({ ...f, amount: parseFloat(f.amount) || 0, flagged })
    setF({ dept: 'Operations', cat: 'Transport', amount: '', date: '', desc: '' })
    onClose()
  }

  return (
    <ModalOverlay open={open} onClose={onClose} title="Submit Expense" sub="Submit an expense for Finance Manager approval">
      <M2>
        <div><ML>Department</ML><select value={f.dept} onChange={upd('dept')} style={iStyle}>{['Operations', 'HR', 'Sales', 'Compliance', 'Production', 'Finance'].map((d) => <option key={d}>{d}</option>)}</select></div>
        <div><ML>Category</ML><select value={f.cat} onChange={upd('cat')} style={iStyle}>{['Transport', 'Salaries', 'Marketing', 'Admin', 'Compliance', 'Maintenance', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></div>
      </M2>
      <M2>
        <div><ML>Amount ($)</ML><input type="number" value={f.amount} onChange={upd('amount')} placeholder="e.g. 5000" style={iStyle} /></div>
        <div><ML>Date</ML><input type="date" value={f.date} onChange={upd('date')} style={iStyle} /></div>
      </M2>
      {flagged && <div style={{ background: 'rgba(255,71,87,.1)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.red, marginBottom: 12 }}>⚠️ Expenses above $10,000 require Finance Manager approval and will be auto-flagged.</div>}
      <ML>Description</ML>
      <textarea value={f.desc} onChange={upd('desc')} placeholder="Describe the expense..." style={{ ...iStyle, resize: 'vertical', minHeight: 65 }} />
      <MBtns onCancel={onClose} onSubmit={doSubmit} submitLabel="Submit Expense" />
    </ModalOverlay>
  )
}

export function PayrollModal({ open, onClose, onRun }) {
  const [auth, setAuth] = useState('')
  const [bank, setBank] = useState('Main Operations Account')

  return (
    <ModalOverlay open={open} onClose={onClose} title="Run Payroll — April 2026" sub="Confirm payroll processing for all active employees">
      <div style={{ background: 'rgba(0,200,150,.08)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
        {[['Total Employees', '47', C.t1], ['Total Net Pay', '$284,600', C.green], ['Payment Date', 'Apr 30, 2026', C.t1]].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: C.t2 }}>{l}</span><span style={{ color: c, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      <M2>
        <div><ML>Authorised By</ML><input value={auth} onChange={(e) => setAuth(e.target.value)} placeholder="Your name" style={iStyle} /></div>
        <div><ML>Bank Account</ML><select value={bank} onChange={(e) => setBank(e.target.value)} style={iStyle}><option>Main Operations Account</option><option>Payroll Dedicated Account</option></select></div>
      </M2>
      <MBtns onCancel={onClose} onSubmit={() => { onRun(auth, bank); setAuth(''); onClose() }} submitLabel="✓ Confirm & Run Payroll" submitStyle="linear-gradient(135deg,#00c896,#00b4d8)" />
    </ModalOverlay>
  )
}

export function BudgetModal({ open, onClose, onSubmit }) {
  const [dept, setDept] = useState('')
  const [amt, setAmt] = useState('')
  const [why, setWhy] = useState('')

  return (
    <ModalOverlay open={open} onClose={onClose} title="Request Budget Increase" sub="Submit a budget increase request for Finance Manager approval">
      <M2>
        <div><ML>Department</ML><input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Your department" style={iStyle} /></div>
        <div><ML>Amount Requested ($)</ML><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 50000" style={iStyle} /></div>
      </M2>
      <ML>Justification</ML>
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Explain why additional budget is needed..." style={{ ...iStyle, resize: 'vertical', minHeight: 65 }} />
      <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: 0 }}>
        {[{ n: 1, l: 'Dept Head\nSubmits', a: true }, { n: 2, l: 'Finance Mgr\nReviews', a: false }, { n: 3, l: 'Super Admin\nApproves', a: false }].map((s, i, arr) => (
          <div key={i} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 70 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: s.a ? 'var(--purple)' : 'rgba(255,255,255,.1)', color: s.a ? '#fff' : C.t3, boxShadow: s.a ? '0 0 0 3px rgba(var(--purple-rgb),.3)' : 'none' }}>{s.n}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 4, textAlign: 'center', whiteSpace: 'pre-line' }}>{s.l}</div>
            </div>
            {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,.1)', marginBottom: 16 }} />}
          </div>
        ))}
      </div>
      <MBtns onCancel={onClose} onSubmit={() => { onSubmit(dept, parseFloat(amt) || 0); setDept(''); setAmt(''); setWhy(''); onClose() }} submitLabel="Submit Request" />
    </ModalOverlay>
  )
}
