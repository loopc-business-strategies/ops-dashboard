import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { enquiryDeepLinkKey } from '../../../utils/dashboardNavigation'
import { readAccountEnquiryCache, writeAccountEnquiryCache } from '../../../utils/erpAccountEnquiryCache'
import { ENQUIRY_HISTORY_STORAGE_KEY } from '../erpTabConstants'

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

  const fetchAccountEnquiryByCode = useCallback(async (accountCode, options = {}) => {
    const cleanCode = resolveAccountEnquiryCodeInput(accountCode)
    const shouldOpenModal = Boolean(options.openModal)
    const forceRefresh = Boolean(options.forceRefresh)
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
    const cached = !forceRefresh ? readAccountEnquiryCache(tenantKey, cleanCode) : null
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
      return
    }
    try {
      if (shouldOpenModal) setShowEnquiryModal(true)
      setEnquiryLoading(true)
      setShowEnquiryLookupMenu(false)
      setEnquiryStatus({ type: '', message: '' })
      const enquiryParams = { statementLimit: 80 }
      if (forceRefresh) enquiryParams.refresh = '1'
      const data = await erpAccountingAPI.getAccountEnquiry(token, cleanCode, enquiryParams)
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(data)
      writeAccountEnquiryCache(tenantKey, cleanCode, data)
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
      pushEnquiryHistory(data.account)
      setError('')
      setEnquiryStatus({ type: 'success', message: `Account ${data.account.accountCode} summary loaded successfully` })
      lastEnquiryDeepLinkKeyRef.current = deepLinkKey
      syncEnquiryUrl({
        account: data.account.accountCode,
        view: options.openStatementPreview ? 'statement' : null,
      })
      if (options.openStatementPreview) setPendingStatementPreview(true)
      showNotification('✅ Account summary loaded')
    } catch (e) {
      if (lastEnquiryDeepLinkKeyRef.current === deepLinkKey) {
        lastEnquiryDeepLinkKeyRef.current = ''
      }
      setAccountEnquiryData(null)
      const msg = e.response?.data?.message || 'Failed to fetch account summary'
      setError(msg)
      setEnquiryStatus({ type: 'error', message: msg })
    } finally {
      setEnquiryLoading(false)
    }
  }, [
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
    handleOpenAccountSummaryFromTree,
    handleAccountEnquiry,
  }
}
