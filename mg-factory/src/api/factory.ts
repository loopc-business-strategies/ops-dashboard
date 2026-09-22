import { apiRequest } from '@/src/api/client'

export type DepartmentLoginResponse = {
  success: boolean
  departmentToken: string
  department: { key: string; label: string }
  message?: string
}

export type EmployeeLoginResponse = {
  success: boolean
  token: string
  department: { key: string; label: string }
  user: { id: string; name: string; role: string; department?: string; productionRole?: string | null }
  permissions?: Record<string, boolean>
  message?: string
}

export type MeResponse = {
  success: boolean
  tenant: string
  department: { key: string; label: string }
  user: { id: string; name: string; role: string; department?: string; productionRole?: string | null }
  permissions: Record<string, boolean>
}

export async function departmentLogin(departmentKey: string, password: string) {
  return apiRequest<DepartmentLoginResponse>('/api/mg-factory/department/login', {
    method: 'POST',
    token: null,
    body: { departmentKey, password },
  })
}

export async function employeeLogin(departmentToken: string, name: string, password: string) {
  return apiRequest<EmployeeLoginResponse>('/api/mg-factory/employee/login', {
    method: 'POST',
    token: departmentToken,
    body: { name, password },
  })
}

export async function refreshBiometricToken(employeeToken: string) {
  return apiRequest<{ success: boolean; token: string }>('/api/mg-factory/employee/biometric-token', {
    method: 'POST',
    token: employeeToken,
    body: {},
  })
}

export async function fetchMe(token?: string | null) {
  return apiRequest<MeResponse>('/api/mg-factory/me', { token })
}

export async function listDepartments(token?: string | null) {
  return apiRequest<{ success: boolean; departments: Array<{ key: string; label: string; order?: number }> }>(
    '/api/mg-factory/departments',
    { token },
  )
}

export async function listJobs(token?: string | null) {
  return apiRequest<{
    success: boolean
    inboundPasses: Array<Record<string, unknown>>
    batches: Array<Record<string, unknown>>
  }>('/api/mg-factory/jobs', { token })
}

export async function metalIn(
  token: string,
  body: { passId: string; receivedWeight: number; varianceReason?: string; operationId?: string },
) {
  return apiRequest<{ success: boolean; pass?: unknown; weight?: number }>('/api/mg-factory/metal/in', {
    method: 'POST',
    token,
    body,
  })
}

export async function metalOut(
  token: string,
  body: {
    batchId: string
    toDepartment: string
    weight: number
    purpose?: string
    operationId?: string
  },
) {
  return apiRequest<{ success: boolean; pass?: unknown; weight?: number }>('/api/mg-factory/metal/out', {
    method: 'POST',
    token,
    body,
  })
}

export async function callManager(token: string, body?: { message?: string }) {
  return apiRequest<{ success: boolean; alert: { alertNumber?: string; title?: string } }>(
    '/api/mg-factory/call-manager',
    {
      method: 'POST',
      token,
      body: body || {},
    },
  )
}
