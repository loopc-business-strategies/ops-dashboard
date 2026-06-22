import tenantCatalog from '../../../shared/tenant-catalog.json'

export const TENANT_KEYS = Object.keys(tenantCatalog.tenants || {})

const CUSTOM_DOMAINS = {
  ...(tenantCatalog.customDomains || {}),
}

function normalizeTenantKey(value) {
  const key = String(value || '').trim().toLowerCase()
  return TENANT_KEYS.includes(key) ? key : ''
}

function resolveTenantFromCustomDomain(hostname) {
  const rawHost = String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '')
  if (!rawHost) return ''
  return normalizeTenantKey(CUSTOM_DOMAINS[rawHost])
}

const defaultBranding = {
  key: 'loopc',
  displayName: 'LoopC',
  logoText: 'LC',
  logoImage: '/logos/loopc-logo.svg',
  tagline: 'Loop C Business Platform',
  colors: {
    bgTopbar: '#1C2A33',
    brandPrimary: '#00684A',
    brandSecondary: '#13AA52',
    gradBar: 'linear-gradient(90deg, #00684A, #00b4d8)',
  },
  enabledTabs: ['overview', 'chat', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
  enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
  featureFlags: {
    procurementPlus: true,
  },
}

const tenantBranding = {
  mg: {
    key: 'mg',
    displayName: 'MG',
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
    address: '242, Girvonbulok Street, Davlatabad District,\nNamangan City, Namangan Region,\nRepublic of Uzbekistan.',
    logoText: 'MG',
    logoImage: '/logos/mg-logo.svg',
    logoUrl: '/logos/mg-logo.svg',
    tagline: 'Metal Group Operations',
    phone: '',
    trn: '',
    colors: {
      bgTopbar: '#1C2638',
      brandPrimary: '#005B96',
      brandSecondary: '#00A6FB',
      gradBar: 'linear-gradient(90deg, #005B96, #00A6FB)',
    },
    enabledTabs: ['overview', 'chat', 'master-settings', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
    },
  },
  cg: {
    key: 'cg',
    displayName: 'CG',
    logoText: 'CG',
    logoImage: '/logos/cg-logo.svg',
    logoUrl: '/logos/cg-logo.svg',
    tagline: 'CG Enterprise Suite',
    address: '',
    phone: '',
    trn: '',
    colors: {
      bgTopbar: '#2C1B1B',
      brandPrimary: '#9A3412',
      brandSecondary: '#F97316',
      gradBar: 'linear-gradient(90deg, #9A3412, #F97316)',
    },
    enabledTabs: ['overview', 'chat', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
    },
  },
  loopc: {
    ...defaultBranding,
    key: 'loopc',
    displayName: 'LoopC',
    logoText: 'LC',
    logoImage: '/logos/loopc-logo.svg',
    logoUrl: '/logos/loopc-logo.svg',
    tagline: 'Loop C Business Platform',
    address: '',
    phone: '',
    trn: '',
  },
}

export function getTenantBranding(tenant) {
  const key = normalizeTenantKey(tenant)
  return tenantBranding[key] || defaultBranding
}

export function getDisabledVoucherTypes(tenant) {
  const branding = getTenantBranding(tenant)
  return Array.isArray(branding?.featureFlags?.disabledVoucherTypes)
    ? branding.featureFlags.disabledVoucherTypes.map((type) => String(type || '').trim().toLowerCase()).filter(Boolean)
    : []
}

export function isVoucherTypeEnabled(tenant, type) {
  const disabled = new Set(getDisabledVoucherTypes(tenant))
  return !disabled.has(String(type || '').trim().toLowerCase())
}

export function filterTransactionTypesForTenant(tenant, types = []) {
  const disabled = new Set(getDisabledVoucherTypes(tenant))
  if (!disabled.size) return types
  return types.filter((type) => !disabled.has(String(type || '').trim().toLowerCase()))
}

export function resolveTenantFromHostname(hostname, fallbackTenant = defaultBranding.key) {
  const fallback = normalizeTenantKey(fallbackTenant) || defaultBranding.key
  const rawHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')

  if (!rawHost) return fallback

  const customMatch = resolveTenantFromCustomDomain(rawHost)
  if (customMatch) return customMatch

  if (normalizeTenantKey(rawHost)) return rawHost
  if (rawHost === 'localhost' || rawHost === '127.0.0.1' || rawHost === '::1') return fallback

  const [subdomain] = rawHost.split('.')
  return normalizeTenantKey(subdomain) || fallback
}

export function resolveTenantFromSearch(search, fallbackTenant = defaultBranding.key) {
  const fallback = normalizeTenantKey(fallbackTenant) || defaultBranding.key
  const params = new URLSearchParams(String(search || ''))
  const fromCompany = normalizeTenantKey(params.get('company'))
  if (fromCompany) return fromCompany
  const fromTenant = normalizeTenantKey(params.get('tenant'))
  if (fromTenant) return fromTenant
  return fallback
}

export function isLocalTenantHost(hostname) {
  const rawHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')

  return !rawHost || rawHost === 'localhost' || rawHost === '127.0.0.1' || rawHost === '::1'
}
