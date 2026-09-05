import { useCallback } from 'react'
import { downloadCsv, downloadXlsxRows, printStatementHtml } from './exportHelpers'
import { buildReportExportPayload, getReportNotReadyMessage, isReportDataReady } from './reportExportHelpers'
import { buildTransactionExportPayload } from './transactionExportHelpers'
import { buildReportPrintHtml, exportReportPdf, exportTransactionsPdf } from './reportPrintExport'
import { exportStatementPdf } from './statementPdfExport'

export function useErpExportActions({
  accountEnquiryData,
  accountEnquiryCode,
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
  const handleViewStatement = useCallback(async () => {
    const code = accountEnquiryData?.account?.accountCode || accountEnquiryCode
    if (code) syncEnquiryUrl({ account: code, view: 'statement' })
    setStatementPreviewHtml('')
    setStatementPreviewTitle('Statement of Account')
    setStatementPreviewLoading(true)
    setShowStatementPreview(true)
    try {
      const htmlData = await generateStatementHtml({ screenPreview: true })
      if (!htmlData) {
        setShowStatementPreview(false)
        return
      }
      setStatementPreviewHtml(htmlData.html)
      setStatementPreviewTitle(`Statement of Account — ${htmlData.accountCode || 'Account'}`)
      showNotification('Statement preview opened')
    } catch (err) {
      console.error('Statement preview error:', err)
      setShowStatementPreview(false)
      setError('Failed to open statement preview.')
    } finally {
      setStatementPreviewLoading(false)
    }
  }, [
    accountEnquiryData,
    accountEnquiryCode,
    syncEnquiryUrl,
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
      const htmlData = await generateStatementHtml({ screenPreview: false })
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
  }, [generateStatementHtml, setExportOptionsOpen, showNotification, setError])

  const handleDownloadStatementPdf = useCallback(async () => {
    try {
      const ctx = typeof getStatementExportCtx === 'function'
        ? getStatementExportCtx({ screenPreview: false })
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
  }, [getStatementExportCtx, setExportOptionsOpen, showNotification, setError])

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

  const handleExportReportCsv = useCallback(() => {
    const payload = buildReportExportPayload({
      reportView,
      reports,
      branding,
      defaultBranding,
      ledgerReportRows,
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
  }, [reportView, reports, branding, defaultBranding, ledgerReportRows, setError, showNotification])

  const handleExportReportXlsx = useCallback(async () => {
    const payload = buildReportExportPayload({
      reportView,
      reports,
      branding,
      defaultBranding,
      ledgerReportRows,
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
  }, [reportView, reports, branding, defaultBranding, ledgerReportRows, setError, showNotification])

  const handlePrintCurrentReport = useCallback(async () => {
    if (!isReportDataReady(reportView, reports, ledgerReportRows)) {
      setError(getReportNotReadyMessage(reportView, 'printing'))
      return
    }
    const body = await buildReportPrintHtml({
      reportView,
      reports,
      branding,
      defaultBranding,
      user,
      formatMoney,
      formatMoneyAbs,
      formatReportDirectionalBalance,
      buildBrandingLogoTag,
      ledgerReportRows,
      selectedReportAccountCode,
    })
    if (!body) {
      setError(getReportNotReadyMessage(reportView, 'printing'))
      return
    }
    openPrintWindow('ERP Financial Statement', body)
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
    openPrintWindow,
    setError,
    showNotification,
  ])

  const handleExportReportPdf = useCallback(async () => {
    if (!isReportDataReady(reportView, reports, ledgerReportRows)) {
      setError(getReportNotReadyMessage(reportView, 'downloading'))
      return
    }
    await exportReportPdf({
      reportView,
      reports,
      branding,
      defaultBranding,
      user,
      ledgerReportRows,
      selectedReportAccountCode,
      formatMoney,
      formatReportDirectionalBalance,
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
