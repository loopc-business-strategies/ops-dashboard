import { apiRequest } from '@/src/api/client'

type SignalOpts = { signal?: AbortSignal }

export type BatchDirection = 'IN' | 'OUT'
export type BatchEntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type BatchEntryLine = {
  metal: string
  qty: number | null
  purity: number | null
  time: string
}

export type SubmitBatchEntryBody = {
  entryId: string
  direction: BatchDirection
  department: string
  batchLabel: string
  entryDate: string
  deviceId?: string | null
  /** Tablet UTC offset in minutes (east positive) so line times map to real timestamps in the workbook. */
  tzOffsetMinutes?: number
  lines: BatchEntryLine[]
}

export type BatchEntryRow = {
  _id: string
  entryId: string
  direction: BatchDirection
  department: string
  batchLabel: string
  entryDate: string
  lines: BatchEntryLine[]
  employeeName?: string
  status: BatchEntryStatus
  submittedAt: string
  decidedAt?: string | null
  decidedByName?: string
  rejectReason?: string
}

/** `token` sends as a specific employee on a shared tablet; omitted uses the tablet's primary login. */
export async function submitBatchEntry(body: SubmitBatchEntryBody, token?: string | null) {
  return apiRequest<{ success: boolean; reused?: boolean; entry: BatchEntryRow }>('/api/mg-floor/batch-entries', {
    method: 'POST',
    body,
    retrySafeGet: false,
    ...(token ? { token } : {}),
  })
}

export async function fetchBatchEntries(params: Record<string, string | number>, opts?: SignalOpts) {
  return apiRequest<{
    success: boolean
    entries: BatchEntryRow[]
    total: number
    counts: Record<BatchEntryStatus, number>
    canDecide: boolean
  }>('/api/mg-floor/batch-entries', { params, signal: opts?.signal })
}
