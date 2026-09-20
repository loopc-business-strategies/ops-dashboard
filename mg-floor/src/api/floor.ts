import { apiRequest } from '@/src/api/client'

export async function fetchJobs() {
  return apiRequest<{ success: boolean; jobs: unknown[] }>('/api/mg-floor/jobs')
}

export async function fetchJob(id: string) {
  return apiRequest<{ success: boolean; job: Record<string, unknown> }>(`/api/mg-floor/jobs/${id}`)
}

export async function fetchHistory(params?: Record<string, string | number>) {
  return apiRequest<{ success: boolean; movements: unknown[]; total: number }>('/api/mg-floor/history', {
    params,
  })
}

export async function fetchDepartments() {
  return apiRequest<{ success: boolean; departments: Array<{ key: string; label: string }> }>(
    '/api/mg-floor/departments',
  )
}

export async function fetchOpenPasses(params?: Record<string, string>) {
  return apiRequest<{ success: boolean; passes: unknown[] }>('/api/mg-floor/passes/open', { params })
}

export async function metalIn(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/metal/in', {
    method: 'POST',
    body,
  })
}

export async function metalOut(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/metal/out', {
    method: 'POST',
    body,
  })
}

export async function transfer(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/transfers', {
    method: 'POST',
    body,
  })
}

export async function fetchScales() {
  return apiRequest<{ success: boolean; scales: Array<Record<string, unknown>> }>('/api/mg-floor/scales')
}

export async function fetchScaleStatus(scaleId: string) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>(`/api/mg-floor/scales/${scaleId}/status`)
}

export async function syncOperations(operations: unknown[]) {
  return apiRequest<{ success: boolean; results: unknown[] }>('/api/mg-floor/sync', {
    method: 'POST',
    body: { operations },
  })
}

export async function registerDevice(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean; device: unknown }>('/api/mg-floor/devices/register', {
    method: 'POST',
    body,
  })
}

export async function correctWeight(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/corrections/weight', {
    method: 'POST',
    body,
  })
}

export async function resolveScan(code: string, hint?: string) {
  return apiRequest<{ success: boolean; match?: Record<string, unknown>; message?: string }>(
    '/api/scan/resolve',
    { method: 'POST', body: { code, hint } },
  )
}
