/** Shared Finance tab design tokens (modals + tables). */
export const FINANCE_C = {
  grad: 'var(--grad-brand)',
  gbar: 'var(--grad-bar)',
  gfin: 'var(--grad-brand)',
  green: '#065f46',
  cyan: '#00b4d8',
  yellow: '#ffd600',
  orange: '#9a3412',
  red: '#ff4757',
  gold: '#f59e0b',
  t1: '#1c2a33',
  t2: '#374151',
  t3: '#334155',
  t4: '#475569',
  border: 'rgba(var(--purple-rgb),0.15)',
  border2: 'rgba(var(--purple-rgb),0.35)',
  card: '#ffffff',
  inp: '#f8f9fa',
}

export const financeInputStyle = {
  width: '100%',
  background: '#f8f9fa',
  border: '1.5px solid rgba(var(--purple-rgb),.25)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  color: '#1c2a33',
  fontFamily: 'inherit',
  outline: 'none',
  marginBottom: 12,
  boxSizing: 'border-box',
}

export function fmtFull(n) {
  return `$${Number(n).toLocaleString()}`
}
