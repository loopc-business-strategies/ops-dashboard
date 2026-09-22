export type NavItem = {
  key: string
  label: string
  href: string
  section?: 'main' | 'production' | 'qc' | 'operations' | 'devices' | 'system'
  tab?: 'home' | 'batches' | 'history' | 'reports' | 'settings'
  permission?: string
}

export const PHONE_TABS: Array<{ key: string; label: string; href: string }> = [
  { key: 'home', label: 'HOME', href: '/' },
  { key: 'batches', label: 'BATCHES', href: '/batches' },
  { key: 'history', label: 'HISTORY', href: '/history' },
  { key: 'reports', label: 'REPORTS', href: '/reports' },
  { key: 'settings', label: 'SETTINGS', href: '/settings' },
]

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', href: '/', section: 'main', tab: 'home' },
  { key: 'production', label: 'Production', href: '/production', section: 'main', tab: 'home' },
  { key: 'batches', label: 'Batches', href: '/batches', section: 'main', tab: 'batches' },
  { key: 'metal-in', label: 'Metal In', href: '/metal-in', section: 'production', tab: 'home', permission: 'metalIn' },
  { key: 'metal-out', label: 'Metal Out', href: '/metal-out', section: 'production', tab: 'home', permission: 'metalOut' },
  { key: 'history', label: 'History', href: '/history', section: 'main', tab: 'history' },
  { key: 'reports', label: 'Reports', href: '/reports', section: 'main', tab: 'reports' },
  { key: 'call-manager', label: 'Call Manager', href: '/call-manager', section: 'main', tab: 'home' },
  { key: 'settings', label: 'Settings', href: '/settings', section: 'system', tab: 'settings' },
  { key: 'transfer', label: 'Transfer', href: '/transfer', section: 'production', tab: 'settings', permission: 'transfer' },
  { key: 'xrf', label: 'XRF / QC', href: '/xrf', section: 'qc', tab: 'settings' },
  { key: 'scan', label: 'Scan', href: '/scan', section: 'operations', tab: 'settings' },
  { key: 'jobs', label: 'My Jobs', href: '/jobs', section: 'operations', tab: 'batches' },
  { key: 'devices', label: 'Devices', href: '/devices', section: 'devices', tab: 'settings' },
  { key: 'scales', label: 'Scales', href: '/scales', section: 'devices', tab: 'settings', permission: 'manageScales' },
  { key: 'offline', label: 'Offline Sync', href: '/offline-sync', section: 'system', tab: 'settings' },
  { key: 'profile', label: 'Profile', href: '/profile', section: 'system', tab: 'settings' },
  { key: 'correction', label: 'Weight Correction', href: '/correction', section: 'system', tab: 'settings', permission: 'adjustWeight' },
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
  main: 'MG FLOOR',
  production: 'PRODUCTION',
  qc: 'QC',
  operations: 'OPERATIONS',
  devices: 'DEVICES',
  system: 'SYSTEM',
}

/** Flat tablet sidebar order (prompt IA). */
export const TABLET_SIDEBAR_KEYS = [
  'home',
  'production',
  'batches',
  'metal-in',
  'metal-out',
  'history',
  'reports',
  'call-manager',
  'settings',
]
