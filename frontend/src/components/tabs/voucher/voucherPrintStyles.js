export const VOUCHER_TABLE_FONT_SIZE = 14

export const VOUCHER_CELL_PADDING = '8px 10px'

export const VOUCHER_BORDER = '1px solid #111827'

export const VOUCHER_COL_NO = '48px'
export const VOUCHER_COL_TYPE = '96px'
export const VOUCHER_COL_AMOUNT = '124px'

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

export const VOUCHER_PRINT_MEDIA_CSS = `
  @media print {
    @page { size: A4 portrait; margin: 5mm; }
    .voucher-screen-only { display: none !important; }
    .voucher-print-only { display: block !important; }
    body * { visibility: hidden; }
    .voucher-print-only, .voucher-print-only * { visibility: visible; }
    .voucher-print-only {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      color-adjust: exact;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .voucher-print-only img {
      filter: none !important;
      mix-blend-mode: normal !important;
      color-adjust: exact;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`

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
    padding: '18px 24px 24px',
    minWidth: '1050px',
    background: '#FFFFFF',
  }
}
