import { getTenantBranding, isMasterDocumentSettingsEnabled } from '../../../config/tenantBranding'
import {
  DEFAULT_BRANDING,
  DEFAULT_STATEMENT_PRINT,
  DEFAULT_TITLE_ACCENT_COLOR,
  DEFAULT_VOUCHER_PRINT,
  clampBrandingDimension,
  nonPlaceholderCompanyName,
  normalizeStatementPrint,
  normalizeVoucherPrint,
} from './ERPBrandingUtils'

/** Venus brand gold — matches voucher title bar swatch / tenant brandDark. */
const VB_VOUCHER_TITLE_ACCENT = '#9B6B1F'

const applyTenantVoucherTitleAccent = (tenantKey, voucherPrint, tenantBranding) => {
  const accent = String(voucherPrint?.titleAccentColor || '').trim().toUpperCase()
  const isDefaultMaroon = !accent || accent === DEFAULT_TITLE_ACCENT_COLOR.toUpperCase()
  if (String(tenantKey || '').toLowerCase() !== 'vb' || !isDefaultMaroon) return voucherPrint
  const gold = String(tenantBranding?.colors?.brandDark || VB_VOUCHER_TITLE_ACCENT).trim() || VB_VOUCHER_TITLE_ACCENT
  return {
    ...voucherPrint,
    titleAccentColor: gold,
  }
}
import { sanitizeLogoUrl } from '../../../utils/safeHtml'

const hasValue = (value) => String(value || '').trim().length > 0

const pick = (...values) => {
  const found = values.find(hasValue)
  return found === undefined || found === null ? '' : String(found)
}

const resolveTenantKey = ({ user = {}, tenantBranding } = {}) => {
  const tenant = user?.tenant || {}
  return String(
    tenant?.key
    || tenant?.name
    || user?.company
    || tenantBranding?.key
    || '',
  ).trim().toLowerCase()
}

export const resolveDocumentBranding = ({ reportBranding = {}, user = {}, tenantBranding } = {}) => {
  const tenant = user?.tenant || {}
  const fallbackTenantBranding = tenantBranding || getTenantBranding(user?.company || tenant?.key || tenant?.name)
  const uploadedLogo = sanitizeLogoUrl(String(reportBranding?.logoUrl || '').trim())
  const tenantLogo = sanitizeLogoUrl(String(
    fallbackTenantBranding?.logoUrl
    || fallbackTenantBranding?.logoImage
    || '',
  ).trim())
  const resolvedLogo = uploadedLogo || tenantLogo

  return {
    ...DEFAULT_BRANDING,
    ...(reportBranding || {}),
    companyName: pick(
      nonPlaceholderCompanyName(reportBranding?.companyName),
      user?.branding?.displayName,
      tenant?.name,
      fallbackTenantBranding?.companyName,
      fallbackTenantBranding?.displayName,
    ),
    legalName: pick(reportBranding?.legalName, fallbackTenantBranding?.legalName, DEFAULT_BRANDING.legalName),
    entityName: pick(reportBranding?.entityName, fallbackTenantBranding?.displayName, DEFAULT_BRANDING.entityName),
    branchName: pick(reportBranding?.branchName, tenant?.branchName, DEFAULT_BRANDING.branchName),
    address: pick(reportBranding?.address, user?.branding?.address, tenant?.address, fallbackTenantBranding?.address, DEFAULT_BRANDING.address),
    phone: pick(reportBranding?.phone, user?.branding?.phone, tenant?.phone, fallbackTenantBranding?.phone, DEFAULT_BRANDING.phone),
    trn: pick(reportBranding?.trn, user?.branding?.trn, tenant?.trn, fallbackTenantBranding?.trn, DEFAULT_BRANDING.trn),
    logoUrl: resolvedLogo,
    logoWidth: clampBrandingDimension(reportBranding?.logoWidth || 160, DEFAULT_BRANDING.logoWidth, 80, 260),
    logoHeight: clampBrandingDimension(reportBranding?.logoHeight || 56, DEFAULT_BRANDING.logoHeight, 32, 140),
    logoFit: ['contain', 'cover', 'fill'].includes(reportBranding?.logoFit) ? reportBranding.logoFit : DEFAULT_BRANDING.logoFit,
    primaryColor: pick(
      user?.branding?.colors?.brandPrimary,
      tenant?.colors?.brandPrimary,
      fallbackTenantBranding?.colors?.brandPrimary,
      '#374151',
    ),
    voucherPrint: normalizeVoucherPrint(reportBranding?.voucherPrint),
    statementPrint: normalizeStatementPrint(reportBranding?.statementPrint),
  }
}

export const resolveVoucherPrintSettings = ({ reportBranding = {}, user = {}, tenantBranding } = {}) => {
  const tenantKey = resolveTenantKey({ user, tenantBranding })
  const branding = resolveDocumentBranding({ reportBranding, user, tenantBranding })
  const fallbackTenantBranding = tenantBranding || getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name)
  const voucherPrint = applyTenantVoucherTitleAccent(
    tenantKey,
    normalizeVoucherPrint(reportBranding?.voucherPrint),
    fallbackTenantBranding,
  )

  if (!isMasterDocumentSettingsEnabled(tenantKey)) {
    return {
      ...branding,
      enabled: false,
      voucherPrint: applyTenantVoucherTitleAccent(tenantKey, DEFAULT_VOUCHER_PRINT, fallbackTenantBranding),
    }
  }

  return {
    ...branding,
    enabled: true,
    voucherPrint,
  }
}

export const resolveStatementPrintSettings = ({ reportBranding = {}, user = {}, tenantBranding } = {}) => {
  const tenantKey = resolveTenantKey({ user, tenantBranding })
  const branding = resolveDocumentBranding({ reportBranding, user, tenantBranding })
  const statementPrint = normalizeStatementPrint(reportBranding?.statementPrint)

  if (!isMasterDocumentSettingsEnabled(tenantKey)) {
    return {
      ...branding,
      enabled: false,
      statementPrint: DEFAULT_STATEMENT_PRINT,
    }
  }

  return {
    ...branding,
    enabled: true,
    statementPrint,
  }
}
