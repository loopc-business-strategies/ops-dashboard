import { getTenantBranding } from '../../../config/tenantBranding'
import { DEFAULT_BRANDING, clampBrandingDimension } from './ERPBrandingUtils'

const hasValue = (value) => String(value || '').trim().length > 0

const pick = (...values) => {
  const found = values.find(hasValue)
  return found === undefined || found === null ? '' : String(found)
}

export const resolveDocumentBranding = ({ reportBranding = {}, user = {}, tenantBranding } = {}) => {
  const tenant = user?.tenant || {}
  const fallbackTenantBranding = tenantBranding || getTenantBranding(user?.company || tenant?.key || tenant?.name)
  const uploadedLogo = String(reportBranding?.logoUrl || '').trim()

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
  }
}
