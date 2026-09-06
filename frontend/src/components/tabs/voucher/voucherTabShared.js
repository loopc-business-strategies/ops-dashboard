/** Shared voucher UI constants; domain helpers live in erp/voucherUtils.js */
export const BASE = '/api/erp-accounting'
export const cfg = () => ({ withCredentials: true })

export {
  fmt,
  today,
  emptyLine,
  normalizeMongoIdField,
  emptyHeader,
  DOC_PREFIX_BY_TYPE,
  METAL_STOCK_VOUCHER_TYPES,
  METAL_STOCK_IN_VOUCHER_TYPES,
  METAL_STOCK_OUT_VOUCHER_TYPES,
  METAL_TRANSFER_VOUCHER_TYPES,
  isMetalStockVoucherType,
  isMetalTransferVoucherType,
  hasMetalTransferLineQuantity,
  isMetalStockInVoucherType,
  isMetalStockOutVoucherType,
  getDocYear,
  parseAnyVoucherDocMeta,
  parseVoucherDocMeta,
  buildVoucherDocNo,
  coerceVoucherDocNo,
  normalizeLookupValue,
  normalizeLineType,
  FIXED_AED_RATE,
  toFinitePositive,
  backendRateToDisplayRate,
  displayRateToBackendRate,
  normalizeRateType,
  normalizeVoucherFixingType,
  formatPartyAddress,
  decodeInventoryCategoryMeta,
  normalizeMetalSymbol,
  normalizeStockGroup,
  toTitle,
  decodeFullMeta,
  getAccountCodeValue,
  getAccountNameValue,
  isBankLikeAccount,
  pickDefaultAccountCodeByType,
  sortVouchersByDocNo,
  nextVocNo,
  displayVoucherDocNo,
  computeVoucherGrandTotal,
  numberToWords,
} from '../erp/voucherUtils'
export const S = {
  // Colours — tenant tokens where brand-facing
  green: 'var(--brand-button-bg, var(--brand-dark))',
  greenDark: 'var(--brand-dark)',
  danger: '#DC2626',
  ink: 'var(--text-primary, #111827)',
  muted: 'var(--text-muted, #6B7280)',
  border: 'var(--border, #E5E7EB)',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  blueSoft: 'var(--brand-soft)',
  headerBg: 'var(--brand-soft)',
}

export const fieldRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '0.6rem 1rem',
  marginBottom: '0.5rem',
}

export const fieldGroup = (label, children, span) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  gridColumn: span ? `span ${span}` : undefined,
})

export const labelStyle = { fontSize: '0.72rem', fontWeight: '600', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }

export const inputStyle = {
  padding: '0.4rem 0.65rem',
  border: `1px solid var(--border-input, #9CA3AF)`,
  borderRadius: '8px',
  fontSize: '0.875rem',
  background: S.white,
  color: S.ink,
  width: '100%',
  boxSizing: 'border-box',
}

export const readInput = { ...inputStyle, background: S.bg, color: S.muted }

export const sectionBox = {
  border: `1px solid ${S.border}`,
  borderRadius: '10px',
  marginBottom: '1rem',
  overflow: 'visible',
}

export const sectionHeader = {
  background: S.headerBg,
  padding: '0.45rem 0.8rem',
  fontWeight: '700',
  fontSize: '0.8rem',
  color: 'var(--brand-on-soft)',
  borderBottom: `1px solid var(--brand-border)`,
  letterSpacing: '0.03em',
}

export const sectionBody = { padding: '0.75rem' }

export const btn = (variant = 'primary') => ({
  padding: '0.45rem 1rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  border: 'none',
  ...(variant === 'primary' ? { background: S.green, color: S.white } :
     variant === 'secondary' ? { background: S.white, color: S.ink, border: `1px solid ${S.border}` } :
     variant === 'danger' ? { background: S.danger, color: S.white } :
     variant === 'gray' ? { background: '#E5E7EB', color: S.ink } : {}),
})

export const tabBtn = (active) => ({
  padding: '0.42rem 1rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: active ? 'var(--brand-dark)' : '#374151',
  background: active ? 'var(--brand-soft)' : '#FFFFFF',
  border: `1px solid ${active ? 'var(--brand-border)' : 'var(--border, #E5E7EB)'}`,
  borderBottom: active ? '2px solid var(--brand-primary)' : '1px solid var(--border, #E5E7EB)',
  boxShadow: 'none',
  borderRadius: '8px 8px 0 0',
  cursor: 'pointer',
  minWidth: '88px',
})

export const classicHeaderShell = {
  padding: '0.1rem 0',
}

export const classicHeaderGrid = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.65rem',
  alignItems: 'start',
}

export const classicPanel = {
  border: `1px solid ${S.border}`,
  borderRadius: '10px',
  background: '#FFFFFF',
  boxShadow: 'none',
  overflow: 'visible',
  alignSelf: 'start',
  height: 'fit-content',
}

export const classicPanelTitle = {
  background: 'var(--brand-soft)',
  borderBottom: '1px solid var(--brand-border)',
  color: 'var(--brand-on-soft)',
  fontSize: '0.72rem',
  fontWeight: '700',
  letterSpacing: '0.04em',
  padding: '0.45rem 0.65rem',
  textTransform: 'uppercase',
}

export const classicPartyGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.25fr) minmax(140px, 0.75fr)',
  gap: '0.38rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'end',
}

export const classicPartyCard = {
  margin: '0 0.55rem 0.55rem',
  border: `1px solid ${S.border}`,
  borderRadius: '8px',
  background: '#FFFFFF',
  overflow: 'hidden',
}

export const classicPartyCardHeader = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  borderBottom: '1px solid var(--brand-border)',
  background: 'var(--brand-soft)',
}

export const classicPartyCardTitle = {
  padding: '0.46rem 0.68rem',
  fontSize: '0.82rem',
  fontWeight: '700',
  color: 'var(--brand-on-soft)',
  borderRight: '1px solid var(--brand-border)',
  background: 'var(--brand-soft)',
  textShadow: 'none',
}

export const classicPartyCardCodeWrap = {
  display: 'grid',
  gridTemplateColumns: 'minmax(96px, auto) 28px',
  background: '#FFFFFF',
}

export const classicPartyCardCode = {
  padding: '0.42rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: '#374151',
  background: '#FFFFFF',
  borderRight: `1px solid ${S.border}`,
  minWidth: '96px',
  textAlign: 'left',
}

export const classicPartyCardCodeInput = {
  width: '100%',
  border: 0,
  outline: 'none',
  background: '#FFFFFF',
  padding: '0.42rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: '#374151',
  boxSizing: 'border-box',
}

export const classicPartyCardSearch = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.9rem',
  color: '#6B7280',
  background: '#F8FAFC',
  border: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
}

export const classicPartyCardName = {
  padding: '0.55rem 0.68rem',
  fontSize: '1.12rem',
  fontWeight: '800',
  color: 'var(--text-primary, #111827)',
  borderBottom: `1px solid ${S.border}`,
  minHeight: '2.55rem',
  display: 'flex',
  alignItems: 'center',
  letterSpacing: '0.01em',
  background: '#FFFFFF',
}

export const classicPartyCardBody = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.55rem 0.7rem',
  padding: '0.55rem 0.6rem 0.65rem',
}

export const classicPartyCardField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.18rem',
  minWidth: 0,
}

export const classicPartyCardFieldLabel = {
  fontSize: '0.66rem',
  fontWeight: '700',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export const classicPartyCardFieldValue = {
  fontSize: '0.8rem',
  color: '#111827',
  minHeight: '1rem',
  wordBreak: 'break-word',
}

export const classicRightGrid = {
  display: 'grid',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  gap: '0.32rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'center',
}

export const classicLabel = {
  fontSize: '0.7rem',
  fontWeight: '700',
  color: '#4B5563',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

export const classicInput = {
  ...inputStyle,
  minHeight: '1.9rem',
  borderRadius: '8px',
  borderColor: 'var(--border-input, #9CA3AF)',
  background: '#FFFFFF',
  boxShadow: 'none',
  padding: '0.28rem 0.45rem',
  fontSize: '0.82rem',
}

export const classicReadInput = {
  ...classicInput,
  background: '#F8FAFB',
  color: '#4B5563',
}

export const classicTextAreaRow = {
  borderTop: `1px solid ${S.border}`,
  display: 'grid',
  gridTemplateColumns: '96px 150px',
  gap: '0.4rem 0.55rem',
  padding: '0.5rem 0.65rem 0.65rem',
  alignItems: 'center',
}

export const metalWin = {
  shell: {
    border: '1px solid var(--border, #E5E7EB)',
    borderRadius: '12px',
    background: '#FFFFFF',
    boxShadow: 'var(--shadow-card, 0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06))',
  },
  body: {
    padding: '0.65rem 0.75rem',
    background: '#FFFFFF',
  },
  tabLabel: {
    color: 'var(--brand-on-soft)',
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand-border)',
    textShadow: 'none',
  },
  headerRow: {
    background: 'var(--brand-soft)',
    color: 'var(--brand-on-soft)',
    borderBottom: '1px solid var(--brand-border)',
  },
  tableCell: {
    borderRight: '1px solid var(--border, #E5E7EB)',
    borderBottom: '1px solid var(--border, #E5E7EB)',
    background: '#FFFFFF',
  },
  summaryHeader: {
    background: 'var(--brand-soft)',
    color: 'var(--brand-on-soft)',
  },
}

export const metalTopInlineRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '0.55rem',
  alignItems: 'end',
  marginBottom: '0.55rem',
}

export const metalTopField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

