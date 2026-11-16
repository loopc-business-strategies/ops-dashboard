import { apiRequest } from '@/src/api/client'

export type AlloyMixJob = {
  id: string
  mixCode: string
  /** Same as mixCode — canonical batch id for Floor / Ops. */
  batchNumber?: string
  reasonBase: string
  karat: number
  targetGross: number
  metalLossGross?: number
  finishedProductName: string
  purity: number | null
  stockCode: string
  status: 'in_vault' | 'pending_receive' | 'in_department' | 'closed'
  currentDepartment: string
  pendingFromDepartment?: string
  pendingReceive?: boolean
  hasOpenFloorDescendants?: boolean
  canUpdateMix: boolean
  canAllocate?: boolean
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
  /** Grams to move; omit for full mix. */
  weight?: number
}) {
  return apiRequest<{
    success: boolean
    partial?: boolean
    pendingReceive?: boolean
    job: AlloyMixJob
    parentJob?: AlloyMixJob
    childJob?: AlloyMixJob
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/allocate`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        toDepartment: opts.toDepartment,
        note: opts.note || '',
        ...(opts.weight != null && Number.isFinite(opts.weight) ? { weight: opts.weight } : {}),
      },
    },
  )
}

export async function receiveAlloyMixJob(opts: {
  token: string
  mixId: string
  decision: 'APPROVED' | 'REJECTED'
  note?: string
}) {
  return apiRequest<{
    success: boolean
    decision: 'APPROVED' | 'REJECTED'
    job: AlloyMixJob
    metalInEntryId?: string | null
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/receive`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        decision: opts.decision,
        note: opts.note || '',
      },
    },
  )
}
