import tenantCatalog from '../../../shared/tenant-catalog.json'

export const TENANT_KEYS = Object.keys(tenantCatalog.tenants || {}) as string[]

export type TenantKey = string

export type MobileTenantBranding = {
  key: string
  appName: string
  displayName: string
  companyName?: string
  tagline: string
  logoText: string
  portalHost: string
  colors: {
    primary: string
    secondary: string
    background: string
    card: string
    text: string
    muted: string
    success: string
    danger: string
    warning: string
    tabBar: string
    tabInactive: string
  }
}

const APP_NAME = 'Nexa'

const mobileBrandingByKey: Record<string, MobileTenantBranding> = {
  mg: {
    key: 'mg',
    appName: APP_NAME,
    displayName: 'MG',
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
    tagline: 'Metal Group Operations',
    logoText: 'MG',
    portalHost: 'mg.loopcstrategies.com',
    colors: {
      primary: '#005B96',
      secondary: '#00A6FB',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#111827',
      muted: '#6B7280',
      success: '#059669',
      danger: '#DC2626',
      warning: '#D97706',
      tabBar: '#FFFFFF',
      tabInactive: '#9CA3AF',
    },
  },
  cg: {
    key: 'cg',
    appName: APP_NAME,
    displayName: 'CG',
    tagline: 'CG Enterprise Suite',
    logoText: 'CG',
    portalHost: 'cg.loopcstrategies.com',
    colors: {
      primary: '#9A3412',
      secondary: '#F97316',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#111827',
      muted: '#6B7280',
      success: '#059669',
      danger: '#DC2626',
      warning: '#D97706',
      tabBar: '#FFFFFF',
      tabInactive: '#9CA3AF',
    },
  },
  loopc: {
    key: 'loopc',
    appName: APP_NAME,
    displayName: 'LoopC',
    tagline: 'Loop C Business Platform',
    logoText: 'LC',
    portalHost: 'loopc.loopcstrategies.com',
    colors: {
      primary: '#00684A',
      secondary: '#13AA52',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#111827',
      muted: '#6B7280',
      success: '#059669',
      danger: '#DC2626',
      warning: '#D97706',
      tabBar: '#FFFFFF',
      tabInactive: '#9CA3AF',
    },
  },
}

export function normalizeTenantKey(value: string | null | undefined): TenantKey | '' {
  const key = String(value || '').trim().toLowerCase()
  return TENANT_KEYS.includes(key) ? key : ''
}

export function getTenantBranding(tenant?: string | null): MobileTenantBranding {
  const key = normalizeTenantKey(tenant) || 'mg'
  return mobileBrandingByKey[key] || mobileBrandingByKey.mg
}

/** @deprecated Use getTenantBranding(getTenant()) — kept for gradual migration */
export const mgBranding = getTenantBranding('mg')

export { APP_NAME }
