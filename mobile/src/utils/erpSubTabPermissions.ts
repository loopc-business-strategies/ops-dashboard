import type { ModulePermissions } from '@/src/constants/admin'

/**
 * Mirrors web `frontend/src/utils/erpSubTabPermissions.js` for ERP sub-tab checks on mobile.
 */

export type UserForErpPerm = {
  role?: string
  allowedModules?: string[]
  modulePermissions?: ModulePermissions
}

export function hasGranularModulePermissions(user: UserForErpPerm | null | undefined): boolean {
  return Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)
}

function hasExplicitErpPermissions(user: UserForErpPerm | null | undefined): boolean {
  return user?.modulePermissions?.erp !== undefined
}

export function canViewErpSubTab(user: UserForErpPerm | null | undefined, subTab: string): boolean {
  const role = String(user?.role || '').toLowerCase()
  if (role === 'super_admin') return true

  const erpPermission = user?.modulePermissions?.erp
  const hasGranular = hasGranularModulePermissions(user)

  if (hasGranular && hasExplicitErpPermissions(user) && erpPermission?.on !== true) return false
  if (!hasGranular && (user?.allowedModules || []).includes('erp')) return true
  if (hasGranular && !hasExplicitErpPermissions(user) && (user?.allowedModules || []).includes('erp')) return true
  if (erpPermission?.on !== true) return false

  const configuredSubs = erpPermission?.subs || {}
  if (!Object.keys(configuredSubs).length) return true
  return configuredSubs[subTab]?.on === true
}

export function canAccessErpReports(user: UserForErpPerm | null | undefined): boolean {
  return canViewErpSubTab(user, 'reports')
}

export function canAccessTransactions(user: UserForErpPerm | null | undefined): boolean {
  return canViewErpSubTab(user, 'transactions')
}
