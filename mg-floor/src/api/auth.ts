import { apiRequest } from '@/src/api/client'
import { MG_TENANT } from '@/src/config/tenant'

export type LoginResponse = {
  success: boolean
  token?: string
  user?: {
    _id?: string
    id?: string
    name: string
    role: string
    department?: string
    floorDepartment?: string
    employeeCode?: string
    hasFloorPin?: boolean
    company?: string
  }
  message?: string
}

export type LoginMethod = 'password' | 'pin' | 'biometric'

function checkLoginResponse(data: LoginResponse) {
  if (!data.token) throw new Error(data.message || 'Login failed — no token')
  const company = String(data.user?.company || MG_TENANT).toLowerCase()
  if (company !== MG_TENANT) {
    throw new Error('MG Floor only accepts MG accounts')
  }
  return data
}

export async function login(name: string, password: string) {
  const data = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    token: null,
    body: { name, password, company: MG_TENANT },
  })
  return checkLoginResponse(data)
}

/** Employee code (or username) + floor PIN. */
export async function pinLogin(employee: string, pin: string) {
  const data = await apiRequest<LoginResponse>('/api/auth/pin-login', {
    method: 'POST',
    token: null,
    body: { employee, pin, company: MG_TENANT },
  })
  return checkLoginResponse(data)
}

export async function setMyFloorPin(token: string, password: string, pin: string) {
  return apiRequest<{ success: boolean; hasFloorPin: boolean }>('/api/mg-floor/me/pin', {
    method: 'POST',
    token,
    body: { password, pin },
    retrySafeGet: false,
  })
}

export async function recordAttendanceLogin(token: string, body: { loginMethod: LoginMethod; deviceLabel?: string }) {
  return apiRequest<{ success: boolean }>('/api/mg-floor/attendance/login', {
    method: 'POST',
    token,
    body,
    retrySafeGet: false,
  })
}

export async function recordAttendanceLogout(token: string) {
  return apiRequest<{ success: boolean }>('/api/mg-floor/attendance/logout', {
    method: 'POST',
    token,
    retrySafeGet: false,
  })
}

export type MeResponse = {
  success: boolean
  tenant: string
  productionRole: string | null
  user: {
    id: string
    name: string
    role: string
    department?: string
    floorDepartment?: string
    employeeCode?: string
    hasFloorPin?: boolean
  }
  shift: unknown
  permissions: Record<string, boolean>
}

export async function fetchMe(token?: string | null) {
  return apiRequest<MeResponse>('/api/mg-floor/me', { token })
}
