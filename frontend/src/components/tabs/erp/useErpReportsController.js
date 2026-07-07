import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  currentExpenseMonthIndex,
  currentExpenseYear,
  expenseMonthDateRange,
} from './expenseMonthFilterUtils'

export const REPORT_REQUEST_DEBOUNCE_MS = 250
export const REPORT_RATE_LIMIT_COOLDOWN_MS = 60_000

export const createInitialReportsState = () => ({
  trialBalance: null,
  profitLoss: null,
  balanceSheet: null,
  dayBook: null,
  customerOutstanding: null,
  vendorOutstanding: null,
  forex: null,
})

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildErpReportDateRange(reportFilters, now = new Date()) {
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  let startDate = ''
  let endDate = ''

  if (reportFilters.period === 'today') {
    startDate = formatLocalDate(now)
    endDate = startDate
  } else if (reportFilters.period === 'month') {
    const monthRange = expenseMonthDateRange(
      reportFilters.reportYear || String(now.getFullYear()),
      reportFilters.reportMonth ?? String(now.getMonth()),
    )
    startDate = monthRange.startDate
    endDate = monthRange.endDate
  } else if (reportFilters.period === 'ytd') {
    startDate = formatLocalDate(startOfYear)
    endDate = formatLocalDate(now)
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

export function buildErpReportRequestKey({ targetView, commonRange, reportFilters }) {
  return JSON.stringify({
    targetView,
    commonRange,
    reportYear: reportFilters.reportYear,
    reportMonth: reportFilters.reportMonth,
    accountType: reportFilters.accountType,
    includeZeroAccounts: reportFilters.includeZeroAccounts,
    sortBy: reportFilters.sortBy,
    sortDir: reportFilters.sortDir,
    comparePrevious: reportFilters.comparePrevious,
    referenceType: reportFilters.referenceType,
    minAmount: reportFilters.minAmount,
  })
}

export function useErpReportsController({
  token,
  activeTab,
  canAccessERP,
  canAccessReports,
  accounts,
  loadAccounts,
  loadReportBranding,
  setError,
  api,
}) {
  const [reports, setReports] = useState(createInitialReportsState)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportView, setReportView] = useState('summary')
  const [reportFilters, setReportFilters] = useState({
    period: 'ytd',
    reportYear: currentExpenseYear(),
    reportMonth: currentExpenseMonthIndex(),
    startDate: '',
    endDate: '',
    accountType: '',
    includeZeroAccounts: false,
    sortBy: 'accountCode',
    sortDir: 'asc',
    comparePrevious: true,
    referenceType: '',
    minAmount: '',
    search: '',
  })
  const [selectedReportAccountId, setSelectedReportAccountId] = useState('')
  const [selectedReportAccountCode, setSelectedReportAccountCode] = useState('')
  const [ledgerReportRows, setLedgerReportRows] = useState([])

  const reportRequestRef = useRef({ key: '', promise: null })
  const ledgerRequestRef = useRef({ key: '', promise: null })
  const reportEffectTimerRef = useRef(null)
  const reportCooldownUntilRef = useRef(0)
  const reportLoadSeqRef = useRef(0)
  const ledgerLoadSeqRef = useRef(0)
  const loadAccountsRef = useRef(loadAccounts)
  const loadReportBrandingRef = useRef(loadReportBranding)
  const reportQueryFilters = useMemo(() => ({
    period: reportFilters.period,
    reportYear: reportFilters.reportYear,
    reportMonth: reportFilters.reportMonth,
    startDate: reportFilters.startDate,
    endDate: reportFilters.endDate,
    accountType: reportFilters.accountType,
    includeZeroAccounts: reportFilters.includeZeroAccounts,
    sortBy: reportFilters.sortBy,
    sortDir: reportFilters.sortDir,
    comparePrevious: reportFilters.comparePrevious,
    referenceType: reportFilters.referenceType,
    minAmount: reportFilters.minAmount,
  }), [
    reportFilters.accountType,
    reportFilters.comparePrevious,
    reportFilters.endDate,
    reportFilters.includeZeroAccounts,
    reportFilters.minAmount,
    reportFilters.period,
    reportFilters.referenceType,
    reportFilters.reportMonth,
    reportFilters.reportYear,
    reportFilters.sortBy,
    reportFilters.sortDir,
    reportFilters.startDate,
  ])
  const ledgerDateFilters = useMemo(() => ({
    period: reportFilters.period,
    reportYear: reportFilters.reportYear,
    reportMonth: reportFilters.reportMonth,
    startDate: reportFilters.startDate,
    endDate: reportFilters.endDate,
  }), [
    reportFilters.endDate,
    reportFilters.period,
    reportFilters.reportMonth,
    reportFilters.reportYear,
    reportFilters.startDate,
  ])

  useEffect(() => {
    loadAccountsRef.current = loadAccounts
  }, [loadAccounts])

  useEffect(() => {
    loadReportBrandingRef.current = loadReportBranding
  }, [loadReportBranding])

  const loadReports = useCallback(async (targetView = reportView) => {
    if (!canAccessReports || targetView === 'ledger') return null
    if (Date.now() < reportCooldownUntilRef.current) {
      setError('Too many report requests. Please wait and try again.')
      return null
    }

    const { endDate, commonRange } = buildErpReportDateRange(reportQueryFilters)
    const requestKey = buildErpReportRequestKey({ targetView, commonRange, reportFilters: reportQueryFilters })
    if (reportRequestRef.current.key === requestKey && reportRequestRef.current.promise) {
      return reportRequestRef.current.promise
    }

    setReportsLoading(true)
    const seq = reportLoadSeqRef.current + 1
    reportLoadSeqRef.current = seq
    const promise = (async () => {
      try {
        const updates = {}

        if (targetView === 'summary' || targetView === 'trial') {
          const includeZero = targetView === 'summary' ? 'false' : (reportQueryFilters.includeZeroAccounts ? 'true' : 'false')
          updates.trialBalance = await api.getTrialBalance(token, {
            ...commonRange,
            ...(reportQueryFilters.accountType ? { accountType: reportQueryFilters.accountType } : {}),
            includeZero,
            sortBy: reportQueryFilters.sortBy,
            sortDir: reportQueryFilters.sortDir,
          })
        }
        if (targetView === 'pnl') {
          updates.profitLoss = await api.getProfitLossReport(token, {
            ...commonRange,
            includeZero: reportQueryFilters.includeZeroAccounts ? 'true' : 'false',
            comparePrevious: reportQueryFilters.comparePrevious,
          })
        }
        if (targetView === 'balanceSheet') {
          updates.balanceSheet = await api.getBalanceSheetReport(token, {
            ...(endDate ? { endDate } : {}),
            includeZero: reportQueryFilters.includeZeroAccounts ? 'true' : 'false',
          })
        }
        if (targetView === 'dayBook') {
          updates.dayBook = await api.getDayBookReport(token, {
            ...commonRange,
            ...(reportQueryFilters.referenceType ? { referenceType: reportQueryFilters.referenceType } : {}),
            ...(reportQueryFilters.minAmount ? { minAmount: reportQueryFilters.minAmount } : {}),
          })
        }
        if (targetView === 'outstanding') {
          const [custOut, venOut] = await Promise.all([
            api.getCustomerOutstandingReport(token),
            api.getVendorOutstandingReport(token),
          ])
          updates.customerOutstanding = custOut
          updates.vendorOutstanding = venOut
        }
        if (targetView === 'forex') {
          updates.forex = await api.getForexGainLossReport(token, commonRange)
        }

        if (seq === reportLoadSeqRef.current) {
          setReports((prev) => ({ ...prev, ...updates }))
          setError('')
        }
      } catch (e) {
        if (Number(e?.response?.status) === 429) {
          reportCooldownUntilRef.current = Date.now() + REPORT_RATE_LIMIT_COOLDOWN_MS
        }
        if (seq === reportLoadSeqRef.current) {
          setError(e?.response?.data?.message || 'Failed to load reports')
        }
      } finally {
        if (reportRequestRef.current.key === requestKey) {
          reportRequestRef.current = { key: '', promise: null }
        }
        if (seq === reportLoadSeqRef.current) {
          setReportsLoading(false)
        }
      }
      return null
    })()
    reportRequestRef.current = { key: requestKey, promise }
    return promise
  }, [api, canAccessReports, reportQueryFilters, reportView, setError, token])

  const loadLedgerReport = useCallback(async (accountId) => {
    if (!accountId) {
      setLedgerReportRows([])
      return null
    }
    if (Date.now() < reportCooldownUntilRef.current) {
      setError('Too many report requests. Please wait and try again.')
      return null
    }

    const { startDate, endDate } = buildErpReportDateRange(ledgerDateFilters)
    const requestKey = JSON.stringify({ accountId, startDate, endDate })
    if (ledgerRequestRef.current.key === requestKey && ledgerRequestRef.current.promise) {
      return ledgerRequestRef.current.promise
    }

    setReportsLoading(true)
    const seq = ledgerLoadSeqRef.current + 1
    ledgerLoadSeqRef.current = seq
    const promise = (async () => {
      try {
        const data = await api.getLedgerReport(token, {
          accountId,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        })
        if (seq === ledgerLoadSeqRef.current) {
          setLedgerReportRows(data.report || [])
          setError('')
        }
      } catch (e) {
        if (Number(e?.response?.status) === 429) {
          reportCooldownUntilRef.current = Date.now() + REPORT_RATE_LIMIT_COOLDOWN_MS
        }
        if (seq === ledgerLoadSeqRef.current) {
          setError(e?.response?.data?.message || 'Failed to load ledger report')
        }
      } finally {
        if (ledgerRequestRef.current.key === requestKey) {
          ledgerRequestRef.current = { key: '', promise: null }
        }
        if (seq === ledgerLoadSeqRef.current) {
          setReportsLoading(false)
        }
      }
      return null
    })()
    ledgerRequestRef.current = { key: requestKey, promise }
    return promise
  }, [api, ledgerDateFilters, setError, token])

  const handleTrialAccountDrilldown = useCallback((accountCode) => {
    const match = accounts.find((acc) => acc.accountCode === accountCode)
    if (!match?._id) return
    setSelectedReportAccountId(match._id)
    setSelectedReportAccountCode(match.accountCode)
    setReportView('ledger')
  }, [accounts])

  const handleReportAccountDrilldown = useCallback((accountId, accountCode) => {
    if (!accountId) return
    setSelectedReportAccountId(String(accountId))
    setSelectedReportAccountCode(accountCode || '')
    setReportView('ledger')
  }, [])

  useEffect(() => {
    if (!canAccessERP || !token || activeTab !== 'reports') return undefined
    loadReportBrandingRef.current?.()
    if (!accounts.length) loadAccountsRef.current?.()
    if (reportEffectTimerRef.current) {
      window.clearTimeout(reportEffectTimerRef.current)
    }
    reportEffectTimerRef.current = window.setTimeout(() => {
      if (reportView === 'ledger') {
        if (selectedReportAccountId) {
          loadLedgerReport(selectedReportAccountId)
        } else {
          setLedgerReportRows([])
        }
        return
      }
      loadReports(reportView)
    }, REPORT_REQUEST_DEBOUNCE_MS)
    return () => {
      if (reportEffectTimerRef.current) {
        window.clearTimeout(reportEffectTimerRef.current)
        reportEffectTimerRef.current = null
      }
    }
  }, [
    accounts.length,
    activeTab,
    canAccessERP,
    loadLedgerReport,
    loadReports,
    reportView,
    selectedReportAccountId,
    token,
  ])

  return {
    reports,
    reportsLoading,
    reportView,
    setReportView,
    reportFilters,
    setReportFilters,
    selectedReportAccountId,
    setSelectedReportAccountId,
    selectedReportAccountCode,
    setSelectedReportAccountCode,
    ledgerReportRows,
    handleTrialAccountDrilldown,
    handleReportAccountDrilldown,
  }
}
