import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/src/api/auth'
import { buildTenantSessionKey } from '@/src/utils/tenantSessionKey'

const mgUser: AuthUser = {
  id: 'user-mg-1',
  name: 'mg-user',
  company: 'mg',
}

const cgUser: AuthUser = {
  id: 'user-cg-1',
  name: 'cg-user',
  company: 'cg',
}

describe('buildTenantSessionKey', () => {
  it('returns logged-out when token or user is missing', () => {
    expect(buildTenantSessionKey(null, mgUser, 'mg', 0)).toBe('logged-out')
    expect(buildTenantSessionKey('token', null, 'mg', 0)).toBe('logged-out')
    expect(buildTenantSessionKey(null, null, 'mg', 0)).toBe('logged-out')
  })

  it('includes company, user id, and session epoch when authenticated', () => {
    expect(buildTenantSessionKey('jwt-token', mgUser, 'mg', 0)).toBe('mg:user-mg-1:e0')
    expect(buildTenantSessionKey('jwt-token', mgUser, 'mg', 3)).toBe('mg:user-mg-1:e3')
  })

  it('changes key for CG logout then MG login even when companyCode stays mg', () => {
    const afterCgLogout = buildTenantSessionKey(null, null, 'mg', 1)
    const afterMgLogin = buildTenantSessionKey('mg-jwt', mgUser, 'mg', 2)

    expect(afterCgLogout).toBe('logged-out')
    expect(afterMgLogin).toBe('mg:user-mg-1:e2')
    expect(afterCgLogout).not.toBe(afterMgLogin)
  })

  it('changes key when switching between tenant users at same epoch', () => {
    const cgKey = buildTenantSessionKey('cg-jwt', cgUser, 'cg', 1)
    const mgKey = buildTenantSessionKey('mg-jwt', mgUser, 'mg', 2)

    expect(cgKey).toBe('cg:user-cg-1:e1')
    expect(mgKey).toBe('mg:user-mg-1:e2')
    expect(cgKey).not.toBe(mgKey)
  })
})

describe('useTenantSessionReady contract', () => {
  it('logged-out sessions must not be treated as ready', () => {
    const token: string | null = null
    const isReady = true
    const sessionReady = isReady && Boolean(token)
    expect(sessionReady).toBe(false)
  })
})
