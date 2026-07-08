/**
 * Default report branding / metal rate helpers (shared by currency + report routes).
 */

const DEFAULT_METAL_RATES = {
  goldPrice: 285,
  silverPrice: 3.5,
  priceCurrency: 'USD',
}

const DEFAULT_SIGNATORIES = [
  { title: "RECEIVER'S SIGNATURE", name: '', visible: true },
  { title: 'CHECKED BY', name: '', visible: true },
  { title: 'AUTHORISED SIGNATORY', name: '', visible: true },
]

const DEFAULT_STATEMENT_SIGNATORIES = [
  { title: 'Prepared By', name: '', visible: true },
  { title: 'Reviewed By', name: '', visible: true },
  { title: 'Authorized Signatory', name: '', visible: true },
]

const DEFAULT_VOUCHER_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
  tableHeaders: {
    no: 'No.',
    description: 'Account Description',
    type: 'Type',
    amountFc: 'Amount FC',
    amountLc: 'Amount',
  },
  signatories: DEFAULT_SIGNATORIES,
  confirmedForLabel: 'Confirmed for & on behalf of',
  footerNote: '',
}

const DEFAULT_STATEMENT_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
  title: 'Statement of Account',
  subtitle: '',
  footerNote: '',
  signatories: DEFAULT_STATEMENT_SIGNATORIES,
  showPrintNote: true,
}

const DEFAULT_REPORT_BRANDING = {
  key: 'default',
  entityName: 'Main Entity',
  branchName: '',
  isDefault: true,
  companyName: 'Ops Dashboard ERP',
  legalName: '',
  address: '',
  phone: '',
  trn: '',
  reportSubtitle: 'Finance & Accounts Division',
  logoUrl: '',
  logoWidth: 180,
  logoHeight: 56,
  logoFit: 'contain',
  reportFooter: 'Confidential Internal Statement',
  preparedByTitle: 'Prepared By',
  preparedByName: 'Finance Officer',
  reviewedByTitle: 'Reviewed By',
  reviewedByName: 'Accounts Manager',
  approvedByTitle: 'Authorized Signatory',
  approvedByName: 'Finance Controller',
  voucherPrint: DEFAULT_VOUCHER_PRINT,
  statementPrint: DEFAULT_STATEMENT_PRINT,
}

const clampOffset = (value, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, -120), 120)
}

const normalizeSignatories = (items, fallback) => {
  const source = Array.isArray(items) ? items : fallback
  return fallback.map((defaultItem, index) => {
    const item = source[index] || {}
    return {
      title: String(item.title ?? defaultItem.title).trim() || defaultItem.title,
      name: String(item.name ?? '').trim(),
      visible: item.visible !== false,
    }
  })
}

const normalizeTableHeaders = (headers = {}) => ({
  no: String(headers.no ?? DEFAULT_VOUCHER_PRINT.tableHeaders.no).trim() || DEFAULT_VOUCHER_PRINT.tableHeaders.no,
  description: String(headers.description ?? DEFAULT_VOUCHER_PRINT.tableHeaders.description).trim() || DEFAULT_VOUCHER_PRINT.tableHeaders.description,
  type: String(headers.type ?? DEFAULT_VOUCHER_PRINT.tableHeaders.type).trim() || DEFAULT_VOUCHER_PRINT.tableHeaders.type,
  amountFc: String(headers.amountFc ?? DEFAULT_VOUCHER_PRINT.tableHeaders.amountFc).trim() || DEFAULT_VOUCHER_PRINT.tableHeaders.amountFc,
  amountLc: String(headers.amountLc ?? DEFAULT_VOUCHER_PRINT.tableHeaders.amountLc).trim() || DEFAULT_VOUCHER_PRINT.tableHeaders.amountLc,
})

const normalizeVoucherPrint = (value = {}) => ({
  ...DEFAULT_VOUCHER_PRINT,
  ...(value || {}),
  logoOffsetX: clampOffset(value.logoOffsetX, DEFAULT_VOUCHER_PRINT.logoOffsetX),
  logoOffsetY: clampOffset(value.logoOffsetY, DEFAULT_VOUCHER_PRINT.logoOffsetY),
  logoTransparent: value.logoTransparent !== false,
  tableHeaders: normalizeTableHeaders(value.tableHeaders),
  signatories: normalizeSignatories(value.signatories, DEFAULT_SIGNATORIES),
  confirmedForLabel: String(value.confirmedForLabel ?? DEFAULT_VOUCHER_PRINT.confirmedForLabel).trim() || DEFAULT_VOUCHER_PRINT.confirmedForLabel,
  footerNote: String(value.footerNote ?? '').trim(),
})

const normalizeStatementPrint = (value = {}) => ({
  ...DEFAULT_STATEMENT_PRINT,
  ...(value || {}),
  logoOffsetX: clampOffset(value.logoOffsetX, DEFAULT_STATEMENT_PRINT.logoOffsetX),
  logoOffsetY: clampOffset(value.logoOffsetY, DEFAULT_STATEMENT_PRINT.logoOffsetY),
  logoTransparent: value.logoTransparent !== false,
  title: String(value.title ?? DEFAULT_STATEMENT_PRINT.title).trim() || DEFAULT_STATEMENT_PRINT.title,
  subtitle: String(value.subtitle ?? '').trim(),
  footerNote: String(value.footerNote ?? '').trim(),
  signatories: normalizeSignatories(value.signatories, DEFAULT_STATEMENT_SIGNATORIES),
  showPrintNote: value.showPrintNote !== false,
})

const normalizeBrandingKey = (value) => {
  const normalized = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

function createReportBrandingService({ MetalRate }) {
  const buildBrandingPayload = (doc) => {
    const raw = doc?.toObject ? doc.toObject() : doc || {}
    return {
      ...DEFAULT_REPORT_BRANDING,
      ...raw,
      voucherPrint: normalizeVoucherPrint(raw.voucherPrint),
      statementPrint: normalizeStatementPrint(raw.statementPrint),
    }
  }

  const buildBrandingProfiles = (docs = []) => {
    if (!docs.length) {
      return [{
        key: DEFAULT_REPORT_BRANDING.key,
        entityName: DEFAULT_REPORT_BRANDING.entityName,
        branchName: DEFAULT_REPORT_BRANDING.branchName,
        companyName: DEFAULT_REPORT_BRANDING.companyName,
        isDefault: DEFAULT_REPORT_BRANDING.isDefault,
      }]
    }

    return docs.map((doc) => {
      const branding = buildBrandingPayload(doc)
      return {
        key: branding.key,
        entityName: branding.entityName,
        branchName: branding.branchName,
        companyName: branding.companyName,
        isDefault: Boolean(branding.isDefault),
      }
    })
  }

  const getLatestMetalRate = async () => {
    const NON_FEED_SOURCES = ['manual', 'default', 'inventory']
    const latestFeed = await MetalRate.findOne({
      source: { $nin: NON_FEED_SOURCES },
      goldPrice: { $gt: 0 },
      silverPrice: { $gt: 0 },
    }).sort({ updatedAt: -1 })
    if (latestFeed) return latestFeed
    const latest = await MetalRate.findOne({}).sort({ updatedAt: -1 })
    return latest || null
  }

  return {
    buildBrandingPayload,
    buildBrandingProfiles,
    getLatestMetalRate,
    normalizeVoucherPrint,
    normalizeStatementPrint,
  }
}

module.exports = {
  DEFAULT_METAL_RATES,
  DEFAULT_REPORT_BRANDING,
  DEFAULT_VOUCHER_PRINT,
  DEFAULT_STATEMENT_PRINT,
  DEFAULT_SIGNATORIES,
  DEFAULT_STATEMENT_SIGNATORIES,
  normalizeBrandingKey,
  normalizeVoucherPrint,
  normalizeStatementPrint,
  createReportBrandingService,
}
