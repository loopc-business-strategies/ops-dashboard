import { DEFAULT_VOUCHER_PRINT, normalizeVoucherPageSize } from '../erp/ERPBrandingUtils'

export const VOUCHER_TABLE_FONT_SIZE = 14

export const VOUCHER_CELL_PADDING = '8px 10px'

export const VOUCHER_BORDER = '1px solid #111827'

export const VOUCHER_COL_NO = '48px'
export const VOUCHER_COL_TYPE = '96px'
export const VOUCHER_COL_AMOUNT = '124px'

export { VOUCHER_PAGE_SIZES, normalizeVoucherPageSize } from '../erp/ERPBrandingUtils'
export const DEFAULT_VOUCHER_PAGE_SIZE = DEFAULT_VOUCHER_PRINT.pageSize

export const VOUCHER_NUMERIC_CELL_STYLE = {
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  paddingRight: 10,
}

export const VOUCHER_TABLE_BASE_STYLE = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontSize: `${VOUCHER_TABLE_FONT_SIZE}px`,
}

export const VOUCHER_TH_TD_BASE = {
  border: VOUCHER_BORDER,
  padding: VOUCHER_CELL_PADDING,
  verticalAlign: 'top',
}

export const VOUCHER_HEADER_ROW_STYLE = {
  background: '#E5E7EB',
}

export function getVoucherPrintMediaCss(pageSize = DEFAULT_VOUCHER_PAGE_SIZE) {
  const size = normalizeVoucherPageSize(pageSize, DEFAULT_VOUCHER_PAGE_SIZE)
  return `
  @media print {
    @page { size: ${size} portrait; margin: 5mm; }
    .voucher-screen-only { display: none !important; }
    .voucher-print-only { display: block !important; }
    body * { visibility: hidden; }
    .voucher-print-only, .voucher-print-only * { visibility: visible; }
    .voucher-print-only {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #FFFFFF;
      z-index: 2147483647;
      overflow: hidden;
      box-sizing: border-box;
      color-adjust: exact;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .voucher-print-sheet {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }
    .voucher-print-signatures { gap: 24px !important; }
    .voucher-print-only img {
      filter: none !important;
      mix-blend-mode: normal !important;
      color-adjust: exact;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`
}

export const VOUCHER_PRINT_MEDIA_CSS = getVoucherPrintMediaCss(DEFAULT_VOUCHER_PAGE_SIZE)

export function getVoucherSheetStyle(isPreview) {
  const base = {
    color: '#111827',
    fontFamily: 'Arial, sans-serif',
    fontSize: `${VOUCHER_TABLE_FONT_SIZE}px`,
    WebkitFontSmoothing: 'antialiased',
    textRendering: 'optimizeLegibility',
  }

  if (isPreview) {
    return {
      ...base,
      display: 'block',
      padding: '18px 24px',
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      maxWidth: '820px',
      margin: '0 auto',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
    }
  }

  return {
    ...base,
    display: 'none',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '18px 24px 24px',
    background: '#FFFFFF',
  }
}
