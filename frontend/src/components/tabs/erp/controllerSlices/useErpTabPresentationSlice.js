import { useEffect } from 'react'
import { resolveErpUserTenantBranding } from '../resolveErpUserTenant'
import erpAccountingAPI from '../../../../api/erp-accounting'
import { useJournalVoucher } from '../useJournalVoucher'
import { useEnquiryDeepLinkEffects } from '../accountEnquiry/useEnquiryDeepLinkEffects'
import { expenseMonthLabel } from '../expenseMonthFilterUtils'
import { buildErpReportDateRange } from '../useErpReportsController'


import { generateStatementHtml as buildStatementHtml } from '../statementPrintHtml'
import { DEFAULT_BRANDING } from '../ERPBrandingUtils'
import { resolveDocumentBranding } from '../documentBranding'
import { buildBrandingLogoTag as buildBrandingLogoTagHelper, openPrintWindow as openPrintWindowHelper } from '../erpPrintHelpers'
import { useErpExportActions } from '../useErpExportActions'



export function useErpTabPresentationSlice(scope) {
  const {
    accountEnquiryCode,
    accountEnquiryData,
    accountEnquiryDataRef,
    activeTab,
    buildJvDocNo,
    canCloseLedgerPeriod,
    convertJvAmount,
    currencies,
    inventoryTenantKey,
    jumpToEnquiryAccountCode,
    jumpToTransactionId,
    jvEditEntryIds,
    jvHeader,
    jvLines,
    jvModalDefaultSize,
    jvMode,
    jvReadOnly,
    lastEnquiryDeepLinkKeyRef,
    ledgerVoucherTab,
    loadDashboard,
    nextJvLineId,
    onJumpToEnquiryConsumed,
    onJumpToTransactionConsumed,
    pendingStatementPreview,
    reportBranding,
    searchParams,
    setActiveTabGuarded,
    setError,
    setExportOptionsOpen,
    setJvEditEntryIds,
    setJvHeader,
    setJvLines,
    setJvModalDrag,
    setJvModalOffset,
    setJvModalResize,
    setJvModalSize,
    setJvMode,
    setJvReadOnly,
    setNextJvLineId,
    setPendingStatementPreview,
    setSaving,
    setShowLedgerForm,
    setShowStatementPreview,
    setStatementPreviewHtml,
    setStatementPreviewLoading,
    setStatementPreviewTitle,
    showEnquiryModal,
    showEnquiryModalRef,
    showNotification,
    statementFilters,
    syncEnquiryUrl,
    token,
    TRANSACTION_TYPE_LABELS,
    transactions,
    user,
    baseCurrencyCode,
    convertStatementDisplayAmount,
    entryAccountOptions,
    filteredStatementEntries,
    formatStatementDate,
    inferJvAccountCurrency,
    rawStatementEntries,
    resolvePreferredStatementMetalCode,
    resolveStatementReceiptNo,
    statementDisplayCurrency,
    statementSelectedMetalCode,
    fetchAccountEnquiryByCode,
    handleJumpToTransaction,
    ledgerReportRows,
    loadEnquiryHistory,
    loadLedger,
    reportFilters,
    reports,
    reportView,
    selectedReportAccountCode,
    selectedTransactionIds,
  } = scope

  useEffect(() => {
    loadEnquiryHistory()
  }, [loadEnquiryHistory])
  useEffect(() => {
    accountEnquiryDataRef.current = accountEnquiryData
  }, [accountEnquiryData, accountEnquiryDataRef])
  useEffect(() => {
    showEnquiryModalRef.current = showEnquiryModal
  }, [showEnquiryModal, showEnquiryModalRef])
  const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const formatMoneyAbs = (value) => Math.abs(Number(value || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const formatReportDirectionalBalance = (row, fallbackDirection = '') => (
    formatDirectionalBalance(row?.balance, { preferredDirection: row?.direction || fallbackDirection })
  )
  const getReportPeriodLabel = () => {
    const now = new Date()
    const formatDate = (value) => {
      if (!value) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value)
      return d.toLocaleDateString()
    }
    if (reportFilters.period === 'today') {
      const today = now.toISOString().slice(0, 10)
      return `Today (${formatDate(today)})`
    }
    if (reportFilters.period === 'month') {
      const { startDate, endDate } = buildErpReportDateRange(reportFilters, now)
      const monthName = expenseMonthLabel(reportFilters.reportMonth)
      const year = reportFilters.reportYear || String(now.getFullYear())
      return `Month (${monthName} ${year}: ${formatDate(startDate)} - ${formatDate(endDate)})`
    }
    if (reportFilters.period === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1)
      return `Year To Date (${formatDate(start)} - ${formatDate(now)})`
    }
    if (reportFilters.period === 'custom') {
      const start = reportFilters.startDate || '-'
      const end = reportFilters.endDate || '-'
      return `Custom Range (${formatDate(start)} - ${formatDate(end)})`
    }
    return 'Period: Not set'
  }
  const normalizeBalanceDirection = (direction) => {
    const raw = String(direction || '').trim().toLowerCase()
    if (raw === 'debit' || raw === 'dr') return 'Dr'
    if (raw === 'credit' || raw === 'cr') return 'Cr'
    return ''
  }
  const formatDirectionalBalance = (value, options = {}) => {
    const amount = Number(value || 0)
    const preferredDirection = normalizeBalanceDirection(options.preferredDirection)
    const direction = preferredDirection || (amount < 0 ? 'Cr' : 'Dr')
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString(undefined, {
      minimumFractionDigits: options.minDigits ?? 2,
      maximumFractionDigits: options.maxDigits ?? 2,
    })
    if (absAmount === 0) return formatted
    return `${formatted} ${direction}`
  }
  const getDepartmentBadgeStyle = (department) => {
    const deptValue = String(department || '').trim().toLowerCase()
    if (deptValue === 'finance') return { background: '#DBEAFE', color: '#1D4ED8' }
    if (deptValue === 'sales') return { background: '#FCE7F3', color: '#BE185D' }
    if (deptValue === 'operations') return { background: '#DCFCE7', color: '#166534' }
    if (deptValue === 'production') return { background: '#FEF3C7', color: '#92400E' }
    if (deptValue === 'hr') return { background: '#EDE9FE', color: '#6D28D9' }
    return { background: '#E5E7EB', color: '#374151' }
  }
  const tenantBranding = resolveErpUserTenantBranding(user)
  const branding = resolveDocumentBranding({ reportBranding, user, tenantBranding })
  const buildBrandingLogoTag = buildBrandingLogoTagHelper
  const openPrintWindow = (title, bodyHtml) => openPrintWindowHelper(title, bodyHtml, setError)
  const {
    updateJvLine,
    resolveJvLineAccount,
    getJvValidation,
    addJvLine,
    removeJvLine,
    handleJvLineKeyDown,
    handleJvAccountKeyDown,
    resetJvForm: _resetJvForm,
    handleOpenJv,
    handleEditJv,
    closeJvModal,
    openJvModal,
    switchJvMode,
    handleRepairJvFxPreview,
    handleRepairJvFxApply,
    handleSaveMultiLineJV,
    handlePrintJvVoucher,
    getJvAccountById: _getJvAccountById,
    isExchangeLine: _isExchangeLine,
    jvError,
  } = useJournalVoucher({
    jvMode,
    setJvMode,
    jvLines,
    setJvLines,
    jvHeader,
    setJvHeader,
    nextJvLineId,
    setNextJvLineId,
    jvEditEntryIds,
    setJvEditEntryIds,
    jvReadOnly,
    setJvReadOnly,
    entryAccountOptions,
    baseCurrencyCode,
    inventoryTenantKey,
    convertJvAmount,
    inferJvAccountCurrency,
    token,
    erpAccountingAPI,
    currencies,
    setError,
    setSaving,
    loadLedger,
    loadDashboard,
    showNotification,
    branding,
    buildBrandingLogoTag,
    openPrintWindow,
    defaultCompanyName: DEFAULT_BRANDING.companyName,
    user,
    JV_MODAL_DEFAULT_SIZE: jvModalDefaultSize,
    setJvModalOffset,
    setJvModalDrag,
    setJvModalResize,
    setJvModalSize,
    setShowLedgerForm,
    buildJvDocNo,
    ledgerVoucherTab,
    canCloseLedgerPeriod,
  })
  const _escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  const generateStatementHtml = (options = {}) => buildStatementHtml({
    accountEnquiryData,
    filteredStatementEntries,
    resolveStatementReceiptNo,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    rawStatementEntries,
    formatStatementDate,
    convertStatementDisplayAmount,
    tenantBranding,
    user,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    statementFilters,
    screenPreview: options.screenPreview === true,
  })
  const {
    handleViewStatement,
    handlePrintStatement,
    handleDownloadStatementPdf,
    handleExportEnquiryPdf,
    handleExportTransactionsCsv,
    handleExportTransactionsXlsx,
    handleExportTransactionsPdf,
    handleExportReportCsv,
    handleExportReportXlsx,
    handlePrintCurrentReport,
    handleExportReportPdf,
  } = useErpExportActions({
    accountEnquiryData,
    accountEnquiryCode,
    syncEnquiryUrl,
    generateStatementHtml,
    setStatementPreviewHtml,
    setStatementPreviewTitle,
    setStatementPreviewLoading,
    setShowStatementPreview,
    setExportOptionsOpen,
    setError,
    showNotification,
    transactions,
    selectedTransactionIds,
    transactionTypeLabels: TRANSACTION_TYPE_LABELS,
    reports,
    reportView,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    user,
    ledgerReportRows,
    selectedReportAccountCode,
    formatMoney,
    formatMoneyAbs,
    formatReportDirectionalBalance,
    buildBrandingLogoTag,
    openPrintWindow,
  })

  useEffect(() => {
    if (!jumpToTransactionId || typeof onJumpToTransactionConsumed !== 'function') return undefined
    let cancelled = false
    ;(async () => {
      try {
        await handleJumpToTransaction(jumpToTransactionId)
      } finally {
        if (!cancelled) onJumpToTransactionConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
    // handleJumpToTransaction is stable enough for this one-shot deep link; omit to avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToTransactionId, onJumpToTransactionConsumed])
  useEnquiryDeepLinkEffects({
    activeTab,
    searchParams,
    lastEnquiryDeepLinkKeyRef,
    fetchAccountEnquiryByCode,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
    setActiveTabGuarded,
  })

  useEffect(() => {
    if (!pendingStatementPreview || !accountEnquiryData) return undefined
    setPendingStatementPreview(false)
    let cancelled = false
    ;(async () => {
      setStatementPreviewHtml('')
      setStatementPreviewTitle('Statement of Account')
      setStatementPreviewLoading(true)
      setShowStatementPreview(true)
      try {
        const htmlData = await generateStatementHtml({ screenPreview: true })
        if (cancelled) return
        if (!htmlData) {
          setShowStatementPreview(false)
          return
        }
        setStatementPreviewHtml(htmlData.html)
        setStatementPreviewTitle(`Statement of Account — ${htmlData.accountCode || 'Account'}`)
        showNotification('Statement preview opened')
      } catch (err) {
        if (cancelled) return
        console.error('Statement preview error:', err)
        setShowStatementPreview(false)
        setError('Failed to open statement preview.')
      } finally {
        if (!cancelled) setStatementPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // generateStatementHtml reads live enquiry filters; run once when preview is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStatementPreview, accountEnquiryData])


  return {
    addJvLine,
    branding,
    buildBrandingLogoTag,
    closeJvModal,
    formatDirectionalBalance,
    formatMoney,
    formatMoneyAbs,
    formatReportDirectionalBalance,
    generateStatementHtml,
    getDepartmentBadgeStyle,
    getJvAccountById: _getJvAccountById,
    getJvValidation,
    getReportPeriodLabel,
    handleDownloadStatementPdf,
    handleEditJv,
    handleExportEnquiryPdf,
    handleExportReportCsv,
    handleExportReportPdf,
    handleExportReportXlsx,
    handleExportTransactionsCsv,
    handleExportTransactionsPdf,
    handleExportTransactionsXlsx,
    handleJvAccountKeyDown,
    handleJvLineKeyDown,
    handleOpenJv,
    handlePrintCurrentReport,
    handlePrintJvVoucher,
    handlePrintStatement,
    handleRepairJvFxApply,
    handleRepairJvFxPreview,
    handleSaveMultiLineJV,
    handleViewStatement,
    isExchangeLine: _isExchangeLine,
    jvError,
    normalizeBalanceDirection,
    openJvModal,
    openPrintWindow,
    removeJvLine,
    resetJvForm: _resetJvForm,
    resolveJvLineAccount,
    switchJvMode,
    tenantBranding,
    updateJvLine,
  }
}
