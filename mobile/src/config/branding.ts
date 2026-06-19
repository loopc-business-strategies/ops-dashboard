export const mgBranding = {
  key: 'mg',
  appName: 'Nexa MG',
  displayName: 'MG',
  companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
  tagline: 'Metal Group Operations',
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
} as const

export type Branding = typeof mgBranding
