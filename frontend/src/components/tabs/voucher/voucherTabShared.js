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
  // Colours
  green: 'var(--purple-light)',
  greenDark: 'var(--purple)',
  danger: '#DC2626',
  ink: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  blueSoft: '#EFF6FF',
  headerBg: '#F3F4F6',
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
  padding: '0.35rem 0.6rem',
  border: `1px solid ${S.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.875rem',
  background: S.white,
  color: S.ink,
  width: '100%',
  boxSizing: 'border-box',
}

export const readInput = { ...inputStyle, background: S.bg, color: S.muted }

export const sectionBox = {
  border: `1px solid ${S.border}`,
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  overflow: 'visible',
}

export const sectionHeader = {
  background: S.headerBg,
  padding: '0.4rem 0.8rem',
  fontWeight: '700',
  fontSize: '0.8rem',
  color: S.ink,
  borderBottom: `1px solid ${S.border}`,
  letterSpacing: '0.03em',
}

export const sectionBody = { padding: '0.75rem' }

export const btn = (variant = 'primary') => ({
  padding: '0.45rem 1rem',
  borderRadius: '0.375rem',
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
  color: active ? 'var(--purple)' : '#374151',
  background: active
    ? 'linear-gradient(180deg, #FFF7F0 0%, #FFE8D0 100%)'
    : 'linear-gradient(180deg, #FFFFFF 0%, #ECECEC 100%)',
  border: `1px solid ${active ? 'var(--purple)' : '#BFC5CB'}`,
  borderTop: '1px solid #F8FAFC',
  borderLeft: '1px solid #EEF2F7',
  boxShadow: active
    ? 'inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(15,23,42,0.08)'
    : 'inset 0 1px 0 rgba(255,255,255,0.9)',
  borderRadius: '0.24rem 0.24rem 0 0',
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
  border: '1px solid #C9CED6',
  borderRadius: '0.25rem',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)',
  overflow: 'visible',
  alignSelf: 'start',
  height: 'fit-content',
}

export const classicPanelTitle = {
  background: 'linear-gradient(180deg, #F3F4F6 0%, #D8DCE2 100%)',
  borderBottom: '1px solid #C9CED6',
  color: '#4B5563',
  fontSize: '0.72rem',
  fontWeight: '700',
  letterSpacing: '0.04em',
  padding: '0.42rem 0.65rem',
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
  border: '1px solid #C9CED6',
  borderRadius: '0.2rem',
  background: '#FBFCFE',
  overflow: 'hidden',
}

export const classicPartyCardHeader = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  borderBottom: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #F8FBFF 0%, #E6ECF5 100%)',
}

export const classicPartyCardTitle = {
  padding: '0.46rem 0.68rem',
  fontSize: '0.82rem',
  fontWeight: '700',
  color: '#F9FAFB',
  borderRight: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #B8C4D6 0%, #94A3B8 100%)',
  textShadow: '0 1px 0 rgba(15,23,42,0.18)',
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
  borderRight: '1px solid #D7DCE3',
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
  background: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 100%)',
  border: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
}

export const classicPartyCardName = {
  padding: '0.55rem 0.68rem',
  fontSize: '1.12rem',
  fontWeight: '800',
  color: '#243B53',
  borderBottom: '1px solid #E5E7EB',
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
  borderRadius: '0.12rem',
  borderColor: '#C8CED6',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 1px rgba(15, 23, 42, 0.04)',
  padding: '0.28rem 0.45rem',
  fontSize: '0.82rem',
}

export const classicReadInput = {
  ...classicInput,
  background: '#F8FAFB',
  color: '#4B5563',
}

export const classicTextAreaRow = {
  borderTop: '1px solid #D4D8DE',
  display: 'grid',
  gridTemplateColumns: '96px 150px',
  gap: '0.4rem 0.55rem',
  padding: '0.5rem 0.65rem 0.65rem',
  alignItems: 'center',
}

export const metalWin = {
  shell: {
    border: '2px solid #7B8798',
    borderRadius: '0.45rem',
    background: '#E6E8EC',
    boxShadow: '0 14px 26px rgba(15, 23, 42, 0.45)',
  },
  body: {
    padding: '0.5rem 0.6rem',
    background: '#ECEFF3',
  },
  tabLabel: {
    color: '#334155',
    background: 'linear-gradient(180deg, #F2F4F7 0%, #D9DEE5 100%)',
    border: '1px solid #B7C0CC',
    textShadow: 'none',
  },
  headerRow: {
    background: 'linear-gradient(180deg, #F8F9FB 0%, #E7EAF0 100%)',
    color: '#374151',
    borderBottom: '1px solid #C9CED6',
  },
  tableCell: {
    borderRight: '1px solid #E5E7EB',
    borderBottom: '1px solid #D7DBE0',
    background: '#FFFFFF',
  },
  summaryHeader: {
    background: 'linear-gradient(180deg, #E8EAED 0%, #D4D8DF 100%)',
    color: '#374151',
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

