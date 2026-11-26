import { useCallback } from 'react'
import { downloadCsv, downloadXlsxRows, printStatementHtml } from './exportHelpers'
import { buildReportExportPayload, getReportNotReadyMessage, isReportDataReady } from './reportExportHelpers'
import { buildTransactionExportPayload } from './transactionExportHelpers'
import { buildReportPrintHtml, exportReportPdf, exportTransactionsPdf } from './reportPrintExport'
import { exportStatementPdf } from './statementPdfExport'
import { buildStatementExcelRows, buildStatementExportModel } from './statementExportModel'

export function useErpExportActions({
  accountEnquiryData,
  accountEnquiryCode,
  statementFilters,
  fetchFullAccountStatement,
  generateStatementHtml,
  getStatementExportCtx,
  setStatementPreviewHtml,
  setStatementPreviewTitle,
  setStatementPreviewLoading,
  setShowStatementPreview,
  setExportOptionsOpen,
  setError,
  showNotification,
  transactions,
  selectedTransactionIds,
  transactionTypeLabels,
  reports,
  reportView,
  branding,
  defaultBranding,
  user,
  ledgerReportRows,
  selectedReportAccountCode,
  formatMoney,
  formatMoneyAbs,
  formatReportDirectionalBalance,
  buildBrandingLogoTag,
  openPrintWindow,
  baseCurrencyCode = 'USD',
}) {
  const loadFullStatementForCurrentFilters = useCallback(async () => {
    const code = String(accountEnquiryData?.account?.accountCode || accountEnquiryCode || '').trim()
    if (!code) return null
    if (typeof fetchFullAccountStatement === 'function') {
      return fetchFullAccountStatement({
        accountCode: code,
        startDate: String(statementFilters?.startDate || '').trim(),
        endDate: String(statementFilters?.endDate || '').trim(),
      })
    }
    return accountEnquiryData
  }, [accountEnquiryCode, accountEnquiryData, fetchFullAccountStatement, statementFilters?.endDate, statementFilters?.startDate])

  const handleViewStatement = useCallback(async () => {
    const code = accountEnquiryData?.account?.accountCode || accountEnquiryCode
    if (!code) {
      setError('Load an account summary first to view statement.')
      return
    }
    setStatementPreviewHtml('')
    setStatementPreviewTitle(`Statement of Account — ${code}`)
    setStatementPreviewLoading(true)
    setShowStatementPreview(true)

    try {
      const fullEnquiryData = await loadFullStatementForCurrentFilters()
      const htmlData = await generateStatementHtml({
        screenPreview: true,
        interactiveWindow: true,
        fullEnquiryData,
      })
      if (!htmlData?.html) {
        setShowStatementPreview(false)
        setError('Failed to prepare statement.')
        return
      }
      setStatementPreviewHtml(htmlData.html)
      setStatementPreviewTitle(`Statement of Account — ${htmlData.accountCode || code}`)
      showNotification('✅ Statement opened')
    } catch (err) {
      console.error('Statement view error:', err)
      setShowStatementPreview(false)
      setError('Failed to load statement for selected filters.')
    } finally {
      setStatementPreviewLoading(false)
    }
  }, [
    accountEnquiryData,
    accountEnquiryCode,
    loadFullStatementForCurrentFilters,
    generateStatementHtml,
    setStatementPreviewHtml,
    setStatementPreviewTitle,
    setStatementPreviewLoading,
    setShowStatementPreview,
    setError,
    showNotification,
  ])

  const handlePrintStatement = useCallback(async () => {
    try {
      const fullEnquiryData = await loadFullStatementForCurrentFilters()
      const htmlData = await generateStatementHtml({
        screenPreview: false,
        fullEnquiryData,
      })
      if (!htmlData) return
      await printStatementHtml(htmlData.html)
      setExportOptionsOpen(false)
      showNotification('✅ Statement opened for printing')
    } catch (err) {
      console.error('Statement print error:', err)
      if (String(err?.message || '').includes('Popup blocked')) {
        setError('Popup blocked. Please allow popups for statement printing.')
      } else {
        setError('Failed to prepare statement for printing.')
      }
    }
  }, [loadFullStatementForCurrentFilters, generateStatementHtml, setExportOptionsOpen, showNotification, setError])

  // Full-range statement context for the current filters (shared by PDF and Excel exports).
  const buildStatementExportCtx = useCallback(async () => {
    const fullEnquiryData = await loadFullStatementForCurrentFilters()
    const ctx = typeof getStatementExportCtx === 'function'
      ? getStatementExportCtx({ screenPreview: false, fullEnquiryData })
      : null
    return ctx?.accountEnquiryData ? ctx : null
  }, [loadFullStatementForCurrentFilters, getStatementExportCtx])

  const statementFileBase = (ctx) => {
    const stamp = new Date().toISOString().slice(0, 10)
    const accountCode = String(ctx.accountEnquiryData?.account?.accountCode || 'Account').replace(/[^\w.-]+/g, '-')
    return `Statement-${accountCode}-${stamp}`
  }

  const handleDownloadStatementPdf = useCallback(async () => {
    try {
      const ctx = await buildStatementExportCtx()
      if (!ctx) {
        setError('Failed to prepare statement for PDF export.')
        return
      }
      await exportStatementPdf(ctx, `${statementFileBase(ctx)}.pdf`)
      setExportOptionsOpen(false)
      showNotification('✅ Statement PDF downloaded')
    } catch (err) {
      console.error('PDF generation error:', err)
      setError('Failed to generate PDF. Please try again.')
    }
  }, [buildStatementExportCtx, setExportOptionsOpen, showNotification, setError])

  const handleExportStatementExcel = useCallback(async () => {
    try {
      const ctx = await buildStatementExportCtx()
      if (!ctx) {
        setError('Failed to prepare statement for Excel export.')
        return
      }
      const model = buildStatementExportModel(ctx)
      const rows = buildStatementExcelRows(model)
      if (!rows.length) {
        setError('Statement data not ready for Excel export.')
        return
      }
      await downloadXlsxRows(rows, `${statementFileBase(ctx)}.xlsx`, 'Statement')
      showNotification('✅ Statement Excel downloaded')
    } catch (err) {
      console.error('Excel generation error:', err)
      setError('Failed to generate Excel. Please try again.')
    }
  }, [buildStatementExportCtx, showNotification, setError])

  // Footer/header "Export PDF" downloads directly (no chooser dialog).
  const handleExportEnquiryPdf = useCallback(() => {
    if (!accountEnquiryData) {
      setError('Load an account summary first to export')
      return
    }
    handleDownloadStatementPdf()
  }, [accountEnquiryData, setError, handleDownloadStatementPdf])

  const handleExportTransactionsCsv = useCallback(() => {
    const payload = buildTransactionExportPayload({
      transactions,
      selectedTransactionIds,
      transactionTypeLabels,
      baseCurrencyCode,
    })
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification('✅ Transactions CSV exported')
  }, [transactions, selectedTransactionIds, transactionTypeLabels, baseCurrencyCode, setError, showNotification])

  const handleExportTransactionsXlsx = useCallback(async () => {
    const payload = buildTransactionExportPayload({
      transactions,
      selectedTransactionIds,
      transactionTypeLabels,
      baseCurrencyCode,
    })
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    await downloadXlsxRows(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification('✅ Transactions XLSX exported')
  }, [transactions, selectedTransactionIds, transactionTypeLabels, baseCurrencyCode, setError, showNotification])

  const handleExportTransactionsPdf = useCallback(async () => {
    const payload = buildTransactionExportPayload({
      transactions,
      selectedTransactionIds,
      transactionTypeLabels,
      baseCurrencyCode,
    })
    if (!payload?.scope?.length) {
      setError('No transactions available to export')
      return
    }
    await exportTransactionsPdf({ scope: payload.scope, transactionTypeLabels, baseCurrencyCode })
    showNotification('✅ Transactions PDF exported')
  }, [transactions, selectedTransactionIds, transactionTypeLabels, baseCurrencyCode, setError, showNotification])

  const handleExportReportCsv = useCallback((display = {}) => {
    const payload = buildReportExportPayload({
      reportView,
      reports: display.reports || reports,
      branding,
      defaultBranding,
      ledgerReportRows,
      columns: display.columns,
      convertAmount: display.convertAmount,
      displayCurrency: display.displayCurrency,
      baseCurrency: baseCurrencyCode,
    })
    if (!payload) {
      setError(getReportNotReadyMessage(reportView, 'exporting'))
      return
    }
    if (reportView === 'dayBook' && reports.dayBook?.truncated) {
      showNotification('⚠️ Day book export includes truncated rows only; totals on screen are full-set. Narrow the period or raise limit.')
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification(`✅ ${payload.successLabel} CSV exported`)
  }, [reportView, reports, branding, defaultBranding, ledgerReportRows, baseCurrencyCode, setError, showNotification])

  const handleExportReportXlsx = useCallback(async (display = {}) => {
    const payload = buildReportExportPayload({
      reportView,
      reports: display.reports || reports,
      branding,
      defaultBranding,
      ledgerReportRows,
      columns: display.columns,
      convertAmount: display.convertAmount,
      displayCurrency: display.displayCurrency,
      baseCurrency: baseCurrencyCode,
    })
    if (!payload) {
      setError(getReportNotReadyMessage(reportView, 'exporting'))
      return
    }
    if (reportView === 'dayBook' && reports.dayBook?.truncated) {
      showNotification('⚠️ Day book export includes truncated rows only; totals on screen are full-set. Narrow the period or raise limit.')
    }
    await downloadXlsxRows(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification(`✅ ${payload.successLabel} XLSX exported`)
  }, [reportView, reports, branding, defaultBranding, ledgerReportRows, baseCurrencyCode, setError, showNotification])

  const handlePrintCurrentReport = useCallback(async (display = {}) => {
    if (!isReportDataReady(reportView, display.reports || reports, ledgerReportRows)) {
      setError(getReportNotReadyMessage(reportView, 'printing'))
      return
    }
    const body = await buildReportPrintHtml({
      reportView,
      reports: display.reports || reports,
      branding,
      defaultBranding,
      user,
      formatMoney: display.formatMoney || formatMoney,
      formatMoneyAbs: display.formatMoneyAbs || formatMoneyAbs,
      formatReportDirectionalBalance: display.formatReportDirectionalBalance || formatReportDirectionalBalance,
      buildBrandingLogoTag,
      ledgerReportRows,
      selectedReportAccountCode,
      columns: display.columns,
      suppressSummary: display.suppressSummary,
      displayCurrency: display.displayCurrency,
      convertAmount: display.convertAmount,
      baseCurrency: baseCurrencyCode,
    })
    if (!body) {
      setError(getReportNotReadyMessage(reportView, 'printing'))
      return
    }
    openPrintWindow('ERP Financial Statement', body, { landscape: true })
    showNotification('✅ Statement print layout opened')
  }, [
    reports,
    reportView,
    branding,
    defaultBranding,
    user,
    formatMoney,
    formatMoneyAbs,
    formatReportDirectionalBalance,
    buildBrandingLogoTag,
    ledgerReportRows,
    selectedReportAccountCode,
    baseCurrencyCode,
    openPrintWindow,
    setError,
    showNotification,
  ])

  const handleExportReportPdf = useCallback(async (display = {}) => {
    if (!isReportDataReady(reportView, display.reports || reports, ledgerReportRows)) {
      setError(getReportNotReadyMessage(reportView, 'downloading'))
      return
    }
    await exportReportPdf({
      reportView,
      reports: display.reports || reports,
      branding,
      defaultBranding,
      user,
      ledgerReportRows,
      selectedReportAccountCode,
      formatMoney: display.formatMoney || formatMoney,
      formatReportDirectionalBalance: display.formatReportDirectionalBalance || formatReportDirectionalBalance,
      columns: display.columns,
      suppressSummary: display.suppressSummary,
      displayCurrency: display.displayCurrency,
      baseCurrency: baseCurrencyCode,
      convertAmount: display.convertAmount,
      period: display.period,
    })
    showNotification('✅ PDF downloaded')
  }, [
    reports,
    reportView,
    ledgerReportRows,
    branding,
    defaultBranding,
    user,
    selectedReportAccountCode,
    formatMoney,
    formatReportDirectionalBalance,
    baseCurrencyCode,
    setError,
    showNotification,
  ])

  return {
    handleViewStatement,
    handlePrintStatement,
    handleDownloadStatementPdf,
    handleExportEnquiryPdf,
    handleExportStatementExcel,
    handleExportTransactionsCsv,
    handleExportTransactionsXlsx,
    handleExportTransactionsPdf,
    handleExportReportCsv,
    handleExportReportXlsx,
    handlePrintCurrentReport,
    handleExportReportPdf,
  }
}
