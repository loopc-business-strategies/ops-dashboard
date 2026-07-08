import { isMetalStockVoucherType, isMetalTransferVoucherType } from './voucherTabShared'
import { buildVoucherPrintModel } from './useVoucherPrintModel'

export const VOUCHER_PREVIEW_TYPES = [
  { key: 'payment', label: 'Payment Voucher' },
  { key: 'receipt', label: 'Receipt Voucher' },
  { key: 'purchase', label: 'Metal Purchase Voucher' },
  { key: 'sale', label: 'Metal Sale Voucher' },
  { key: 'metal_receipt', label: 'Metal Receipt Voucher' },
  { key: 'metal_payment', label: 'Metal Payment Voucher' },
]

const EMPTY_TOTALS = {
  grossWeightTotal: 0,
  pureWeightTotal: 0,
  pcsTotal: 0,
  metalTotal: 0,
  premiumTotal: 0,
  makingTotal: 0,
  total: 0,
  vatAmount: 0,
  grandTotal: 0,
}

const buildEmptyHeader = (voucherType) => ({
  vocNo: '',
  docDate: '',
  valueDate: '',
  partyCode: '',
  partyName: '',
  currCode: 'USD',
  branch: 'HO',
  fixingType: isMetalStockVoucherType(voucherType) ? 'fixing' : '',
})

const buildSampleHeader = (voucherType) => {
  const isMetal = isMetalStockVoucherType(voucherType)
  return {
    vocNo: isMetal ? 'MRec-0001' : 'PAY-0001',
    docDate: '2026-07-08',
    valueDate: '2026-07-08',
    partyCode: isMetal ? 'CUST-001' : 'VEND-001',
    partyName: isMetal ? 'Sample Customer LLC' : 'Sample Vendor LLC',
    currCode: 'USD',
    branch: 'HO',
    fixingType: isMetal ? 'fixing' : '',
    paymentTerms: '30 Days',
  }
}

const buildSampleCurrencyLines = () => ([
  {
    acCode: '6100',
    type: 'expense',
    amountFC: 1000,
    amountLC: 1000,
    narration: 'Office expenses',
  },
  {
    acCode: '6200',
    type: 'expense',
    amountFC: 500,
    amountLC: 500,
    narration: 'Travel expenses',
  },
])

const buildSampleMetalLines = () => ([
  {
    acCode: 'INV-XAU',
    stockCode: 'XAU-24K',
    productType: 'Gold 24K',
    metalSymbol: 'XAU',
    pureWeight: 10.5,
    amountFC: 25000,
    amountLC: 25000,
    totalAmount: 25000,
    metalRate: 2380,
    remarks: 'Sample metal line',
  },
  {
    acCode: 'INV-XAG',
    stockCode: 'XAG-999',
    productType: 'Silver 999',
    metalSymbol: 'XAG',
    pureWeight: 50,
    amountFC: 1200,
    amountLC: 1200,
    totalAmount: 1200,
    metalRate: 24,
    remarks: 'Second sample line',
  },
])

const buildSampleLines = (voucherType) => (
  isMetalStockVoucherType(voucherType) ? buildSampleMetalLines() : buildSampleCurrencyLines()
)

const buildSampleTotals = (lines) => {
  const grandTotal = lines.reduce((sum, line) => {
    const value = Number(line.totalAmount || line.amountLC || line.amountFC || 0)
    return sum + value
  }, 0)
  return {
    ...EMPTY_TOTALS,
    total: grandTotal,
    grandTotal,
    pureWeightTotal: lines.reduce((sum, line) => sum + Number(line.pureWeight || 0), 0),
  }
}

const resolveVoucherLabel = (voucherType) => (
  VOUCHER_PREVIEW_TYPES.find((item) => item.key === voucherType)?.label || 'Voucher'
)

/**
 * Build args for buildVoucherPrintModel from preview mode.
 */
export function buildVoucherPreviewContext({
  mode = 'empty',
  voucherType = 'payment',
  branding = {},
  user = {},
  live = null,
}) {
  const normalizedType = String(voucherType || 'payment').trim().toLowerCase()
  const isMetalVoucher = isMetalStockVoucherType(normalizedType)
  const isSimpleMetalVoucher = isMetalTransferVoucherType(normalizedType)

  if (mode === 'live' && live) {
    return {
      voucherType: normalizedType,
      header: live.header || {},
      effectiveLineItems: live.effectiveLineItems || [],
      totals: live.totals || EMPTY_TOTALS,
      accounts: live.accounts || [],
      user: live.user || user,
      reportBranding: live.reportBranding || branding,
      voucherLabel: live.voucherLabel || resolveVoucherLabel(normalizedType),
      isMetalVoucher,
      isSimpleMetalVoucher,
      findPartyOptionByCode: live.findPartyOptionByCode || (() => null),
      resolveVoucherParty: live.resolveVoucherParty || (() => ({})),
      lineItems: live.lineItems || live.effectiveLineItems || [],
    }
  }

  const header = mode === 'sample'
    ? buildSampleHeader(normalizedType)
    : buildEmptyHeader(normalizedType)
  const effectiveLineItems = mode === 'sample' ? buildSampleLines(normalizedType) : []
  const totals = mode === 'sample' ? buildSampleTotals(effectiveLineItems) : { ...EMPTY_TOTALS }

  return {
    voucherType: normalizedType,
    header,
    effectiveLineItems,
    totals,
    accounts: [],
    user,
    reportBranding: branding,
    voucherLabel: resolveVoucherLabel(normalizedType),
    isMetalVoucher,
    isSimpleMetalVoucher,
    findPartyOptionByCode: () => null,
    resolveVoucherParty: () => ({}),
    lineItems: effectiveLineItems,
  }
}

export function buildVoucherPreviewPrintModel(options) {
  return buildVoucherPrintModel(buildVoucherPreviewContext(options))
}
