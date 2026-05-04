const TENANT_KEYS = ['mg', 'cg', 'loopc']

function normalizeTenantKey(value) {
  const key = String(value || '').trim().toLowerCase()
  return TENANT_KEYS.includes(key) ? key : ''
}

const defaultBranding = {
  key: 'loopc',
  displayName: 'LoopC',
  logoText: 'LC',
  colors: {
    bgTopbar: '#1C2A33',
    brandPrimary: '#00684A',
    brandSecondary: '#13AA52',
    gradBar: 'linear-gradient(90deg, #00684A, #00b4d8)',
  },
  enabledTabs: ['overview', 'chat', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
  enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
  featureFlags: {
    procurementPlus: true,
  },
}

const tenantBranding = {
  mg: {
    key: 'mg',
    displayName: 'MG',
    logoText: 'MG',
    colors: {
      bgTopbar: '#1C2638',
      brandPrimary: '#005B96',
      brandSecondary: '#00A6FB',
      gradBar: 'linear-gradient(90deg, #005B96, #00A6FB)',
    },
    enabledTabs: ['overview', 'chat', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
    },
  },
  cg: {
    key: 'cg',
    displayName: 'CG',
    logoText: 'CG',
    colors: {
      bgTopbar: '#2C1B1B',
      brandPrimary: '#9A3412',
      brandSecondary: '#F97316',
      gradBar: 'linear-gradient(90deg, #9A3412, #F97316)',
    },
    enabledTabs: ['overview', 'chat', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
    },
  },
  loopc: defaultBranding,
}

export function getTenantBranding(tenant) {
  const key = normalizeTenantKey(tenant)
  return tenantBranding[key] || defaultBranding
}

export function resolveTenantFromHostname(hostname, fallbackTenant = defaultBranding.key) {
  const fallback = normalizeTenantKey(fallbackTenant) || defaultBranding.key
  const rawHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')

  if (!rawHost) return fallback
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
