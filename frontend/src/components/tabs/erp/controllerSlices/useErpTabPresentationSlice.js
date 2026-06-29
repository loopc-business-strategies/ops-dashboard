import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../../context/AuthContext'
import { useLanguage } from '../../../../context/LanguageContext'
import { isLocalTenantHost } from '../../../../config/tenantBranding'
import { resolveErpUserTenantBranding, resolveErpUserTenantKey } from '../resolveErpUserTenant'
import {
  buildDashboardSearchParams,
  buildEnquiryHref,
} from '../../../../utils/dashboardNavigation'
import erpAccountingAPI from '../../../../api/erp-accounting'
import { buildEntryAccountOptions, filterActiveAccounts } from '../accountDropdownHelpers'
import { ACCOUNT_TYPES } from '../../../../constants/accountTypes'
import {
  LEDGER_REFERENCE_TYPES,
  LEDGER_DEPARTMENTS,
  ENQUIRY_DETAILS_PANEL_STORAGE_KEY,
  ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY,
  INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY,
  ACCOUNT_TYPE_ORDER,
  ERP_DASH_ALL_WIDGETS,
  DEFAULT_METAL_RATES,
} from '../../erpTabConstants'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from '../../transactionWorkflow'
import { useERPTabStateAdapter } from '../useERPTabStateAdapter'
import { useErpDashUiState } from '../useErpDashUiState'
import { useErpDashWidgetData } from '../useErpDashWidgetData'
import { useFixingRegisterPanelDrag } from '../useFixingRegisterPanelDrag'
import { useFixingRegisterState } from '../useFixingRegisterState'
import { useJvFormState } from '../useJvFormState'
import { useJvModalChrome } from '../useJvModalChrome'
import { useFixingRegisterStockTypeOptions } from '../useFixingRegisterStockTypeOptions'
import { ERP_TAB_COLORS as C, TRANSACTION_STATUS_STYLES, ERP_EMPTY_CARD_STYLE, ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import { useTransactionComposer } from '../useTransactionComposer'
import { useJournalVoucher } from '../useJournalVoucher'
import { useAccountEnquiryStatement } from '../accountEnquiry/useAccountEnquiryStatement'
import { useAccountEnquiryModalDrag } from '../accountEnquiry/useAccountEnquiryModalDrag'
import { useEnquiryDeepLinkEffects } from '../accountEnquiry/useEnquiryDeepLinkEffects'
import {
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
} from '../fixingRegisterUtils'

import { deriveErpAccessPolicy, getAvailableTransactionTypes } from '../accessPolicy'
import {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  createInventoryMappingForm,
  createInventoryProductForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
} from '../erpTabUtils'
import { useErpEnquiryMetalRatesSync } from '../useErpMetalRatesRealtime'
import { useErpLiveMetalSpotPrices } from '../useErpLiveMetalSpotPrices'
import useLiveMetalRates from '../../../../hooks/useLiveMetalRates'
import { useErpCustomers } from '../useErpCustomers'
import { useErpMappings } from '../useErpMappings'
import { useErpCurrencies } from '../useErpCurrencies'
import { useErpCustomerMargin, useErpSupplierMargin, useErpMarginContextMenuDismissal } from '../useErpMarginTabs'
import { useErpReportsController } from '../useErpReportsController'
import { useErpTransactionWorkflow } from '../useErpTransactionWorkflow'
import { useErpVoucherSource } from '../useErpVoucherSource'

import {
  liveRatesToMetalRatesState,
  resolveInventoryValuationUnitCost,
} from '../../../../utils/liveMetalRates'
import {
  formatAccountEnquiryExcessDisplay,
  getAccountEnquirySignedMetricColor,
  resolveExposureDirection,
  isMetalStatementEntry,
} from '../statementHelpers'
import { generateStatementHtml as buildStatementHtml } from '../statementPrintHtml'
import {
  canViewErpSubTab,
} from '../../../../utils/erpSubTabPermissions'
import {
  JV_MODE_META,
  buildJvDocNo as buildNextJvDocNo,
  convertJvAmountBetweenCurrencies,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
} from '../journalVoucherHelpers'
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  clampBrandingDimension,
} from '../ERPBrandingUtils'
import { resolveDocumentBranding } from '../documentBranding'
import { exchangeRateFromUnitsPerBase, resolveCurrencyRowByCode } from '../erpCurrencyRowHelpers'
import { buildBrandingLogoTag as buildBrandingLogoTagHelper, openPrintWindow as openPrintWindowHelper } from '../erpPrintHelpers'
import { useErpAccountEnquiryController } from '../useErpAccountEnquiryController'
import { useErpTabRouter } from '../useErpTabRouter'
import { useErpLedger } from '../useErpLedger'
import { useErpLedgerActions } from '../useErpLedgerActions'
import { useErpVendors } from '../useErpVendors'
import { useErpInventory } from '../useErpInventory'
import { useErpAccounts } from '../useErpAccounts'
import { useErpVendorActions } from '../useErpVendorActions'
import { useErpInventoryActions } from '../useErpInventoryActions'
import { useErpBranding } from '../useErpBranding'
import { useErpTransactions } from '../useErpTransactions'
import { useErpExportActions } from '../useErpExportActions'
import { useErpReferenceCrud } from '../useErpReferenceCrud'
import { useErpTransactionNavigation } from '../useErpTransactionNavigation'
import { useErpTabBindings } from '../useErpTabBindings'
import { EMPTY_VENDOR_DOCUMENT_FORM, EMPTY_VENDOR_FORM } from '../vendorFormDefaults'



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
    error,
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
  }, [accountEnquiryData])
  useEffect(() => {
    showEnquiryModalRef.current = showEnquiryModal
  }, [showEnquiryModal])
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
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return `This Month (${formatDate(start)} - ${formatDate(end)})`
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
  const generateStatementHtml = () => buildStatementHtml({
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
        const htmlData = await generateStatementHtml()
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
