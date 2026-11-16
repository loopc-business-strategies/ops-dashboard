import { apiRequest } from '@/src/api/client'

export type AlloyMixJob = {
  id: string
  mixCode: string
  reasonBase: string
  karat: number
  targetGross: number
  metalLossGross?: number
  finishedProductName: string
  purity: number | null
  stockCode: string
  status: 'in_vault' | 'in_department' | 'closed'
  currentDepartment: string
  canUpdateMix: boolean
  updatedAt?: string
}

export async function listAlloyMixJobs(opts: {
  token: string
  department?: string
  signal?: AbortSignal
}) {
  return apiRequest<{
    success: boolean
    department: string | null
    departments: string[]
    jobs: AlloyMixJob[]
  }>('/api/mg-floor/alloy-mix-jobs', {
    token: opts.token,
    params: { department: opts.department || undefined },
    signal: opts.signal,
  })
}

export async function allocateAlloyMixJob(opts: {
  token: string
  mixId: string
  toDepartment: string
  note?: string
}) {
  return apiRequest<{ success: boolean; job: AlloyMixJob }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/allocate`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        toDepartment: opts.toDepartment,
        note: opts.note || '',
      },
    },
  )
}
