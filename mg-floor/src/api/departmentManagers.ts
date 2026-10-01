import { apiRequest } from '@/src/api/client'

export type DepartmentManager = { id: string; name: string; assignedByName?: string; assignedAt?: string | null }
export type ManagerOption = { id: string; name: string; productionRole: 'floor_manager' | 'production_manager' }

/** Every department's assigned manager; canAssign = this login may change them. */
export async function fetchDepartmentManagers(opts?: { signal?: AbortSignal }) {
  return apiRequest<{ success: boolean; canAssign: boolean; managers: Record<string, DepartmentManager> }>(
    '/api/mg-floor/department-managers',
    { signal: opts?.signal },
  )
}

/** Floor / Production Manager accounts that can be assigned (managers only). */
export async function fetchManagerOptions() {
  return apiRequest<{ success: boolean; managers: ManagerOption[] }>('/api/mg-floor/department-managers/options')
}

/** Managers only; null removes the assigned manager. */
export async function saveDepartmentManager(department: string, managerId: string | null) {
  return apiRequest<{ success: boolean; department: string; manager: DepartmentManager | null }>(
    `/api/mg-floor/department-managers/${encodeURIComponent(department)}`,
    { method: 'PUT', body: { managerId }, retrySafeGet: false },
  )
}
