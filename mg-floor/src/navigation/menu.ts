export type NavItem = {
  key: string
  label: string
  href: string
  section?: 'production' | 'qc' | 'operations' | 'devices' | 'system'
  tab?: 'home' | 'scan' | 'jobs' | 'history' | 'more'
  permission?: string
}

export const PHONE_TABS: Array<{ key: string; label: string; href: string }> = [
  { key: 'home', label: 'HOME', href: '/' },
  { key: 'scan', label: 'SCAN', href: '/scan' },
  { key: 'jobs', label: 'JOBS', href: '/jobs' },
  { key: 'history', label: 'HISTORY', href: '/history' },
  { key: 'more', label: 'MORE', href: '/more' },
]

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'HOME', href: '/', section: 'operations', tab: 'home' },
  { key: 'metal-in', label: 'METAL IN', href: '/metal-in', section: 'production', tab: 'more', permission: 'metalIn' },
  { key: 'metal-out', label: 'METAL OUT', href: '/metal-out', section: 'production', tab: 'more', permission: 'metalOut' },
  { key: 'transfer', label: 'TRANSFER', href: '/transfer', section: 'production', tab: 'more', permission: 'transfer' },
  { key: 'xrf', label: 'XRF / QC', href: '/xrf', section: 'qc', tab: 'more' },
  { key: 'scan', label: 'SCAN', href: '/scan', section: 'operations', tab: 'scan' },
  { key: 'jobs', label: 'MY JOBS', href: '/jobs', section: 'operations', tab: 'jobs' },
  { key: 'history', label: 'HISTORY', href: '/history', section: 'operations', tab: 'history' },
  { key: 'devices', label: 'DEVICES', href: '/devices', section: 'devices', tab: 'more' },
  { key: 'scales', label: 'SCALES', href: '/scales', section: 'devices', tab: 'more', permission: 'manageScales' },
  { key: 'offline', label: 'OFFLINE SYNC', href: '/offline-sync', section: 'system', tab: 'more' },
  { key: 'profile', label: 'PROFILE', href: '/profile', section: 'system', tab: 'more' },
  { key: 'settings', label: 'SETTINGS', href: '/settings', section: 'system', tab: 'more' },
  { key: 'correction', label: 'WEIGHT CORRECTION', href: '/correction', section: 'system', tab: 'more', permission: 'adjustWeight' },
]

export function filterNavByPermissions(
  items: NavItem[],
  permissions: Record<string, boolean>,
): NavItem[] {
  return items.filter((item) => {
    if (!item.permission) return true
    return permissions[item.permission] !== false
  })
}

export const SECTION_LABELS: Record<string, string> = {
  production: 'PRODUCTION',
  qc: 'QC',
  operations: 'OPERATIONS',
  devices: 'DEVICES',
  system: 'SYSTEM',
}
