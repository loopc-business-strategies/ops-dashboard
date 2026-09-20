import { apiRequest } from '@/src/api/client'
import { MG_TENANT } from '@/src/config/tenant'

export type LoginResponse = {
  success: boolean
  token?: string
  user?: {
    _id: string
    name: string
    role: string
    department?: string
    company?: string
  }
  message?: string
}

export async function login(name: string, password: string) {
  const data = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    token: null,
    body: { name, password, company: MG_TENANT },
  })
  if (!data.token) throw new Error(data.message || 'Login failed — no token')
  const company = String(data.user?.company || MG_TENANT).toLowerCase()
  if (company !== MG_TENANT) {
    throw new Error('MG Floor only accepts MG accounts')
  }
  return data
}

export async function fetchMe(token?: string | null) {
  return apiRequest<{
    success: boolean
    tenant: string
    productionRole: string | null
    user: { id: string; name: string; role: string; department?: string }
    shift: unknown
    permissions: Record<string, boolean>
  }>('/api/mg-floor/me', { token })
}
