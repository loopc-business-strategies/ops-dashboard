import type { AuthUser } from '@/src/api/auth'

export function isSuperAdmin(user?: AuthUser | null) {
  return user?.role === 'super_admin'
}

export function isDepartmentHead(user?: AuthUser | null) {
  return user?.role === 'department_head'
}

export function canCreateChatGroup(user?: AuthUser | null) {
  return isSuperAdmin(user) || isDepartmentHead(user)
}
