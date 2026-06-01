import type { AuthUser } from '@/src/api/auth'

export function isSuperAdmin(user?: AuthUser | null) {
  return user?.role === 'super_admin'
}
