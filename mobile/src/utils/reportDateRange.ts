export type ReportPeriod = 'today' | 'month' | 'ytd' | 'custom'

export type ReportDateRange = {
  startDate: string
  endDate: string
  commonRange: { startDate?: string; endDate?: string }
}

/** Match web ERPTab `buildReportDateRange` / `useErpReports` semantics. */
export function buildReportDateRange(
  period: ReportPeriod,
  customStart = '',
  customEnd = '',
): ReportDateRange {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  let startDate = ''
  let endDate = ''
  if (period === 'today') {
    startDate = now.toISOString().slice(0, 10)
    endDate = startDate
  } else if (period === 'month') {
    startDate = startOfMonth.toISOString().slice(0, 10)
    endDate = endOfMonth.toISOString().slice(0, 10)
  } else if (period === 'ytd') {
    startDate = startOfYear.toISOString().slice(0, 10)
    endDate = now.toISOString().slice(0, 10)
  } else if (period === 'custom') {
    startDate = customStart || ''
    endDate = customEnd || ''
  }
  return {
    startDate,
    endDate,
    commonRange: {
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    },
  }
}
