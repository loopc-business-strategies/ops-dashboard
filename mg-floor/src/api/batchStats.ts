import { apiRequest } from '@/src/api/client'

export type LossRef = { batchNumber: string; date: string; loss: number; lossPct: number | null }
export type LossAvg = { loss: number; lossPct: number | null; batches: number }
export type TimeRef = { batchNumber: string; date: string; minutes: number }
export type TimeAvg = { minutes: number; batches: number }

/** Metal loss and batch time from Floor Manager approved batches ("overall" = all time). */
export type BatchStats = {
  department: string
  date: string
  lossLimitPct: number | null
  lossLimitSetBy: string
  canSetLossLimit: boolean
  loss: {
    last: LossRef | null
    todayTotal: LossAvg | null
    todayAvg: LossAvg | null
    overallAvg: LossAvg | null
    bestToday: LossRef | null
    bestEver: LossRef | null
  }
  time: {
    running: { batchNumber: string; date: string; startedAt: string } | null
    last: TimeRef | null
    todayAvg: TimeAvg | null
    overallAvg: TimeAvg | null
    bestToday: TimeRef | null
    bestEver: TimeRef | null
  }
}

export async function fetchBatchStats(department: string, date: string, opts?: { signal?: AbortSignal }) {
  return apiRequest<BatchStats & { success: boolean }>('/api/mg-floor/batch-stats', {
    params: { department, date },
    signal: opts?.signal,
  })
}

/** Floor / Production Managers only; null removes the limit. */
export async function saveLossLimit(department: string, lossLimitPct: number | null) {
  return apiRequest<{ success: boolean; department: string; lossLimitPct: number | null; lossLimitSetBy: string }>(
    '/api/mg-floor/batch-stats/loss-limit',
    { method: 'PUT', body: { department, lossLimitPct }, retrySafeGet: false },
  )
}
