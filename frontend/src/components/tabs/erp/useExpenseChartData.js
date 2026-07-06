import { useMemo } from 'react'
import {
  buildExpenseBreakdownFromRegister,
  buildExpenseTrendBuckets,
  expenseMonthLabel,
  peakExpenseTrendMonthIndex,
} from './expenseMonthFilterUtils'

export const EXPENSE_CHART_COLORS = ['#176B4B', '#49B68D', '#A8D8C0', '#15A8E2', '#6366F1', '#D97706']

export function useExpenseChartData({
  dashboard,
  registerItems = [],
  registerLoading = false,
  token,
  yearFilter,
  monthFilter = '',
  trendRange = '6m',
} = {}) {
  const exp = dashboard?.expenses || {}
  const breakdown = exp?.breakdown || []
  const total = Number(exp?.total || 0)
  const monthlyTrend = exp?.monthlyTrend || []
  const ytdTotal = Number(exp.ytdTotal || total)
  const selectedMonthIndex = monthFilter === '' ? -1 : Number(monthFilter)
  const registerReady = Boolean(token) && !registerLoading

  const { categories: registerBreakdown, total: registerBreakdownTotal } = useMemo(
    () => buildExpenseBreakdownFromRegister(registerItems),
    [registerItems],
  )

  const filteredTrend = useMemo(() => {
    if (registerReady) return buildExpenseTrendBuckets(registerItems, yearFilter, trendRange)
    const trend = exp?.monthlyTrend || []
    return trend
      .filter((row) => String(row.year) === yearFilter)
      .slice(trendRange === '12m' ? -12 : -6)
  }, [registerReady, registerItems, yearFilter, trendRange, exp?.monthlyTrend])

  const maxTrend = Math.max(...filteredTrend.map((row) => Number(row.amount || 0)), 1)
  const peakMonthIndex = peakExpenseTrendMonthIndex(filteredTrend)

  const breakdownSource = registerReady
    ? registerBreakdown
    : (total > 0 ? breakdown : monthlyTrend.filter((row) => Number(row.amount || 0) > 0))

  const displayTotal = registerReady
    ? registerBreakdownTotal
    : (total > 0 ? total : ytdTotal)

  const segments = useMemo(() => breakdownSource
    .slice(0, 6)
    .map((item, i) => ({
      label: item.name || item.label || item.month || 'Other',
      value: Number(item.amount || 0),
      color: EXPENSE_CHART_COLORS[i % EXPENSE_CHART_COLORS.length],
      pct: displayTotal > 0 ? (Number(item.amount || 0) / displayTotal) * 100 : 0,
    })), [breakdownSource, displayTotal])

  const subLabel = monthFilter !== '' ? expenseMonthLabel(monthFilter) : 'Total'
  const trendRangeLabel = trendRange === '12m' ? 'Last 12 Months' : 'Monthly Expenses'

  return {
    segments,
    displayTotal,
    filteredTrend,
    maxTrend,
    peakMonthIndex,
    selectedMonthIndex,
    subLabel,
    trendRangeLabel,
    registerReady,
  }
}
