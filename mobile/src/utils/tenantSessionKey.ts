import type { AuthUser } from '@/src/api/auth'

export function buildTenantSessionKey(
  token: string | null,
  user: AuthUser | null,
  companyCode: string,
  sessionEpoch: number,
): string {
  if (!token || !user) return 'logged-out'
  return `${companyCode}:${user.id}:e${sessionEpoch}`
}
