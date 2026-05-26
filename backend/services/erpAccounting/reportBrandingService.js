/**
 * Default report branding / metal rate helpers (shared by currency + report routes).
 */

const DEFAULT_METAL_RATES = {
  goldPrice: 285,
  silverPrice: 3.5,
  priceCurrency: 'USD',
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
}

const normalizeBrandingKey = (value) => {
  const normalized = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

function createReportBrandingService({ MetalRate }) {
  const buildBrandingPayload = (doc) => ({
    ...DEFAULT_REPORT_BRANDING,
    ...(doc?.toObject ? doc.toObject() : doc || {}),
  })

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
  }
}

module.exports = {
  DEFAULT_METAL_RATES,
  DEFAULT_REPORT_BRANDING,
  normalizeBrandingKey,
  createReportBrandingService,
}
