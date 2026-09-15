import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { reportsApi } from '../../../api/erp-accounting/reports'
import { C, B, Badge, Td, Card, StatCard, SectionHeader, Restricted, DataTable, fmt, fmtFull } from './ui'

function mapOutstandingRows(report, side) {
  const rows = report?.rows || report?.items || report?.parties || report?.data || []
  if (!Array.isArray(rows)) return []
  return rows.map((r, i) => {
    const amount = Number(r.outstanding || r.balance || r.amount || r.total || 0)
    const overdueDays = Number(r.daysOverdue || r.overdueDays || r.overdue || 0)
    return {
      client: r.name || r.customerName || r.vendorName || r.partyName || r.client || `Party ${i + 1}`,
      inv: r.invoiceNo || r.docNo || r.reference || r.accountCode || '—',
      amount,
      due: r.dueDate || r.asOf || '—',
      overdue: overdueDays,
      status: overdueDays > 0 ? 'Overdue' : (r.status || 'Current'),
      side,
    }
  })
}

export default function ARAndAP({ finRole, can, canEdit: _canEdit, onToast }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receivables, setReceivables] = useState([])
  const [payables, setPayables] = useState([])
  const [source, setSource] = useState('erp')

  if (can('vendor', 'hr_mgr')) return <Restricted msg="Accounts Receivable & Payable is restricted." />
  const payOnly = finRole === 'dept_head'
  const recOnly = finRole === 'sales_head'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [ar, ap] = await Promise.all([
          reportsApi.getCustomerOutstandingReport(token, {}),
          reportsApi.getVendorOutstandingReport(token, {}),
        ])
        if (cancelled) return
        setReceivables(mapOutstandingRows(ar, 'ar'))
        setPayables(mapOutstandingRows(ap, 'ap'))
        setSource('erp')
      } catch (err) {
        if (cancelled) return
        setError(err?.response?.data?.message || 'Failed to load ERP outstanding balances')
        setReceivables([])
        setPayables([])
        setSource('error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) load()
    return () => { cancelled = true }
  }, [token])

  const totalRec = receivables.reduce((a, r) => a + Number(r.amount || 0), 0)
  const overdueRec = receivables.filter((r) => r.overdue > 0).reduce((a, r) => a + Number(r.amount || 0), 0)
  const totalPay = payables.reduce((a, p) => a + Number(p.amount || 0), 0)

  return (
    <div className="space-y-4">
      <SectionHeader title="Accounts Receivable & Payable" sub="Live ERP outstanding (not Finance seed data)">
        <span style={{ fontSize: 12, color: C.t3 }}>Source: {source === 'erp' ? 'ERP Accounting' : source}</span>
        <button
          style={{ ...B.ghost, ...B.sm }}
          onClick={() => onToast?.('AR Report', 'Open ERP Customer Outstanding report for export')}
        >
          ⬇ AR Report
        </button>
        <button
          style={{ ...B.ghost, ...B.sm }}
          onClick={() => onToast?.('AP Report', 'Open ERP Vendor Outstanding report for export')}
        >
          ⬇ AP Report
        </button>
      </SectionHeader>

      {loading && <Card title="Loading">Loading ERP outstanding balances…</Card>}
      {error && <Card title="Error"><span style={{ color: C.red }}>{error}</span></Card>}

      {!payOnly && !loading && (
        <Card title={<>Accounts Receivable <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>{fmt(totalRec)} total</span></>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 11, marginBottom: 14 }}>
            <StatCard label="Total Receivables" value={fmt(totalRec)} color={C.green} />
            <StatCard label="Overdue" value={fmt(overdueRec)} color={C.red} />
            <StatCard label="Current" value={fmt(totalRec - overdueRec)} color={C.cyan} />
          </div>
          {!receivables.length ? (
            <div style={{ color: C.t3, padding: 12 }}>No customer outstanding balances</div>
          ) : (
            <DataTable title="" headers={['Client', 'Invoice/Ref', 'Amount', 'Due Date', 'Days Overdue', 'Status']}>
              {receivables.map((r, i) => (
                <tr key={i} style={{ background: r.overdue > 0 ? 'rgba(255,71,87,.05)' : 'rgba(0,200,150,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <Td style={{ fontWeight: 700, color: C.t1 }}>{r.client}</Td>
                  <Td style={{ color: C.t3 }}>{r.inv}</Td>
                  <Td style={{ color: r.overdue > 0 ? C.red : C.green, fontWeight: 700 }}>{fmtFull(r.amount)}</Td>
                  <Td style={{ color: C.t3 }}>{r.due}</Td>
                  <Td style={{ color: r.overdue > 0 ? C.red : C.green }}>{r.overdue > 0 ? `${r.overdue} days` : '✓'}</Td>
                  <Td><Badge status={r.status} /></Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {!recOnly && !loading && (
        <Card title={<>Accounts Payable <span style={{ color: C.amber || C.t2, fontSize: 12, fontWeight: 600 }}>{fmt(totalPay)} total</span></>}>
          {!payables.length ? (
            <div style={{ color: C.t3, padding: 12 }}>No vendor outstanding balances</div>
          ) : (
            <DataTable title="" headers={['Vendor', 'Invoice/Ref', 'Amount', 'Due Date', 'Days Overdue', 'Status']}>
              {payables.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <Td style={{ fontWeight: 700, color: C.t1 }}>{p.client}</Td>
                  <Td style={{ color: C.t3 }}>{p.inv}</Td>
                  <Td style={{ fontWeight: 700 }}>{fmtFull(p.amount)}</Td>
                  <Td style={{ color: C.t3 }}>{p.due}</Td>
                  <Td style={{ color: p.overdue > 0 ? C.red : C.green }}>{p.overdue > 0 ? `${p.overdue} days` : '✓'}</Td>
                  <Td><Badge status={p.status} /></Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}
    </div>
  )
}
