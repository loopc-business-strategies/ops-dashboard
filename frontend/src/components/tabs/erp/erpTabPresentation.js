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
  s1: 'var(--purple-light)',
  s2: 'var(--purple)',
  ink: '#111827',
  inkSoft: '#374151',
  t1: '#111827',
  t2: '#374151',
  t3: '#334155',
  danger: '#DC2626',
}
