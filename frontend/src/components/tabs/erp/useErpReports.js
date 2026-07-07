import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

function buildReportDateRange(reportFilters) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  let startDate = ''
  let endDate = ''
  if (reportFilters.period === 'today') {
    startDate = now.toISOString().slice(0, 10)
    endDate = startDate
  } else if (reportFilters.period === 'month') {
    startDate = startOfMonth.toISOString().slice(0, 10)
    endDate = endOfMonth.toISOString().slice(0, 10)
  } else if (reportFilters.period === 'ytd') {
    startDate = startOfYear.toISOString().slice(0, 10)
    endDate = now.toISOString().slice(0, 10)
  } else if (reportFilters.period === 'custom') {
    startDate = reportFilters.startDate || ''
    endDate = reportFilters.endDate || ''
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

export function useErpReports({
  token,
  canAccessReports,
  reportView,
  reportFilters,
  setLoading,
  setReports,
  setLedgerReportRows,
  setError,
}) {
  const loadReports = useCallback(async (targetView = reportView) => {
    if (!canAccessReports) return
    setLoading(true)
    try {
      const { endDate, commonRange } = buildReportDateRange(reportFilters)
      const updates = {}

      if (targetView === 'summary' || targetView === 'trial') {
        const includeZero = targetView === 'summary' ? 'false' : (reportFilters.includeZeroAccounts ? 'true' : 'false')
        updates.trialBalance = await erpAccountingAPI.getTrialBalance(token, {
          ...commonRange,
          ...(reportFilters.accountType ? { accountType: reportFilters.accountType } : {}),
          includeZero,
          sortBy: reportFilters.sortBy,
          sortDir: reportFilters.sortDir,
        })
      }
      if (targetView === 'pnl') {
        updates.profitLoss = await erpAccountingAPI.getProfitLossReport(token, {
          ...commonRange,
          includeZero: reportFilters.includeZeroAccounts ? 'true' : 'false',
          comparePrevious: reportFilters.comparePrevious,
        })
      }
      if (targetView === 'balanceSheet') {
        updates.balanceSheet = await erpAccountingAPI.getBalanceSheetReport(token, {
          ...(endDate ? { endDate } : {}),
          includeZero: reportFilters.includeZeroAccounts ? 'true' : 'false',
        })
      }
      if (targetView === 'dayBook') {
        updates.dayBook = await erpAccountingAPI.getDayBookReport(token, {
          ...commonRange,
          ...(reportFilters.referenceType ? { referenceType: reportFilters.referenceType } : {}),
          ...(reportFilters.minAmount ? { minAmount: reportFilters.minAmount } : {}),
        })
      }
      if (targetView === 'outstanding') {
        const [custOut, venOut] = await Promise.all([
          erpAccountingAPI.getCustomerOutstandingReport(token),
          erpAccountingAPI.getVendorOutstandingReport(token),
        ])
        updates.customerOutstanding = custOut
        updates.vendorOutstanding = venOut
      }
      if (targetView === 'forex') {
        updates.forex = await erpAccountingAPI.getForexGainLossReport(token, commonRange)
      }

      setReports((prev) => ({ ...prev, ...updates }))
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reports')
    }
    setLoading(false)
  }, [token, canAccessReports, reportView, reportFilters, setLoading, setReports, setError])

  const loadLedgerReport = useCallback(async (accountId) => {
    if (!accountId) {
      setLedgerReportRows([])
      return
    }
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      let startDate = ''
      let endDate = ''
      if (reportFilters.period === 'today') {
        startDate = now.toISOString().slice(0, 10)
        endDate = startDate
      } else if (reportFilters.period === 'month') {
        startDate = startOfMonth.toISOString().slice(0, 10)
        endDate = endOfMonth.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
        endDate = now.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'custom') {
        startDate = reportFilters.startDate || ''
        endDate = reportFilters.endDate || ''
      }
      const data = await erpAccountingAPI.getLedgerReport(token, {
        accountId,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      })
      setLedgerReportRows(data.report || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger report')
    }
  }, [token, reportFilters, setLedgerReportRows, setError])

  return { loadReports, loadLedgerReport }
}
