import React from 'react'

export const EXPENSE_PAYMENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'bank', label: 'Bank' },
  { key: 'cash', label: 'Cash' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'other', label: 'Other' },
]

const smallControl = {
  border: '1px solid #E5E7EB',
  borderRadius: '0.45rem',
  background: '#FFFFFF',
  color: '#374151',
  fontSize: '0.72rem',
  fontWeight: '600',
  padding: '0 0.55rem',
  height: 30,
  boxSizing: 'border-box',
  lineHeight: 1,
}

const dateControl = {
  ...smallControl,
  width: 118,
  maxWidth: 118,
  minWidth: 118,
  padding: '0 0.35rem',
  flexShrink: 0,
}

function expensePaymentBadgeStyle(source) {
  const styles = {
    bank: { background: '#DBEAFE', color: '#1D4ED8' },
    cash: { background: '#DCFCE7', color: '#166534' },
    transfer: { background: '#EDE9FE', color: '#5B21B6' },
    other: { background: '#F3F4F6', color: '#4B5563' },
  }
  return styles[source] || styles.other
}

function formatExpenseDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function fmtDollar(val) {
  const n = Number(val || 0)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ExpenseRegisterSection({
  items = [],
  total = 0,
  loading = false,
  error = '',
  paymentFilter = 'all',
  onPaymentFilterChange,
  categoryFilter = '',
  onCategoryFilterChange,
  categoryOptions = [],
  startDate = '',
  onStartDateChange,
  endDate = '',
  onEndDateChange,
  onOpenLedgerEntry,
  onAfterLedgerOpen,
  scrollMinHeight,
  scrollMaxHeight = '320px',
  fillHeight = false,
  style,
}) {
  const scrollStyle = fillHeight
    ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }
    : scrollMaxHeight && scrollMaxHeight !== 'none'
      ? {
        minHeight: scrollMinHeight || undefined,
        maxHeight: scrollMaxHeight,
        overflowY: 'auto',
        overflowX: 'auto',
      }
      : { overflowX: 'auto' }

  const handleLedgerOpen = (row) => {
    onOpenLedgerEntry?.(row)
    onAfterLedgerOpen?.()
  }

  return (
    <section style={{
      border: '1px solid #E5E7EB',
      borderRadius: '0.65rem',
      overflow: 'hidden',
      background: '#FFFFFF',
      ...(fillHeight ? { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } : {}),
      ...style,
    }}>
      <div style={{
        padding: '0.4rem 0.55rem',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
          {EXPENSE_PAYMENT_FILTERS.map((chip) => {
            const active = paymentFilter === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onPaymentFilterChange?.(chip.key)}
                style={{
                  border: `1px solid ${active ? '#059669' : '#E5E7EB'}`,
                  background: active ? '#ECFDF5' : '#FAFAFA',
                  color: active ? '#047857' : '#4B5563',
                  borderRadius: 999,
                  padding: '0.26rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  height: 30,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange?.(e.target.value)}
            style={{ ...smallControl, width: 136, minWidth: 136, maxWidth: 136, flexShrink: 0 }}
            aria-label="Expense category"
          >
            <option value="">All categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange?.(e.target.value)}
            style={dateControl}
            aria-label="Expense start date"
          />
          <span style={{ color: '#9CA3AF', fontSize: '0.72rem', flexShrink: 0 }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange?.(e.target.value)}
            style={dateControl}
            aria-label="Expense end date"
          />
          <span style={{ color: '#64748B', fontSize: '0.74rem', fontWeight: '700', marginLeft: 'auto', flexShrink: 0 }}>
            {loading ? 'Loading…' : `${Number(total || 0).toLocaleString()} entries`}
          </span>
        </div>
      </div>
      <div style={scrollStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#64748B' }}>
              {['Date', 'Category', 'Description', 'Amount', 'Type', 'Account route', 'Ledger', ''].map((head) => (
                <th key={head || 'action'} style={{ padding: '0.65rem 0.85rem', textAlign: head === 'Amount' ? 'right' : 'left', fontWeight: '800', whiteSpace: 'nowrap' }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>Loading expense register…</td></tr>
            ) : error ? (
              <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#DC2626' }}>{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#9CA3AF' }}>No expenses found for the selected filters.</td></tr>
            ) : items.map((row) => {
              const badge = expensePaymentBadgeStyle(row.paymentSource)
              return (
                <tr key={row.id} style={{ borderTop: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#111827', whiteSpace: 'nowrap' }}>{formatExpenseDate(row.date)}</td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#111827', fontWeight: '700' }}>{row.category}</td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#374151', maxWidth: 220 }}>{row.description}</td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#111827', fontWeight: '900', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDollar(row.amount)}</td>
                  <td style={{ padding: '0.65rem 0.85rem' }}>
                    <span style={{ ...badge, display: 'inline-block', borderRadius: 4, padding: '2px 8px', fontSize: '0.68rem', fontWeight: '800' }}>
                      {row.paymentMethod || 'Other'}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#2563EB', minWidth: 200, maxWidth: 280 }}>
                    <div style={{ fontSize: '0.74rem', lineHeight: 1.35 }}>{row.paymentRoute || `${row.fundingAccount || '—'} → ${row.expenseAccount || '—'}`}</div>
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#374151', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'capitalize' }}>{row.referenceType || 'journal'}</div>
                    {row.ledgerRef ? <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 2 }}>{row.ledgerRef}</div> : null}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                    {onOpenLedgerEntry ? (
                      <button
                        type="button"
                        onClick={() => handleLedgerOpen(row)}
                        style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '0.4rem', padding: '0.28rem 0.55rem', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                      >
                        Open in Ledger
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
