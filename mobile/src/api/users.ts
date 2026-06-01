import { apiRequest } from '@/src/api/client'
import type { ModulePermissions } from '@/src/constants/admin'

export type AdminUser = {
  _id: string
  id?: string
  name: string
  fullName?: string
  email?: string
  role: string
  department?: string
  allowedModules?: string[]
  assignedTasks?: string[]
  modulePermissions?: ModulePermissions
  title?: string
  phone?: string
  location?: string
  timezone?: string
  employeeCode?: string
  notes?: string
  isActive?: boolean
  isDeleted?: boolean
}

export type UserPayload = {
  name: string
  fullName?: string
  password?: string
  role: string
  department?: string
  allowedModules?: string[]
  assignedTasks?: string[]
  title?: string
  phone?: string
  location?: string
  timezone?: string
  employeeCode?: string
  notes?: string
}

type UsersListResponse = {
  success: boolean
  count: number
  users: AdminUser[]
}

type UserResponse = {
  success: boolean
  user: AdminUser
}

export async function fetchUsers(token: string) {
  const data = await apiRequest<UsersListResponse>('/api/auth/users', { token })
  return data.users || []
}

export async function createUser(token: string, payload: UserPayload) {
  return apiRequest<UserResponse>('/api/auth/users', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function updateUser(token: string, id: string, payload: UserPayload) {
  return apiRequest<UserResponse>(`/api/auth/users/${id}/role`, {
    method: 'PUT',
    token,
    body: payload,
  })
}

export async function deleteUser(token: string, id: string, reason = '') {
  return apiRequest<{ success: boolean; message?: string }>(`/api/auth/users/${id}`, {
    method: 'DELETE',
    token,
    body: reason ? { reason } : undefined,
  })
}

export async function toggleUser(token: string, id: string) {
  return apiRequest<{ success: boolean; message?: string; isActive?: boolean }>(
    `/api/auth/users/${id}/toggle`,
    { method: 'PUT', token },
  )
}

export async function updateUserPermissions(token: string, id: string, modulePermissions: ModulePermissions) {
  return apiRequest<{ success: boolean; message?: string; modulePermissions?: ModulePermissions }>(
    `/api/auth/users/${id}/permissions`,
    { method: 'PUT', token, body: { modulePermissions } },
  )
}

export function getUserId(user: AdminUser) {
  return user._id || user.id || ''
}
