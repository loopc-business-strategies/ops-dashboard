export const TRANSACTION_STATUS_STYLES = {
  draft: { background: '#FEF3C7', color: '#92400E' },
  submitted: { background: '#DBEAFE', color: '#1D4ED8' },
  approved: { background: '#DCFCE7', color: '#166534' },
  posted: { background: '#D1FAE5', color: '#065F46' },
  returned: { background: '#FCE7F3', color: '#9D174D' },
  rejected: { background: '#FEE2E2', color: '#B91C1C' },
}

export const formatDateInputLocal = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const ERP_TAB_COLORS = {
  p1: '#FFFFFF',
  p2: '#F3F4F6',
  s1: 'var(--brand-primary)',
  s2: 'var(--brand-dark, var(--brand-primary))',
  ink: '#111827',
  inkSoft: '#374151',
  t1: '#111827',
  t2: '#374151',
  t3: '#334155',
  danger: '#DC2626',
}

/** Shared register table cell styles (pair with `.erp-table` when possible). */
export const ERP_TABLE = {
  wrap: {
    width: '100%',
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  th: {
    height: 40,
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--brand-on-soft)',
    background: 'var(--brand-soft)',
    borderBottom: '1px solid var(--brand-border)',
    borderRight: '1px solid var(--brand-border)',
    whiteSpace: 'nowrap',
  },
  td: {
    height: 42,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    verticalAlign: 'middle',
    color: 'var(--text-primary)',
  },
  num: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'Consolas, "Courier New", monospace',
  },
}

/** Shared empty-state card for ERP tab sections */
export const ERP_EMPTY_CARD_STYLE = {
  background: '#F9FAFB',
  border: '1px dashed #D1D5DB',
  borderRadius: '0.5rem',
  padding: '1rem',
  color: ERP_TAB_COLORS.inkSoft,
  fontSize: '0.875rem',
}

export const ERP_MODAL_BACKDROP_STYLE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
  padding: '1rem',
}

export const ERP_MODAL_CARD_STYLE = {
  width: 'min(540px, 100%)',
  background: '#FFFFFF',
  borderRadius: '0.75rem',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.2)',
  padding: '1.25rem',
}

export const ERP_MODAL_INPUT_STYLE = {
  display: 'block',
  width: '100%',
  padding: '0.65rem 0.75rem',
  marginBottom: '0.75rem',
  background: '#F9FAFB',
  border: '1px solid #D1D5DB',
  color: ERP_TAB_COLORS.ink,
  borderRadius: '0.5rem',
}
