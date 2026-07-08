import { getTenantBranding, isMasterDocumentSettingsEnabled } from '../../../config/tenantBranding'
import {
  DEFAULT_BRANDING,
  DEFAULT_STATEMENT_PRINT,
  DEFAULT_VOUCHER_PRINT,
  clampBrandingDimension,
  normalizeStatementPrint,
  normalizeVoucherPrint,
} from './ERPBrandingUtils'
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

  return {
    ...DEFAULT_BRANDING,
    ...(reportBranding || {}),
    companyName: pick(
      reportBranding?.companyName,
      user?.branding?.displayName,
      tenant?.name,
      fallbackTenantBranding?.companyName,
      fallbackTenantBranding?.displayName,
      DEFAULT_BRANDING.companyName,
    ),
    legalName: pick(reportBranding?.legalName, fallbackTenantBranding?.legalName, DEFAULT_BRANDING.legalName),
    entityName: pick(reportBranding?.entityName, fallbackTenantBranding?.displayName, DEFAULT_BRANDING.entityName),
    branchName: pick(reportBranding?.branchName, tenant?.branchName, DEFAULT_BRANDING.branchName),
    address: pick(reportBranding?.address, user?.branding?.address, tenant?.address, fallbackTenantBranding?.address, DEFAULT_BRANDING.address),
    phone: pick(reportBranding?.phone, user?.branding?.phone, tenant?.phone, fallbackTenantBranding?.phone, DEFAULT_BRANDING.phone),
    trn: pick(reportBranding?.trn, user?.branding?.trn, tenant?.trn, fallbackTenantBranding?.trn, DEFAULT_BRANDING.trn),
    logoUrl: uploadedLogo,
    logoWidth: clampBrandingDimension(uploadedLogo ? reportBranding?.logoWidth : reportBranding?.logoWidth || 160, DEFAULT_BRANDING.logoWidth, 80, 260),
    logoHeight: clampBrandingDimension(uploadedLogo ? reportBranding?.logoHeight : reportBranding?.logoHeight || 56, DEFAULT_BRANDING.logoHeight, 32, 120),
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
  const voucherPrint = normalizeVoucherPrint(reportBranding?.voucherPrint)

  if (!isMasterDocumentSettingsEnabled(tenantKey)) {
    return {
      ...branding,
      enabled: false,
      voucherPrint: DEFAULT_VOUCHER_PRINT,
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
