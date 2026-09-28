import { apiRequest } from '@/src/api/client'

type SignalOpts = { signal?: AbortSignal }

export async function fetchJobs(opts?: SignalOpts) {
  return apiRequest<{ success: boolean; jobs: unknown[] }>('/api/mg-floor/jobs', { signal: opts?.signal })
}

export async function fetchJob(id: string, opts?: SignalOpts) {
  return apiRequest<{ success: boolean; job: Record<string, unknown> }>(`/api/mg-floor/jobs/${id}`, {
    signal: opts?.signal,
  })
}

export async function fetchHistory(params?: Record<string, string | number>, opts?: SignalOpts) {
  return apiRequest<{ success: boolean; movements: unknown[]; total: number }>('/api/mg-floor/history', {
    params,
    signal: opts?.signal,
  })
}

export async function fetchStatsSummary(params?: Record<string, string>, opts?: SignalOpts) {
  return apiRequest<{
    success: boolean
    metalIn: { count: number; total: number; average: number }
    metalOut: { count: number; total: number; average: number }
  }>('/api/mg-floor/stats/summary', {
    params,
    signal: opts?.signal,
  })
}

export async function callFloorManager(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean; alert?: unknown }>('/api/mg-floor/alerts', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function syncOperations(operations: unknown[]) {
  return apiRequest<{ success: boolean; results: unknown[] }>('/api/mg-floor/sync', {
    method: 'POST',
    body: { operations },
    retrySafeGet: false,
  })
}

export async function registerDevice(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean; device: unknown }>('/api/mg-floor/devices/register', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function correctWeight(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/corrections/weight', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}
