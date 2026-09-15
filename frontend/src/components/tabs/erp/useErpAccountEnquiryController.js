import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { enquiryDeepLinkKey } from '../../../utils/dashboardNavigation'
import { readAccountEnquiryCache, writeAccountEnquiryCache } from '../../../utils/erpAccountEnquiryCache'
import { markEnquiry, measureEnquiry } from '../../../utils/enquiryPerf'
import { ENQUIRY_HISTORY_STORAGE_KEY } from '../erpTabConstants'

/** Initial statement page size — full history remains available via load-more / date filters. */
export const ACCOUNT_ENQUIRY_STATEMENT_LIMIT = 40

function isAbortError(error) {
  return error?.name === 'CanceledError'
    || error?.name === 'AbortError'
    || error?.code === 'ERR_CANCELED'
    || Boolean(error?.__ABORT__)
}

export function useErpAccountEnquiryController({
  user,
  token,
  safeSummaryAccounts,
  accountEnquiryCode,
  accountEnquiryData,
  enquiryHistory,
  setAccountEnquiryCode,
  setAccountEnquiryData,
  setEnquiryLoading,
  setShowEnquiryLookupMenu,
  setEnquiryStatus,
  setShowEnquiryModal,
  setPendingStatementPreview,
  setStatementFilters,
  setStatementMetalCommodityEnabled,
  setEnquiryHistory,
  setError,
  showNotification,
  syncEnquiryUrl,
  lastEnquiryDeepLinkKeyRef,
  setActiveTabGuarded,
}) {
  const enquiryAbortRef = useRef(null)
  const enquirySeqRef = useRef(0)
  const statementLoadingRef = useRef(false)

  const formatSummaryAccountLabel = useCallback((account) => {
    const code = String(account?.accountCode || '').trim()
    const name = String(account?.accountName || '').trim()
    const type = String(account?.accountType || '').trim()
    return [code, name, type].filter(Boolean).join(' - ')
  }, [])

  const resolveAccountEnquiryCodeInput = useCallback((input) => {
    const cleanInput = String(input || '').trim()
    if (!cleanInput) return ''
    const exactAccount = safeSummaryAccounts.find(
      (account) => String(account?.accountCode || '').trim().toLowerCase() === cleanInput.toLowerCase(),
    )
    if (exactAccount?.accountCode) return String(exactAccount.accountCode).trim()
    const matchedLabel = safeSummaryAccounts.find(
      (account) => formatSummaryAccountLabel(account).toLowerCase() === cleanInput.toLowerCase(),
    )
    if (matchedLabel?.accountCode) return String(matchedLabel.accountCode).trim()
    const labelPrefixMatch = cleanInput.match(/^([^\s-][^-]*?)(?:\s*-\s*.*)?$/)
    return String(labelPrefixMatch?.[1] || cleanInput).trim()
  }, [formatSummaryAccountLabel, safeSummaryAccounts])

  const loadEnquiryHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(ENQUIRY_HISTORY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setEnquiryHistory(parsed.slice(0, 10))
      }
    } catch {
      setEnquiryHistory([])
    }
  }, [setEnquiryHistory])

  const persistEnquiryHistory = useCallback((nextHistory) => {
    setEnquiryHistory(nextHistory)
    localStorage.setItem(ENQUIRY_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
  }, [setEnquiryHistory])

  const pushEnquiryHistory = useCallback((account) => {
    if (!account?.accountCode) return
    const nextItem = {
      accountCode: account.accountCode,
      accountName: account.accountName || '',
      searchedAt: new Date().toISOString(),
    }
    const deduped = enquiryHistory.filter((item) => item.accountCode !== nextItem.accountCode)
    persistEnquiryHistory([nextItem, ...deduped].slice(0, 10))
  }, [enquiryHistory, persistEnquiryHistory])

  const beginEnquiryRequest = useCallback(() => {
    if (enquiryAbortRef.current) {
      try { enquiryAbortRef.current.abort() } catch { /* ignore */ }
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    enquiryAbortRef.current = controller
    const seq = ++enquirySeqRef.current
    return { controller, seq, signal: controller?.signal }
  }, [])

  const fetchAccountEnquiryByCode = useCallback(async (accountCode, options = {}) => {
    const cleanCode = resolveAccountEnquiryCodeInput(accountCode)
    const shouldOpenModal = Boolean(options.openModal)
    const forceRefresh = Boolean(options.forceRefresh)
    const preserveFilters = Boolean(options.preserveFilters)
    const startDate = String(options.startDate || '').trim()
    const endDate = String(options.endDate || '').trim()
    const statementLimit = Number(options.statementLimit) || ACCOUNT_ENQUIRY_STATEMENT_LIMIT
    const cacheWindow = { startDate, endDate, statementLimit, phase: 'summary' }
    if (!cleanCode) {
      setError('Please enter account number')
      setEnquiryStatus({ type: 'error', message: 'Please enter account number' })
      return
    }
    const tenantKey = user?.tenant || user?.company || 'default'
    const deepLinkKey = enquiryDeepLinkKey({
      account: cleanCode,
      view: options.openStatementPreview ? 'statement' : null,
    })
    const cached = !forceRefresh ? readAccountEnquiryCache(tenantKey, cleanCode, cacheWindow) : null
    if (cached) {
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(cached)
      setEnquiryLoading(false)
      lastEnquiryDeepLinkKeyRef.current = deepLinkKey
      syncEnquiryUrl({
        account: cleanCode,
        view: options.openStatementPreview ? 'statement' : null,
      })
      if (shouldOpenModal) setShowEnquiryModal(true)
      if (options.openStatementPreview) setPendingStatementPreview(true)
      setEnquiryStatus({ type: 'success', message: `Account ${cached.account?.accountCode || cleanCode} summary loaded from cache` })
      // Background refresh summary+statement
    }
    const { seq, signal } = beginEnquiryRequest()
    try {
      if (shouldOpenModal) setShowEnquiryModal(true)
      if (!cached) setEnquiryLoading(true)
      setShowEnquiryLookupMenu(false)
      if (!cached) setEnquiryStatus({ type: '', message: '' })
      markEnquiry('open')
      const summaryParams = {
        statementLimit: 0,
        includeStatement: '0',
      }
      if (startDate) summaryParams.startDate = startDate
      if (endDate) summaryParams.endDate = endDate
      if (forceRefresh) summaryParams.refresh = '1'
      const summaryData = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, summaryParams, { signal })
      if (seq !== enquirySeqRef.current) return
      markEnquiry('summary')
      measureEnquiry('summary-paint', 'open', 'summary')
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(summaryData)
      writeAccountEnquiryCache(tenantKey, cleanCode, summaryData, cacheWindow)
      setEnquiryLoading(false)
      setEnquiryStatus({ type: 'success', message: `Account ${summaryData.account.accountCode} summary loaded successfully` })

      const statementParams = {
        statementLimit,
        includeStatement: '1',
        includeCount: '0',
      }
      if (startDate) statementParams.startDate = startDate
      if (endDate) statementParams.endDate = endDate
      if (forceRefresh) statementParams.refresh = '1'
      const statementData = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, statementParams, { signal })
      if (seq !== enquirySeqRef.current) return
      markEnquiry('statement')
      measureEnquiry('statement-paint', 'summary', 'statement')
      const merged = {
        ...summaryData,
        ...statementData,
        account: statementData.account || summaryData.account,
        balances: statementData.balances || summaryData.balances,
        metals: statementData.metals || summaryData.metals,
        positions: statementData.positions || summaryData.positions,
        statement: statementData.statement,
      }
      setAccountEnquiryData(merged)
      writeAccountEnquiryCache(tenantKey, cleanCode, merged, { ...cacheWindow, phase: 'full' })
      if (!preserveFilters) {
        setStatementFilters({
          startDate: '',
          endDate: '',
          referenceType: '',
          department: '',
          fixStatus: '',
          foreignCurrency: '',
          metalCommodity: '',
          showAmountIn: '',
        })
        setStatementMetalCommodityEnabled(false)
      }
      pushEnquiryHistory(merged.account)
      setError('')
      lastEnquiryDeepLinkKeyRef.current = deepLinkKey
      syncEnquiryUrl({
        account: merged.account.accountCode,
        view: options.openStatementPreview ? 'statement' : null,
      })
      if (options.openStatementPreview) setPendingStatementPreview(true)
      if (!preserveFilters && !cached) showNotification('✅ Account summary loaded')
    } catch (e) {
      if (isAbortError(e) || seq !== enquirySeqRef.current) return
      if (lastEnquiryDeepLinkKeyRef.current === deepLinkKey) {
        lastEnquiryDeepLinkKeyRef.current = ''
      }
      if (!preserveFilters) setAccountEnquiryData(null)
      const msg = e.response?.data?.message || 'Failed to fetch account summary'
      setError(msg)
      setEnquiryStatus({ type: 'error', message: msg })
    } finally {
      if (seq === enquirySeqRef.current) setEnquiryLoading(false)
    }
  }, [
    beginEnquiryRequest,
    lastEnquiryDeepLinkKeyRef,
    pushEnquiryHistory,
    resolveAccountEnquiryCodeInput,
    setAccountEnquiryCode,
    setAccountEnquiryData,
    setEnquiryLoading,
    setEnquiryStatus,
    setError,
    setPendingStatementPreview,
    setShowEnquiryLookupMenu,
    setShowEnquiryModal,
    setStatementFilters,
    setStatementMetalCommodityEnabled,
    showNotification,
    syncEnquiryUrl,
    token,
    user?.company,
    user?.tenant,
  ])

  const loadMoreStatementEntries = useCallback(async () => {
    const cleanCode = String(accountEnquiryData?.account?.accountCode || accountEnquiryCode || '').trim()
    const meta = accountEnquiryData?.statement?.meta || {}
    const nextCursor = meta.nextCursor
    if (!cleanCode || !nextCursor || statementLoadingRef.current) return
    if (!meta.hasMore && !meta.truncated) return
    statementLoadingRef.current = true
    const { seq, signal } = beginEnquiryRequest()
    try {
      const params = {
        statementLimit: ACCOUNT_ENQUIRY_STATEMENT_LIMIT,
        includeStatement: '1',
        includeCount: '0',
        beforeDate: nextCursor.beforeDate,
        beforeId: nextCursor.beforeId,
        runningBalanceSeed: nextCursor.runningBalanceSeed,
      }
      const startDate = String(meta.startDate || '').trim()
      const endDate = String(meta.endDate || '').trim()
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const pageData = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, params, { signal })
      if (seq !== enquirySeqRef.current) return
      const newEntries = pageData?.statement?.entries || []
      setAccountEnquiryData((prev) => {
        if (!prev) return pageData
        const prevEntries = prev?.statement?.entries || []
        const seen = new Set(prevEntries.map((row) => String(row?._id || '')))
        const appended = newEntries.filter((row) => !seen.has(String(row?._id || '')))
        return {
          ...prev,
          statement: {
            ...prev.statement,
            ...pageData.statement,
            entries: [...prevEntries, ...appended],
            entryCount: prevEntries.length + appended.length,
            meta: {
              ...(pageData.statement?.meta || {}),
              returned: prevEntries.length + appended.length,
            },
          },
        }
      })
    } catch (e) {
      if (isAbortError(e) || seq !== enquirySeqRef.current) return
      const msg = e.response?.data?.message || 'Failed to load more statement rows'
      setEnquiryStatus({ type: 'error', message: msg })
    } finally {
      statementLoadingRef.current = false
    }
  }, [
    accountEnquiryCode,
    accountEnquiryData,
    beginEnquiryRequest,
    setAccountEnquiryData,
    setEnquiryStatus,
    token,
  ])

  const refetchEnquiryForDateRange = useCallback(async (startDate, endDate) => {
    const cleanCode = String(accountEnquiryData?.account?.accountCode || accountEnquiryCode || '').trim()
    if (!cleanCode) return
    await fetchAccountEnquiryByCode(cleanCode, {
      forceRefresh: true,
      preserveFilters: true,
      startDate: String(startDate || '').trim(),
      endDate: String(endDate || '').trim(),
      statementLimit: ACCOUNT_ENQUIRY_STATEMENT_LIMIT,
    })
  }, [accountEnquiryCode, accountEnquiryData?.account?.accountCode, fetchAccountEnquiryByCode])

  const handleOpenAccountSummaryFromTree = useCallback(async (account) => {
    if (!account?.accountCode) return
    setActiveTabGuarded('enquiry')
    setAccountEnquiryCode(account.accountCode)
    await fetchAccountEnquiryByCode(account.accountCode)
  }, [fetchAccountEnquiryByCode, setAccountEnquiryCode, setActiveTabGuarded])

  const handleAccountEnquiry = useCallback(async (e) => {
    e.preventDefault()
    const cleanCode = resolveAccountEnquiryCodeInput(accountEnquiryCode)
    const alreadyLoaded = String(accountEnquiryData?.account?.accountCode || '').trim() === cleanCode
    await fetchAccountEnquiryByCode(accountEnquiryCode, { openModal: true, forceRefresh: alreadyLoaded })
  }, [accountEnquiryCode, accountEnquiryData, fetchAccountEnquiryByCode, resolveAccountEnquiryCodeInput])

  return {
    formatSummaryAccountLabel,
    resolveAccountEnquiryCodeInput,
    loadEnquiryHistory,
    fetchAccountEnquiryByCode,
    refetchEnquiryForDateRange,
    loadMoreStatementEntries,
    handleOpenAccountSummaryFromTree,
    handleAccountEnquiry,
  }
}
