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
  enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
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
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
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
    enabledErpSubTabs: ['dashboard', 'accounts', 'mappings', 'settings', 'enquiry', 'customers', 'customer-margin', 'ledger', 'transactions', 'reports', 'vendors', 'inventory', 'vouchers', 'direct-deals', 'fixing-register'],
    featureFlags: {
      procurementPlus: true,
    },
  },
  loopc: defaultBranding,
}

export function getTenantBranding(tenant) {
  const key = String(tenant || '').trim().toLowerCase()
  return tenantBranding[key] || defaultBranding
}
