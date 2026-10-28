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
    calculateClosingStock: Boolean(reportFilters.calculateClosingStock),
    showClosedAccounts: Boolean(reportFilters.showClosedAccounts),
    excludeHedging: Boolean(reportFilters.excludeHedging),
    metalType: String(reportFilters.metalType || '').trim(),
  })
}

const SUMMARY_REPORT_TTL_MS = 45_000

/** Filter-only key so Summary can prefetch P&L + BS for the headline cards. */
export function buildErpReportHeadlineKey({ commonRange, reportFilters }) {
  return buildErpReportRequestKey({
    targetView: 'headline-kpi',
    commonRange,
    reportFilters,
  })
}

export function reportNeedsTrialBalance(targetView) {
  return targetView === 'summary' || targetView === 'trial'
}

export function reportNeedsProfitLoss(targetView) {
  return targetView === 'summary' || targetView === 'trial' || targetView === 'pnl'
}

export function reportNeedsBalanceSheet(targetView) {
  return targetView === 'summary' || targetView === 'trial' || targetView === 'balanceSheet'
}

export function isHeadlineReportCacheFresh(cache, headlineKey, ttlMs = SUMMARY_REPORT_TTL_MS) {
  if (!cache?.key || cache.key !== headlineKey) return false
  return Date.now() - Number(cache.at || 0) < ttlMs
}

const summaryReportCache = { key: '', at: 0, trialBalance: null }
let summaryReportInflight = null
let summaryReportInflightKey = ''

export function defaultSummaryReportFilters() {
  return {
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
    calculateClosingStock: false,
    showClosedAccounts: false,
    excludeHedging: false,
    metalType: '',
  }
}

export function peekSharedSummaryReport(requestKey) {
  if (
    summaryReportCache.key === requestKey
    && summaryReportCache.trialBalance
    && Date.now() - summaryReportCache.at < SUMMARY_REPORT_TTL_MS
  ) {
    return summaryReportCache
  }
  return null
}

/** Year-to-date summary. Concurrent callers share one download for 45 seconds. */
export function loadSharedSummaryReport(token) {
  const filters = defaultSummaryReportFilters()
  const { commonRange } = buildErpReportDateRange(filters)
  const requestKey = buildErpReportRequestKey({ targetView: 'summary', commonRange, reportFilters: filters })
  const cached = peekSharedSummaryReport(requestKey)
  if (cached) return Promise.resolve(cached)
  if (summaryReportInflight && summaryReportInflightKey === requestKey) return summaryReportInflight
  summaryReportInflightKey = requestKey
  summaryReportInflight = import('../../../api/erp-accounting/reports').then(({ reportsApi }) =>
    reportsApi.getTrialBalance(token, {
      ...commonRange,
      includeZero: 'false',
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    })).then((trialBalance) => {
    summaryReportCache.key = requestKey
    summaryReportCache.at = Date.now()
    summaryReportCache.trialBalance = trialBalance
    return summaryReportCache
  }).finally(() => {
    summaryReportInflight = null
    summaryReportInflightKey = ''
  })
  return summaryReportInflight
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
  const reportResultCacheRef = useRef({ key: '', at: 0 })
  const reportHeadlineCacheRef = useRef({ key: '', at: 0, hasPnl: false, hasBs: false })
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
    calculateClosingStock: Boolean(reportFilters.calculateClosingStock),
    showClosedAccounts: Boolean(reportFilters.showClosedAccounts),
    excludeHedging: Boolean(reportFilters.excludeHedging),
    metalType: String(reportFilters.metalType || '').trim(),
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
    reportFilters.calculateClosingStock,
    reportFilters.showClosedAccounts,
    reportFilters.excludeHedging,
    reportFilters.metalType,
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
    const headlineKey = buildErpReportHeadlineKey({ commonRange, reportFilters: reportQueryFilters })
    const headlineFresh = isHeadlineReportCacheFresh(reportHeadlineCacheRef.current, headlineKey)
    const headlineHasPnl = headlineFresh && reportHeadlineCacheRef.current.hasPnl
    const headlineHasBs = headlineFresh && reportHeadlineCacheRef.current.hasBs

    // Summary/Trial prefetch P&L + BS for KPI cards; skip re-fetch when opening those tabs.
    if (targetView === 'pnl' && headlineHasPnl) return null
    if (targetView === 'balanceSheet' && headlineHasBs) return null

    if (reportRequestRef.current.key === requestKey && reportRequestRef.current.promise) {
      return reportRequestRef.current.promise
    }
    if (reportResultCacheRef.current.key === requestKey && Date.now() - reportResultCacheRef.current.at < 45_000) {
      // Summary cache hit still needs KPI prefetch when headline cards are empty.
      if (!(targetView === 'summary' || targetView === 'trial') || (headlineHasPnl && headlineHasBs)) {
        return null
      }
    }

    let sharedTrialBalance = null
    if (targetView === 'summary') {
      const sharedSummary = peekSharedSummaryReport(requestKey)
      if (sharedSummary) {
        sharedTrialBalance = sharedSummary.trialBalance
        setReports((prev) => ({ ...prev, trialBalance: sharedTrialBalance }))
        reportResultCacheRef.current = { key: requestKey, at: sharedSummary.at }
        if (headlineHasPnl && headlineHasBs) {
          setError('')
          return null
        }
      }
    }

    const needsTb = reportNeedsTrialBalance(targetView) && !sharedTrialBalance
    const needsPnl = reportNeedsProfitLoss(targetView) && !headlineHasPnl
    const needsBs = reportNeedsBalanceSheet(targetView) && !headlineHasBs
    const needsDayBook = targetView === 'dayBook'
    const needsOutstanding = targetView === 'outstanding'
    const needsForex = targetView === 'forex'
    if (!needsTb && !needsPnl && !needsBs && !needsDayBook && !needsOutstanding && !needsForex) {
      return null
    }

    const silentRefresh = reportResultCacheRef.current.key === requestKey
    if (!silentRefresh) setReportsLoading(true)
    const seq = reportLoadSeqRef.current + 1
    reportLoadSeqRef.current = seq
    const promise = (async () => {
      try {
        const updates = {}
        const includeZero = reportQueryFilters.includeZeroAccounts ? 'true' : 'false'
        const pnlParams = {
          ...commonRange,
          includeZero,
          comparePrevious: reportQueryFilters.comparePrevious,
        }
        const bsParams = {
          ...(endDate ? { endDate } : {}),
          includeZero,
        }

        const fetchTrialBalance = async () => {
          const defaultFilters = defaultSummaryReportFilters()
          const defaultKey = buildErpReportRequestKey({
            targetView: 'summary',
            commonRange: buildErpReportDateRange(defaultFilters).commonRange,
            reportFilters: defaultFilters,
          })
          if (targetView === 'summary' && requestKey === defaultKey) {
            return (await loadSharedSummaryReport(token)).trialBalance
          }
          const tbIncludeZero = targetView === 'summary' ? 'false' : includeZero
          return api.getTrialBalance(token, {
            ...commonRange,
            ...(reportQueryFilters.accountType ? { accountType: reportQueryFilters.accountType } : {}),
            includeZero: tbIncludeZero,
            sortBy: reportQueryFilters.sortBy,
            sortDir: reportQueryFilters.sortDir,
            ...(reportQueryFilters.calculateClosingStock ? { calculateClosingStock: 'true' } : {}),
            ...(reportQueryFilters.showClosedAccounts ? { showClosedAccounts: 'true' } : {}),
            ...(reportQueryFilters.excludeHedging ? { excludeHedging: 'true' } : {}),
            ...(reportQueryFilters.metalType ? { metalType: reportQueryFilters.metalType } : {}),
          })
        }

        const [tbResult, pnlResult, bsResult] = await Promise.allSettled([
          needsTb ? fetchTrialBalance() : Promise.resolve(null),
          needsPnl ? api.getProfitLossReport(token, pnlParams) : Promise.resolve(null),
          needsBs ? api.getBalanceSheetReport(token, bsParams) : Promise.resolve(null),
        ])
        const settledValue = (result) => (result.status === 'fulfilled' ? result.value : null)
        const trialBalance = settledValue(tbResult)
        const profitLoss = settledValue(pnlResult)
        const balanceSheet = settledValue(bsResult)
        if (trialBalance) updates.trialBalance = trialBalance
        if (profitLoss) updates.profitLoss = profitLoss
        if (balanceSheet) updates.balanceSheet = balanceSheet

        if (needsDayBook) {
          updates.dayBook = await api.getDayBookReport(token, {
            ...commonRange,
            ...(reportQueryFilters.referenceType ? { referenceType: reportQueryFilters.referenceType } : {}),
            ...(reportQueryFilters.minAmount ? { minAmount: reportQueryFilters.minAmount } : {}),
          })
        }
        if (needsOutstanding) {
          const [custOut, venOut] = await Promise.all([
            api.getCustomerOutstandingReport(token),
            api.getVendorOutstandingReport(token),
          ])
          updates.customerOutstanding = custOut
          updates.vendorOutstanding = venOut
        }
        if (needsForex) {
          updates.forex = await api.getForexGainLossReport(token, commonRange)
        }

        const headlineFetchFailed = [tbResult, pnlResult, bsResult].find((result, index) => {
          const needed = [needsTb, needsPnl, needsBs][index]
          return needed && result.status === 'rejected'
        })
        if (headlineFetchFailed && Object.keys(updates).length === 0 && !needsDayBook && !needsOutstanding && !needsForex) {
          throw headlineFetchFailed.reason
        }

        if (seq === reportLoadSeqRef.current) {
          setReports((prev) => ({ ...prev, ...updates }))
          reportResultCacheRef.current = { key: requestKey, at: Date.now() }
          if (needsPnl || needsBs || headlineHasPnl || headlineHasBs) {
            reportHeadlineCacheRef.current = {
              key: headlineKey,
              at: Date.now(),
              hasPnl: Boolean(updates.profitLoss) || headlineHasPnl,
              hasBs: Boolean(updates.balanceSheet) || headlineHasBs,
            }
          }
          if (headlineFetchFailed) {
            const failedError = headlineFetchFailed.reason
            if (Number(failedError?.response?.status) === 429) {
              reportCooldownUntilRef.current = Date.now() + REPORT_RATE_LIMIT_COOLDOWN_MS
            }
            setError(failedError?.response?.data?.message || 'Failed to load some report cards')
          } else {
            setError('')
          }
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
    if (reportResultCacheRef.current.key === requestKey && Date.now() - reportResultCacheRef.current.at < 45_000) {
      return null
    }
    const silentRefresh = reportResultCacheRef.current.key === requestKey
    if (!silentRefresh) setReportsLoading(true)
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
          reportResultCacheRef.current = { key: requestKey, at: Date.now() }
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
