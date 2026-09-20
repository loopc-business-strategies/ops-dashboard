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

export async function fetchDepartments(opts?: SignalOpts) {
  return apiRequest<{ success: boolean; departments: Array<{ key: string; label: string }> }>(
    '/api/mg-floor/departments',
    { signal: opts?.signal },
  )
}

export async function fetchOpenPasses(params?: Record<string, string>, opts?: SignalOpts) {
  return apiRequest<{ success: boolean; passes: unknown[] }>('/api/mg-floor/passes/open', {
    params,
    signal: opts?.signal,
  })
}

export async function metalIn(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/metal/in', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function metalOut(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/metal/out', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function transfer(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/transfers', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function fetchScales(
  params?: Record<string, string | number | boolean>,
  opts?: SignalOpts,
) {
  return apiRequest<{ success: boolean; scales: Array<Record<string, unknown>>; total?: number }>(
    '/api/mg-floor/scales',
    { params: { enabled: true, limit: 100, ...params }, signal: opts?.signal },
  )
}

/** Full registry list for Devices / Scales admin screens */
export async function fetchScalesFull(
  params?: Record<string, string | number | boolean>,
  opts?: SignalOpts,
) {
  return fetchScales({ limit: 500, ...params }, opts)
}

export async function fetchScaleSummary(opts?: SignalOpts) {
  return fetchScales({ limit: 50 }, opts)
}

export async function fetchScaleStatus(scaleId: string, opts?: SignalOpts) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>(
    `/api/mg-floor/scales/${scaleId}/status`,
    { signal: opts?.signal },
  )
}

export async function captureStableReading(scaleId: string, expectedWeight?: number | null) {
  return apiRequest<{
    success: boolean
    scaleReadingId: string
    scaleId: string
    weight: number
    unit?: string
    stable?: boolean
    recordedAt?: string
    gatewayId?: string
  }>(`/api/mg-floor/scales/${scaleId}/capture-stable`, {
    method: 'POST',
    body: expectedWeight != null ? { expectedWeight } : {},
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

export async function resolveScan(code: string, hint?: string) {
  return apiRequest<{ success: boolean; match?: Record<string, unknown>; message?: string }>(
    '/api/scan/resolve',
    { method: 'POST', body: { code, hint }, retrySafeGet: false },
  )
}

export async function fetchXrfDevices(opts?: SignalOpts) {
  return apiRequest<{ success: boolean; devices: Array<Record<string, unknown>> }>(
    '/api/mg-floor/xrf/devices',
    { signal: opts?.signal },
  )
}

export async function fetchXrfStatus(analyzerId: string, opts?: SignalOpts) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>(
    `/api/mg-floor/xrf/${analyzerId}/status`,
    { signal: opts?.signal },
  )
}

export async function submitXrfTest(body: Record<string, unknown>) {
  return apiRequest<{ success: boolean } & Record<string, unknown>>('/api/mg-floor/xrf/tests', {
    method: 'POST',
    body,
    retrySafeGet: false,
  })
}

export async function fetchXrfTests(params?: Record<string, string | number>, opts?: SignalOpts) {
  return apiRequest<{ success: boolean; tests: unknown[]; total: number }>('/api/mg-floor/xrf/tests', {
    params,
    signal: opts?.signal,
  })
}
