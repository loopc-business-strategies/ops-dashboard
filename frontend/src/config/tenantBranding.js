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

/** Convert #RRGGBB to "r, g, b" for CSS rgba(var(--brand-rgb), …). */
export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return '37, 99, 235'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/**
 * Apply tenant brand CSS variables on documentElement.
 * Sets both new --brand-* tokens and legacy --purple* aliases.
 * Returns a restore function that reverts previously set inline values.
 */
export function applyTenantTheme(colors = {}) {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  const c = colors || {}

  const primary = c.brandPrimary || '#2563EB'
  const hover = c.brandHover || primary
  const light = c.brandLight || c.brandSecondary || primary
  const dark = c.brandDark || primary
  const accent = c.brandAccent || c.brandSecondary || light
  const soft = c.brandSoftBg || '#EFF6FF'
  const border = c.brandBorder || '#BFDBFE'
  const topbar = c.bgTopbar || dark
  const onBrand = c.onBrand || '#FFFFFF'
  const onSoft = c.onSoft || dark
  const secondary = c.brandSecondary || accent
  const gradBar = c.gradBar || `linear-gradient(90deg, ${primary}, ${accent})`
  const gradBrand = c.gradBrand || `linear-gradient(135deg, ${primary}, ${secondary})`
  const rgb = hexToRgb(primary)

  const keys = [
    '--brand-primary',
    '--brand-hover',
    '--brand-light',
    '--brand-dark',
    '--brand-accent',
    '--brand-soft',
    '--brand-border',
    '--brand-on-primary',
    '--brand-on-soft',
    '--brand-rgb',
    '--purple',
    '--purple-light',
    '--purple-dark',
    '--purple-rgb',
    '--magenta',
    '--bg-topbar',
    '--grad-brand',
    '--grad-bar',
    '--border-hover',
  ]

  const previous = {}
  for (const key of keys) {
    previous[key] = root.style.getPropertyValue(key)
  }

  root.style.setProperty('--brand-primary', primary)
  root.style.setProperty('--brand-hover', hover)
  root.style.setProperty('--brand-light', light)
  root.style.setProperty('--brand-dark', dark)
  root.style.setProperty('--brand-accent', accent)
  root.style.setProperty('--brand-soft', soft)
  root.style.setProperty('--brand-border', border)
  root.style.setProperty('--brand-on-primary', onBrand)
  root.style.setProperty('--brand-on-soft', onSoft)
  root.style.setProperty('--brand-rgb', rgb)

  // Legacy aliases — keep existing consumers working
  root.style.setProperty('--purple', primary)
  root.style.setProperty('--purple-light', light)
  root.style.setProperty('--purple-dark', dark)
  root.style.setProperty('--purple-rgb', rgb)
  root.style.setProperty('--magenta', accent)
  root.style.setProperty('--bg-topbar', topbar)
  root.style.setProperty('--grad-brand', gradBrand)
  root.style.setProperty('--grad-bar', gradBar)
  root.style.setProperty('--border-hover', `rgba(${rgb}, 0.5)`)

  return () => {
    for (const key of keys) {
      const prev = previous[key]
      if (prev) root.style.setProperty(key, prev)
      else root.style.removeProperty(key)
    }
  }
}

function buildPalette({
  brandPrimary,
  brandHover,
  brandLight,
  brandDark,
  brandAccent,
  brandSoftBg,
  brandBorder,
  bgTopbar,
}) {
  return {
    brandPrimary,
    brandHover,
    brandLight,
    brandDark,
    brandAccent,
    brandSecondary: brandAccent,
    brandSoftBg,
    brandBorder,
    bgTopbar,
    onBrand: '#FFFFFF',
    onSoft: brandDark,
    gradBar: `linear-gradient(90deg, ${brandPrimary}, ${brandAccent})`,
    gradBrand: `linear-gradient(135deg, ${brandPrimary}, ${brandLight})`,
  }
}

const defaultBranding = {
  key: 'loopc',
  displayName: 'LoopC',
  logoText: 'LC',
  logoImage: '/logos/loopc-logo.svg',
  tagline: 'Loop C Business Platform',
  colors: buildPalette({
    brandPrimary: '#2563EB',
    brandHover: '#1D4ED8',
    brandLight: '#60A5FA',
    brandDark: '#1E3A8A',
    brandAccent: '#3B82F6',
    brandSoftBg: '#EFF6FF',
    brandBorder: '#BFDBFE',
    bgTopbar: '#172554',
  }),
  enabledTabs: ['overview', 'chat', 'master-settings', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
  enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'period-closing', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
  featureFlags: {
    procurementPlus: true,
    reportPdfDownload: true,
    masterDocumentSettings: true,
    erpAdvancedListFilters: true,
    chatTranslate: true,
    voucherKeyboardNav: true,
    professionalVoucherPrint: true,
    accountingPeriodClosing: true,
    voucher24HourLock: true,
  },
}

const tenantBranding = {
  mg: {
    key: 'mg',
    displayName: 'MG',
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
    address: '242, Girvonbulok Street, Davlatabad District,\nNamangan City, Namangan Region,\nRepublic of Uzbekistan.',
    logoText: 'MG',
    logoImage: '/logos/mg-logo.png',
    logoUrl: '/logos/mg-logo.png',
    tagline: 'Metal Group Operations',
    phone: '',
    trn: '',
    colors: buildPalette({
      brandPrimary: '#EA580C',
      brandHover: '#C2410C',
      brandLight: '#FB923C',
      brandDark: '#9A3412',
      brandAccent: '#F97316',
      brandSoftBg: '#FFF7ED',
      brandBorder: '#FED7AA',
      bgTopbar: '#431407',
    }),
    enabledTabs: ['overview', 'chat', 'master-settings', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'period-closing', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
      erpAdvancedListFilters: true,
      masterDocumentSettings: true,
      chatTranslate: true,
      voucherKeyboardNav: true,
      professionalVoucherPrint: true,
      accountingPeriodClosing: true,
      voucher24HourLock: true,
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
    colors: buildPalette({
      brandPrimary: '#16A34A',
      brandHover: '#15803D',
      brandLight: '#4ADE80',
      brandDark: '#166534',
      brandAccent: '#22C55E',
      brandSoftBg: '#F0FDF4',
      brandBorder: '#BBF7D0',
      bgTopbar: '#052E16',
    }),
    enabledTabs: ['overview', 'chat', 'master-settings', 'admin', 'hr', 'compliance', 'production', 'finance', 'sales', 'operations', 'training', 'erp', 'procurement-plus'],
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'currencies', 'enquiry', 'customers', 'customer-margin', 'supplier-margin', 'ledger', 'period-closing', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
      erpAdvancedListFilters: true,
      masterDocumentSettings: true,
      chatTranslate: true,
      voucherKeyboardNav: true,
      professionalVoucherPrint: true,
      accountingPeriodClosing: true,
      voucher24HourLock: true,
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
    featureFlags: {
      procurementPlus: true,
      reportPdfDownload: true,
      masterDocumentSettings: true,
      erpAdvancedListFilters: true,
      chatTranslate: true,
      voucherKeyboardNav: true,
      professionalVoucherPrint: true,
      accountingPeriodClosing: true,
      voucher24HourLock: true,
    },
  },
}

export function getTenantBranding(tenant) {
  const key = normalizeTenantKey(tenant)
  return tenantBranding[key] || defaultBranding
}

export function isReportPdfDownloadEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.reportPdfDownload === true
}

export function isMasterDocumentSettingsEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.masterDocumentSettings === true
}

export function isErpAdvancedListFiltersEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.erpAdvancedListFilters === true
}

export function isChatTranslateEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.chatTranslate === true
}

export function isVoucherKeyboardNavEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.voucherKeyboardNav === true
}

export function isProfessionalVoucherPrintEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.professionalVoucherPrint === true
}

export function isAccountingPeriodClosingEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.accountingPeriodClosing === true
}

export function isVoucher24HourLockEnabled(tenant) {
  return getTenantBranding(tenant)?.featureFlags?.voucher24HourLock === true
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
