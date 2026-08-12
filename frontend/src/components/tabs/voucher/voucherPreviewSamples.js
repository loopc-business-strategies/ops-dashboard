import { isMetalTransferVoucherType } from './voucherTabShared'
import { isProfessionalMetalVoucherType } from './professionalVoucherPrint'
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
  fixingType: isProfessionalMetalVoucherType(voucherType) ? 'fixing' : '',
})

const buildSampleHeader = (voucherType) => {
  const isMetal = isProfessionalMetalVoucherType(voucherType)
  const type = String(voucherType || '').trim().toLowerCase()
  return {
    vocNo: isMetal
      ? (type === 'sale' ? '47' : 'MRec-0001')
      : 'PAY-0001',
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
    grossWeight: 12.5,
    purity: 0.999,
    pureWeight: 12.4875,
    makingRate: 15,
    makingCharges: 187.31,
    metalAmount: 29721.25,
    amountFC: 29721.25,
    amountLC: 29721.25,
    totalAmount: 29721.25,
    vatPer: 5,
    vatAmountLC: 1486.06,
    amountWithVAT: 31207.31,
    metalRate: 2380,
    remarks: 'Sample metal line',
  },
  {
    acCode: 'INV-XAG',
    stockCode: 'XAG-999',
    productType: 'Silver 999',
    metalSymbol: 'XAG',
    grossWeight: 50,
    purity: 0.999,
    pureWeight: 49.95,
    makingRate: 2,
    makingCharges: 99.9,
    metalAmount: 1198.8,
    amountFC: 1198.8,
    amountLC: 1198.8,
    totalAmount: 1198.8,
    vatPer: 5,
    vatAmountLC: 59.94,
    amountWithVAT: 1258.74,
    metalRate: 24,
    remarks: 'Second sample line',
  },
])

const buildSampleLines = (voucherType) => (
  isProfessionalMetalVoucherType(voucherType) ? buildSampleMetalLines() : buildSampleCurrencyLines()
)

const buildSampleTotals = (lines) => {
  const grandTotal = lines.reduce((sum, line) => {
    const value = Number(line.amountWithVAT || line.totalAmount || line.amountLC || line.amountFC || 0)
    return sum + value
  }, 0)
  return {
    ...EMPTY_TOTALS,
    total: grandTotal,
    grandTotal,
    pureWeightTotal: lines.reduce((sum, line) => sum + Number(line.pureWeight || 0), 0),
    vatAmount: lines.reduce((sum, line) => sum + Number(line.vatAmountLC || line.vatAmountFC || 0), 0),
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
  const isMetalVoucher = isProfessionalMetalVoucherType(normalizedType)
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
