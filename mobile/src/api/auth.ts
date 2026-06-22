import { apiRequest } from '@/src/api/client'
import { getTenant } from '@/src/config/tenant'

import type { ModulePermissions } from '@/src/constants/admin'

export type AuthUser = {
  id: string
  name: string
  fullName?: string
  email?: string
  role?: string
  department?: string
  company?: string
  allowedModules?: string[]
  modulePermissions?: ModulePermissions
}

type LoginResponse = {
  success: boolean
  token?: string
  user: AuthUser
  message?: string
}

type MeResponse = {
  success: boolean
  user: AuthUser
}

export async function login(name: string, password: string, company?: string) {
  const tenant = company || getTenant()
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    token: null,
    body: { name, password, company: tenant },
  })
}

export async function fetchMe(token: string) {
  return apiRequest<MeResponse>('/api/auth/me', { token })
}

export async function logout(token: string) {
  return apiRequest<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
    token,
  })
}

export async function registerPushToken(sessionToken: string, expoPushToken: string) {
  return apiRequest<{ success: boolean }>('/api/auth/me/push-token', {
    method: 'POST',
    token: sessionToken,
    body: { token: expoPushToken },
  })
}

export async function deletePushToken(sessionToken: string, expoPushToken: string) {
  return apiRequest<{ success: boolean }>('/api/auth/me/push-token', {
    method: 'DELETE',
    token: sessionToken,
    body: { token: expoPushToken },
  })
}
