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

    // Can view the Admin tab (super_admin + management + dept_head)
    canViewAdmin: ['super_admin', 'management', 'department_head'].includes(role),

    // Can edit a specific department
    canEditDepartment: (dept) => {
      if (role === 'super_admin')     return true
      if (role === 'department_head') return user?.department === dept
      return false
    },

    // Can view a specific module
    canViewModule: (module) => {
      if (role === 'super_admin' || role === 'management') return true
      if (role === 'department_head' || role === 'department_user') {
        const dept = user?.department
        if (!dept) return false           // no dept assigned → no modules
        return dept === module
      }
      if (role === 'external') return (user?.allowedModules || []).includes(module)
      return false
    },

    // Can see risk panel and 7-day plan
    canViewStrategic: ['super_admin', 'management', 'department_head'].includes(role),

    // ERP access — admin roles only
    canViewERP: ['super_admin', 'management'].includes(role),
  }
}
