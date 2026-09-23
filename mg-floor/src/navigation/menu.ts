export type NavItem = {
  key: string
  label: string
  href: string
  permission?: string
}

/** Minimal IA — unified dashboard only (legacy tabs removed). */
export const NAV_ITEMS: NavItem[] = [{ key: 'home', label: 'Home', href: '/' }]

export function filterNavByPermissions(
  items: NavItem[],
  permissions: Record<string, boolean>,
): NavItem[] {
  return items.filter((item) => {
    if (!item.permission) return true
    return permissions[item.permission] !== false
  })
}

export const TABLET_SIDEBAR_KEYS: string[] = []
