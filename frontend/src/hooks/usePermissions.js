// FILE: src/hooks/usePermissions.js
// WHAT THIS DOES:
//   One place that defines what each role can/cannot do in the UI.
//   Import this in any component to check permissions.
//
// Usage:
//   const { canManageUsers, isReadOnly, canEditDepartment } = usePermissions()

import { useAuth } from '../context/AuthContext'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || ''
  const erpPermission = user?.modulePermissions?.erp
  const hasGranularPermissions = Boolean(user?.modulePermissions && Object.keys(user.modulePermissions).length > 0)

  const canViewERPSubTab = (subTab) => {
    if (role === 'super_admin') return true
    if (hasGranularPermissions && erpPermission?.on !== true) return false
    if (!hasGranularPermissions && (user?.allowedModules || []).includes('erp')) return true
    if (erpPermission?.on !== true) return false
    const configuredSubs = erpPermission?.subs || {}
    if (!Object.keys(configuredSubs).length) return true
    return configuredSubs[subTab]?.on === true
  }

  return {
    isSuperAdmin:     role === 'super_admin',
    isManagement:     role === 'management',
    isDepartmentHead: role === 'department_head',
    isDepartmentUser: role === 'department_user',
    isExternal:       role === 'external',

    // Read-only roles cannot edit anything
    isReadOnly: ['management', 'external'].includes(role),

    // Can create/manage users (full CRUD — super_admin only)
    canManageUsers: role === 'super_admin',

    // Admin APIs are super-admin only, so do not expose the Admin tab to other roles.
    canViewAdmin: role === 'super_admin',

    // Can edit a specific department
    canEditDepartment: (dept) => {
      if (role === 'super_admin')     return true
      if (role === 'department_head') return user?.department === dept
      return false
    },

    // Can view a specific module
    // modulePermissions (granular) takes priority, then allowedModules, then role defaults
    canViewModule: (module) => {
      if (role === 'super_admin') return true
      if (hasGranularPermissions) {
        return user.modulePermissions[module]?.on === true
      }
      if ((user?.allowedModules || []).length > 0) return (user.allowedModules).includes(module)
      // fallback role-based defaults (no allowedModules set yet)
      if (role === 'management') return true
      if (role === 'department_head' || role === 'department_user') {
        const dept = user?.department
        if (!dept) return false
        return dept === module
      }
      return false
    },

    hasGranularPermissions,

    // Can see risk panel and 7-day plan
    canViewStrategic: ['super_admin', 'management', 'department_head'].includes(role),

    // ERP access — super_admin always; others via allowedModules or granular modulePermissions
    canViewERP: role === 'super_admin' || (hasGranularPermissions ? erpPermission?.on === true : (user?.allowedModules || []).includes('erp')),
    canViewERPSubTab,
  }
}
