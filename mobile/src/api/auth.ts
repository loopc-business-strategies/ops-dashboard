import { apiRequest } from '@/src/api/client'
import { TENANT } from '@/src/config/tenant'

export type AuthUser = {
  id: string
  name: string
  fullName?: string
  email?: string
  role?: string
  department?: string
  company?: string
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

export async function login(name: string, password: string) {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    token: null,
    body: { name, password, company: TENANT },
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
