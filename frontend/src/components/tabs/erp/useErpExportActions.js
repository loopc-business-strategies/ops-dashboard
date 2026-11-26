import { useCallback } from 'react'
import { downloadCsv, downloadXlsxRows, printStatementHtml } from './exportHelpers'
import { buildReportExportPayload, getReportNotReadyMessage, isReportDataReady } from './reportExportHelpers'
import { buildTransactionExportPayload } from './transactionExportHelpers'
import { buildReportPrintHtml, exportReportPdf, exportTransactionsPdf } from './reportPrintExport'
import { exportStatementPdf } from './statementPdfExport'

export function useErpExportActions({
  accountEnquiryData,
  accountEnquiryCode,
  statementFilters,
  fetchFullAccountStatement,
  syncEnquiryUrl,
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
    // Open the new window synchronously inside the click handler so browsers do not block it.
    const viewWin = window.open('', '_blank')
    if (!viewWin) {
      setError('Popup blocked. Please allow popups to open Statement of Account in a new window.')
      return
    }
    viewWin.document.open()
    viewWin.document.write(`<!doctype html><html><head><title>Loading Statement — ${code}</title><style>body{font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFC;color:#0F172A}.box{background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:24px 32px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,0.08)}h2{margin:0 0 8px;font-size:18px}p{margin:0;color:#64748B;font-size:13px}</style></head><body><div class="box"><h2>Loading Statement of Account (${code})...</h2><p>Fetching all entries for the selected filters.</p></div></body></html>`)
    viewWin.document.close()

    try {
      const fullEnquiryData = await loadFullStatementForCurrentFilters()
      const htmlData = await generateStatementHtml({
        screenPreview: true,
        interactiveWindow: true,
        fullEnquiryData,
      })
      if (!htmlData?.html) {
        viewWin.close()
        setError('Failed to prepare statement.')
        return
      }
      if (!viewWin.closed) {
        viewWin.document.open()
        viewWin.document.write(htmlData.html)
        viewWin.document.close()
        viewWin.focus()
      }
      showNotification('✅ Statement opened in new window')
    } catch (err) {
      console.error('Statement view window error:', err)
      if (!viewWin.closed) viewWin.close()
      setError('Failed to load statement for selected filters.')
    }
  }, [
    accountEnquiryData,
    accountEnquiryCode,
    loadFullStatementForCurrentFilters,
    generateStatementHtml,
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

  const handleDownloadStatementPdf = useCallback(async () => {
    try {
      const fullEnquiryData = await loadFullStatementForCurrentFilters()
      const ctx = typeof getStatementExportCtx === 'function'
        ? getStatementExportCtx({ screenPreview: false, fullEnquiryData })
        : null
      if (!ctx?.accountEnquiryData) {
        setError('Failed to prepare statement for PDF export.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      const accountCode = String(
        ctx.accountEnquiryData?.account?.accountCode || 'Account',
      ).replace(/[^\w.-]+/g, '-')
      const fileName = `Statement-${accountCode}-${stamp}.pdf`
      await exportStatementPdf(ctx, fileName)
      setExportOptionsOpen(false)
      showNotification('✅ Statement PDF downloaded')
    } catch (err) {
      console.error('PDF generation error:', err)
      setError('Failed to generate PDF. Please try again.')
    }
  }, [loadFullStatementForCurrentFilters, getStatementExportCtx, setExportOptionsOpen, showNotification, setError])

  const handleExportEnquiryPdf = useCallback(() => {
    if (!accountEnquiryData) {
      setError('Load an account summary first to export')
      return
    }
    setExportOptionsOpen(true)
  }, [accountEnquiryData, setError, setExportOptionsOpen])

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
    handleExportTransactionsCsv,
    handleExportTransactionsXlsx,
    handleExportTransactionsPdf,
    handleExportReportCsv,
    handleExportReportXlsx,
    handlePrintCurrentReport,
    handleExportReportPdf,
  }
}
