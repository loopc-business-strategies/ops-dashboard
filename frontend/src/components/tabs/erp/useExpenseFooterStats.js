export function trendAmountForMonth(trendRows = [], monthIndex) {
  const idx = Number(monthIndex)
  if (Number.isNaN(idx) || idx < 0) return 0
  const row = trendRows.find((r) => r.monthIndex === idx)
  return Number(row?.amount || 0)
}

export function getTrendMonthPair(filteredTrend = [], monthFilter = '') {
  const today = new Date()
  const currentIdx = monthFilter !== '' && monthFilter !== null && monthFilter !== undefined
    ? Number(monthFilter)
    : today.getMonth()
  const prevIdx = currentIdx - 1
  return {
    currentMonthAmount: trendAmountForMonth(filteredTrend, currentIdx),
    lastMonthAmount: prevIdx >= 0 ? trendAmountForMonth(filteredTrend, prevIdx) : 0,
  }
}

export function computeExpenseDeltaPct(currentAmount, lastAmount) {
  const current = Number(currentAmount || 0)
  const last = Number(lastAmount || 0)
  if (last > 0) return ((current - last) / last) * 100
  if (current > 0) return 100
  return 0
}

export function useExpenseFooterStats({
  dashboard,
  registerItems = [],
  registerTotal = 0,
  registerReady = false,
  filteredTrend = [],
  monthFilter = '',
} = {}) {
  const exp = dashboard?.expenses || {}
  const dashboardCurrentTotal = Number(exp.currentMonthTotal ?? exp.total ?? 0)
  const dashboardLastMonthTotal = Number(exp.lastMonthTotal || 0)
  const dashboardYtdTotal = Number(exp.ytdTotal || exp.total || 0)
  const dashboardTxCount = Number(exp.transactionCount || 0)
  const dashboardAvg = dashboardTxCount > 0 ? dashboardCurrentTotal / dashboardTxCount : 0

  const periodTotal = registerItems.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const { currentMonthAmount, lastMonthAmount: trendLastMonth } = getTrendMonthPair(filteredTrend, monthFilter)

  const lastMonthAmount = registerReady ? trendLastMonth : dashboardLastMonthTotal
  const ytdTotal = registerReady ? periodTotal : dashboardYtdTotal
  const txCount = registerReady ? registerTotal : dashboardTxCount
  const avgExpense = registerItems.length > 0
    ? periodTotal / registerItems.length
    : dashboardAvg

  const deltaBaseCurrent = registerReady ? currentMonthAmount : dashboardCurrentTotal
  const deltaBaseLast = registerReady ? trendLastMonth : dashboardLastMonthTotal
  const deltaPct = computeExpenseDeltaPct(deltaBaseCurrent, deltaBaseLast)
  const deltaColor = deltaPct <= 0 ? '#059669' : '#DC2626'
  const deltaSubtext = `${deltaPct <= 0 ? 'down' : 'up'} ${Math.abs(deltaPct).toFixed(1)}% vs last month`

  return {
    periodTotal: registerReady ? periodTotal : dashboardCurrentTotal,
    lastMonthAmount,
    ytdTotal,
    txCount,
    avgExpense,
    deltaPct,
    deltaColor,
    deltaSubtext,
  }
}
