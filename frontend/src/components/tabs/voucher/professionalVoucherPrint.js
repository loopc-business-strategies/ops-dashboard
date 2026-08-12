export const PROFESSIONAL_METAL_VOUCHER_TYPES = ['purchase', 'sale', 'metal_receipt', 'metal_payment']
export const PROFESSIONAL_CURRENCY_VOUCHER_TYPES = ['payment', 'receipt']

export function isProfessionalMetalVoucherType(type) {
  return PROFESSIONAL_METAL_VOUCHER_TYPES.includes(String(type || '').trim().toLowerCase())
}

export function isProfessionalCurrencyVoucherType(type) {
  return PROFESSIONAL_CURRENCY_VOUCHER_TYPES.includes(String(type || '').trim().toLowerCase())
}

export function buildProfessionalMetalInvoiceTitle(voucherType, fixingDisplay = 'FIXED') {
  const fixing = String(fixingDisplay || 'FIXED').trim() || 'FIXED'
  switch (String(voucherType || '').trim().toLowerCase()) {
    case 'purchase':
      return `PURCHASE INVOICE (${fixing})`
    case 'metal_receipt':
      return `METAL RECEIPT (${fixing})`
    case 'metal_payment':
      return `METAL PAYMENT (${fixing})`
    case 'sale':
    default:
      return `TAX INVOICE (${fixing})`
  }
}

export function buildProfessionalCurrencyTitle(voucherType) {
  return String(voucherType || '').trim().toLowerCase() === 'receipt'
    ? 'RECEIPT VOUCHER'
    : 'PAYMENT VOUCHER'
}

export function buildProfessionalMetalCopyLabel(voucherType) {
  const type = String(voucherType || '').trim().toLowerCase()
  return (type === 'purchase' || type === 'metal_receipt') ? 'ACCOUNTS COPY' : 'PARTY COPY'
}

export function buildProfessionalCurrencyCopyLabel(voucherType) {
  return String(voucherType || '').trim().toLowerCase() === 'receipt' ? 'PARTY COPY' : 'ACCOUNTS COPY'
}

export function buildProfessionalCurrencyDocLabel(voucherType) {
  return String(voucherType || '').trim().toLowerCase() === 'receipt' ? 'REC NO' : 'PAY NO'
}

export const PROFESSIONAL_SHEET_STYLE = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  margin: '0 auto',
  pageBreakInside: 'avoid',
  colorAdjust: 'exact',
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
}
