import { getTenantBranding } from '../../../config/tenantBranding'

/** Resolve ERP tenant branding from auth user (company / tenant fields). */
export function resolveErpUserTenantBranding(user) {
  return getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name)
}

/** Tenant key string for ERP inventory / posting guards. */
export function resolveErpUserTenantKey(user) {
  return resolveErpUserTenantBranding(user)?.key || ''
}
